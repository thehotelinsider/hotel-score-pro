import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ hotels: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching for hotels with query: ${query}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a hotel search assistant. Given a user's search query, generate realistic hotel listings that match their search. 
    
IMPORTANT: Return ONLY valid JSON with no additional text. The response must be a valid JSON object.

For each hotel, provide:
- id: a unique identifier (use UUID format)
- name: the hotel name
- address: street address
- city: city name
- state: state/province abbreviation
- country: country name
- rating: a realistic rating between 3.0 and 5.0 (one decimal place)
- reviewCount: number of reviews (100-5000)
- priceLevel: one of "$", "$$", "$$$", "$$$$", or "$$$$$"
- description: a brief 1-2 sentence description

Generate 3-5 relevant hotels based on the search query. If the query mentions a specific location, use that. If the query is just a hotel name or brand, generate realistic hotels with that name in different locations.`;

    // Helper function for fetch with retry
    const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2): Promise<Response> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          // Only retry on 502/503/504 errors
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
          { role: 'user', content: `Search for hotels: "${query}"` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_hotels",
              description: "Return a list of hotels matching the search query",
              parameters: {
                type: "object",
                properties: {
                  hotels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique UUID for the hotel" },
                        name: { type: "string", description: "Hotel name" },
                        address: { type: "string", description: "Street address" },
                        city: { type: "string", description: "City name" },
                        state: { type: "string", description: "State/province abbreviation" },
                        country: { type: "string", description: "Country name" },
                        rating: { type: "number", description: "Rating from 3.0 to 5.0" },
                        reviewCount: { type: "number", description: "Number of reviews" },
                        priceLevel: { type: "string", description: "Price level ($, $$, $$$, $$$$, $$$$$)" },
                        description: { type: "string", description: "Brief description" }
                      },
                      required: ["id", "name", "address", "city", "state", "country", "rating", "reviewCount", "priceLevel", "description"]
                    }
                  }
                },
                required: ["hotels"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_hotels" } }
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

    // Extract hotels from tool call response
    let hotels = [];
    
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      hotels = args.hotels || [];
    } else if (data.choices?.[0]?.message?.content) {
      // Fallback: try to parse content as JSON
      try {
        const parsed = JSON.parse(data.choices[0].message.content);
        hotels = parsed.hotels || parsed || [];
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
      }
    }

    console.log(`Found ${hotels.length} hotels`);

    return new Response(
      JSON.stringify({ hotels }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-hotels function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
