import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Hotel {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  rating: number;
  priceLevel: string;
}

interface Competitor {
  id: string;
  name: string;
  rating: number;
  rank: number;
  distance: number;
  address: string;
  city: string;
  state: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel } = await req.json() as { hotel: Hotel };
    
    if (!hotel || !hotel.city || !hotel.state) {
      return new Response(
        JSON.stringify({ competitors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating competitors for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a hotel market research assistant. Given a subject hotel, generate realistic competitor hotels that would be located within a 10-mile radius in the same market.

IMPORTANT: Return ONLY valid JSON with no additional text. The response must be a valid JSON object.

For each competitor hotel, provide:
- id: a unique identifier (use UUID format)
- name: a realistic hotel name (mix of chain hotels and boutique/independent hotels that would be in that market)
- rating: a realistic rating between 3.5 and 5.0 (one decimal place)
- rank: their ranking in the local market (1-10, where 1 is best)
- distance: approximate distance in miles from the subject hotel (0.1 to 10 miles)
- address: a realistic street address
- city: same city as subject hotel
- state: same state as subject hotel

Generate exactly 5 competitor hotels that would realistically compete with the subject hotel in the same market. Consider:
1. The subject hotel's price level and star rating when selecting competitors
2. Include a mix of higher-rated and similarly-rated competitors
3. Ensure realistic distances - hotels in downtown areas should be closer together
4. Use real hotel brand names that make sense for the location`;

    const userPrompt = `Generate 5 competitor hotels within a 10-mile radius of this hotel:

Hotel Name: ${hotel.name}
Address: ${hotel.address}
City: ${hotel.city}, ${hotel.state}
Country: ${hotel.country}
Rating: ${hotel.rating}/5
Price Level: ${hotel.priceLevel}

Find realistic competitor hotels in the ${hotel.city}, ${hotel.state} market that would compete with this property.`;

    // Helper function for fetch with retry
    const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2): Promise<Response> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.status >= 502 && response.status <= 504 && attempt < maxRetries) {
            console.log(`Retrying due to ${response.status} error (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          return response;
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries) {
            console.log(`Retrying due to network error (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
      throw lastError || new Error('Request failed after retries');
    };

    const response = await fetchWithRetry('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_competitors",
              description: "Return a list of competitor hotels within 10 miles of the subject hotel",
              parameters: {
                type: "object",
                properties: {
                  competitors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique UUID for the hotel" },
                        name: { type: "string", description: "Hotel name" },
                        rating: { type: "number", description: "Rating from 3.5 to 5.0" },
                        rank: { type: "number", description: "Market ranking 1-10" },
                        distance: { type: "number", description: "Distance in miles (0.1-10)" },
                        address: { type: "string", description: "Street address" },
                        city: { type: "string", description: "City name" },
                        state: { type: "string", description: "State abbreviation" }
                      },
                      required: ["id", "name", "rating", "rank", "distance", "address", "city", "state"]
                    }
                  }
                },
                required: ["competitors"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_competitors" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    // Extract competitors from tool call response
    let competitors: Competitor[] = [];
    
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      competitors = args.competitors || [];
    } else if (data.choices?.[0]?.message?.content) {
      try {
        const parsed = JSON.parse(data.choices[0].message.content);
        competitors = parsed.competitors || parsed || [];
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
      }
    }

    // Sort by rank and ensure we have top 5
    competitors = competitors
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5);

    console.log(`Generated ${competitors.length} competitors`);

    return new Response(
      JSON.stringify({ competitors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-competitors function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
