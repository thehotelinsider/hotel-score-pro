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
  name: string;
  rating: number;
  distance?: number;
  address?: string;
}

interface MapRanking {
  hotelName: string;
  rank: number;
  rating: number;
  reviewCount: number;
  distance: string;
  isSubjectHotel: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors?: Competitor[] };
    
    if (!hotel || !hotel.city || !hotel.state) {
      return new Response(
        JSON.stringify({ success: false, rankings: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating Google Map rankings for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build competitor context
    const competitorList = competitors?.slice(0, 10).map(c => ({
      name: c.name,
      rating: c.rating,
      distance: c.distance
    })) || [];

    const systemPrompt = `You are a local search and Google Maps expert. Generate realistic Google Maps search results ranking data for hotels in a specific area.

When someone searches "hotels near me" or "hotels in [city]" on Google Maps, the results are ranked based on:
1. Relevance to the search
2. Distance from the search location
3. Prominence (reviews, ratings, online presence)

CRITICAL RULES:
1. Generate a ranked list of 8-10 hotels that would appear in Google Maps for "${hotel.city}, ${hotel.state}"
2. Include the subject hotel (${hotel.name}) at a REALISTIC position (not always #1)
3. Include the provided competitors in realistic positions
4. Add a few other realistic local hotels to fill out the list
5. Ratings should be between 3.5 and 5.0
6. Review counts should be realistic (ranging from 50 to 5000+)
7. Distance should be from the city center or a central point
8. Hotels with higher ratings and more reviews typically rank higher
9. The subject hotel's position depends on its rating (${hotel.rating}) - if it's lower than competitors, it should rank lower

Generate realistic data that shows where ${hotel.name} ranks among local competitors in Google Maps.`;

    const userPrompt = `Generate Google Maps search ranking results for "hotels in ${hotel.city}, ${hotel.state}"

Subject Hotel:
- Name: ${hotel.name}
- Address: ${hotel.address}
- Rating: ${hotel.rating}/5
- Price Level: ${hotel.priceLevel}

Known Competitors:
${competitorList.map((c, i) => `${i + 1}. ${c.name} - Rating: ${c.rating}/5`).join('\n')}

Generate a ranked list showing where each hotel appears in Google Maps results, with the subject hotel at a realistic position based on its rating and online presence.`;

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
              name: "return_map_rankings",
              description: "Return a ranked list of hotels as they appear in Google Maps search results",
              parameters: {
                type: "object",
                properties: {
                  rankings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hotelName: { type: "string", description: "Name of the hotel" },
                        rank: { type: "number", description: "Position in Google Maps results (1 = top)" },
                        rating: { type: "number", description: "Google rating out of 5" },
                        reviewCount: { type: "number", description: "Number of Google reviews" },
                        distance: { type: "string", description: "Distance from city center (e.g., '0.5 mi')" },
                        isSubjectHotel: { type: "boolean", description: "True if this is the subject hotel being analyzed" }
                      },
                      required: ["hotelName", "rank", "rating", "reviewCount", "distance", "isSubjectHotel"]
                    }
                  }
                },
                required: ["rankings"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_map_rankings" } }
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

    // Extract rankings from tool call response
    let rankings: MapRanking[] = [];
    
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      rankings = args.rankings || [];
    } else if (data.choices?.[0]?.message?.content) {
      try {
        const parsed = JSON.parse(data.choices[0].message.content);
        rankings = parsed.rankings || parsed || [];
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
      }
    }

    // Sort by rank and limit to 10
    rankings = rankings
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10);

    console.log(`Generated ${rankings.length} Google Map rankings for ${hotel.city}`);

    return new Response(
      JSON.stringify({ success: true, rankings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-map-rankings function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
