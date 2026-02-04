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

    console.log(`Searching for hotels with Perplexity: ${query}`);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    // Use Perplexity to search for real hotel information
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a hotel search assistant. Search for real hotels matching the user's query and return structured data.

IMPORTANT: Return ONLY valid JSON with no additional text.

For each real hotel found, provide:
- id: a unique UUID
- name: the REAL hotel name
- address: actual street address
- city: city name
- state: state/province abbreviation  
- country: country name (default to "United States" if in US)
- rating: actual Google/TripAdvisor rating (1-5 scale)
- reviewCount: approximate number of reviews
- priceLevel: "$", "$$", "$$$", "$$$$", or "$$$$$"
- description: brief description from their website or reviews
- photos: array of 6-8 Unsplash hotel photo URLs (use realistic hotel images like https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80)

Return 3-5 REAL hotels that actually exist.`
          },
          {
            role: 'user',
            content: `Search for real hotels: "${query}". Find actual hotels that exist with their real addresses, ratings, and information.`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Perplexity rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    console.log('Perplexity response received, citations:', citations.length);
    console.log('Raw content:', content.substring(0, 500));

    // Parse hotels from the response
    let hotels = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        hotels = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing as object with hotels property
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const parsed = JSON.parse(objMatch[0]);
          hotels = parsed.hotels || [];
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity response as JSON:', parseError);
      // Use Lovable AI as fallback to structure the data
      hotels = await fallbackToLovableAI(query, content);
    }

    // Ensure photos have proper Unsplash URLs
    hotels = hotels.map((hotel: any, index: number) => ({
      ...hotel,
      id: hotel.id || crypto.randomUUID(),
      photos: hotel.photos?.length > 0 ? hotel.photos : generateHotelPhotos(index),
    }));

    console.log(`Found ${hotels.length} real hotels via Perplexity`);

    return new Response(
      JSON.stringify({ hotels, citations }),
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

// Fallback to Lovable AI to structure unstructured Perplexity response
async function fallbackToLovableAI(query: string, perplexityContent: string): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not available for fallback');
    return [];
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Extract hotel information from the provided text and return as JSON array.'
          },
          {
            role: 'user',
            content: `Extract hotels from this search result for "${query}":\n\n${perplexityContent}\n\nReturn a JSON array of hotels with: id (UUID), name, address, city, state, country, rating (number), reviewCount (number), priceLevel, description.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_hotels",
              description: "Return extracted hotels",
              parameters: {
                type: "object",
                properties: {
                  hotels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        address: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        country: { type: "string" },
                        rating: { type: "number" },
                        reviewCount: { type: "number" },
                        priceLevel: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_hotels" } }
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return args.hotels || [];
    }
  } catch (e) {
    console.error('Fallback AI also failed:', e);
  }

  return [];
}

function generateHotelPhotos(index: number): string[] {
  const photoSets = [
    [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
      'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&q=80',
      'https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
      'https://images.unsplash.com/photo-1587985064135-0366536eab42?w=800&q=80',
      'https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=800&q=80',
      'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80',
    ],
  ];
  return photoSets[index % photoSets.length];
}
