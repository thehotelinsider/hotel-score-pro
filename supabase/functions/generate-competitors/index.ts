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

    console.log(`Finding real competitors via Perplexity for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    // Determine hotel type for better competitor matching
    const hotelNameLower = hotel.name.toLowerCase();
    let hotelType = 'select-service hotel';
    
    if (hotelNameLower.includes('residence inn') || hotelNameLower.includes('homewood') || 
        hotelNameLower.includes('staybridge') || hotelNameLower.includes('extended stay')) {
      hotelType = 'extended-stay hotel with suites and kitchens';
    } else if (hotelNameLower.includes('ritz') || hotelNameLower.includes('four seasons') || 
               hotelNameLower.includes('waldorf') || hotel.priceLevel === '$$$$') {
      hotelType = 'luxury hotel';
    } else if (hotelNameLower.includes('marriott hotel') || hotelNameLower.includes('hilton hotel') ||
               hotelNameLower.includes('sheraton') || hotelNameLower.includes('hyatt')) {
      hotelType = 'full-service hotel with restaurant and meeting rooms';
    }

    // Use Perplexity to find real competitor hotels
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
            content: `You are a hotel market analyst. Find REAL competitor hotels near the specified hotel.

Return ONLY valid JSON array with no additional text.

For each competitor hotel, provide:
- id: unique UUID
- name: EXACT real hotel name
- rating: actual Google rating (1-5)
- rank: competitive market ranking (1-8)
- distance: estimated distance in miles from subject hotel
- address: real street address
- city: city name
- state: state abbreviation

Find hotels that:
1. Are REAL hotels that actually exist
2. Are in the same area/neighborhood
3. Are similar in service level and price point
4. Would compete for the same guests`
          },
          {
            role: 'user',
            content: `Find 8 REAL competitor hotels near:

Hotel: ${hotel.name}
Address: ${hotel.address}
Location: ${hotel.city}, ${hotel.state}
Type: ${hotelType}
Price Level: ${hotel.priceLevel}

Search for actual hotels within 5 miles that compete for the same guests. Return their real names, addresses, and Google ratings.`
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
    
    console.log('Perplexity competitors response, citations:', citations.length);

    // Parse competitors from the response
    let competitors: Competitor[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        competitors = JSON.parse(jsonMatch[0]);
      } else {
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const parsed = JSON.parse(objMatch[0]);
          competitors = parsed.competitors || [];
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity competitors response:', parseError);
      // Fallback to Lovable AI
      competitors = await fallbackToLovableAI(hotel, content);
    }

    // Ensure all competitors have required fields
    competitors = competitors.map((c: any, index: number) => ({
      id: c.id || crypto.randomUUID(),
      name: c.name || `Competitor ${index + 1}`,
      rating: typeof c.rating === 'number' ? c.rating : 4.0,
      rank: c.rank || index + 1,
      distance: typeof c.distance === 'number' ? c.distance : (index + 1) * 0.5,
      address: c.address || '',
      city: c.city || hotel.city,
      state: c.state || hotel.state,
    }));

    // Sort by distance and limit to 8
    competitors = competitors
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);

    console.log(`Found ${competitors.length} real competitors via Perplexity`);

    return new Response(
      JSON.stringify({ competitors, citations }),
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

async function fallbackToLovableAI(hotel: Hotel, perplexityContent: string): Promise<Competitor[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];

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
            role: 'user',
            content: `Extract competitor hotels from this text for ${hotel.name} in ${hotel.city}, ${hotel.state}:\n\n${perplexityContent}\n\nReturn JSON array with: id, name, rating, rank, distance, address, city, state`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_competitors",
              description: "Return competitor hotels",
              parameters: {
                type: "object",
                properties: {
                  competitors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        rating: { type: "number" },
                        rank: { type: "number" },
                        distance: { type: "number" },
                        address: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_competitors" } }
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return args.competitors || [];
    }
  } catch (e) {
    console.error('Fallback AI failed:', e);
  }

  return [];
}
