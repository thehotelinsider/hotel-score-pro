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
  tripadvisorRank?: number;
  starLevel?: number;
  distance: number;
  address: string;
  city: string;
  state: string;
  locationType?: string;
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

    // Determine hotel type and location type for better competitor matching
    const hotelNameLower = hotel.name.toLowerCase();
    const addressLower = hotel.address.toLowerCase();
    
    // Determine location type
    let locationType = 'general area';
    if (hotelNameLower.includes('downtown') || addressLower.includes('downtown') || 
        addressLower.includes('city center') || addressLower.includes('main st')) {
      locationType = 'downtown/city center';
    } else if (hotelNameLower.includes('airport') || addressLower.includes('airport')) {
      locationType = 'airport area';
    } else if (hotelNameLower.includes('convention') || addressLower.includes('convention')) {
      locationType = 'convention center area';
    } else if (addressLower.includes('interstate') || addressLower.includes('i-40') || 
               addressLower.includes('i-75') || addressLower.includes('highway')) {
      locationType = 'highway/interstate corridor';
    } else if (hotelNameLower.includes('resort') || hotelNameLower.includes('spa')) {
      locationType = 'resort/destination area';
    }
    
    // Determine hotel segment/type
    let hotelType = 'select-service hotel';
    let starLevel = '3-star';
    
    if (hotelNameLower.includes('residence inn') || hotelNameLower.includes('homewood') || 
        hotelNameLower.includes('staybridge') || hotelNameLower.includes('extended stay') ||
        hotelNameLower.includes('towneplace') || hotelNameLower.includes('candlewood')) {
      hotelType = 'extended-stay hotel with suites and kitchens';
      starLevel = '3-star extended-stay';
    } else if (hotelNameLower.includes('ritz') || hotelNameLower.includes('four seasons') || 
               hotelNameLower.includes('waldorf') || hotelNameLower.includes('st. regis') ||
               hotel.priceLevel === '$$$$') {
      hotelType = 'luxury full-service hotel';
      starLevel = '5-star luxury';
    } else if (hotelNameLower.includes('marriott hotel') || hotelNameLower.includes('hilton hotel') ||
               hotelNameLower.includes('sheraton') || hotelNameLower.includes('hyatt regency') ||
               hotelNameLower.includes('westin') || hotelNameLower.includes('renaissance')) {
      hotelType = 'full-service hotel with restaurant and meeting rooms';
      starLevel = '4-star full-service';
    } else if (hotelNameLower.includes('courtyard') || hotelNameLower.includes('hampton') ||
               hotelNameLower.includes('hilton garden') || hotelNameLower.includes('holiday inn express') ||
               hotelNameLower.includes('fairfield')) {
      hotelType = 'select-service hotel';
      starLevel = '3-star select-service';
    } else if (hotelNameLower.includes('la quinta') || hotelNameLower.includes('comfort inn') ||
               hotelNameLower.includes('best western') || hotelNameLower.includes('days inn') ||
               hotelNameLower.includes('super 8') || hotel.priceLevel === '$') {
      hotelType = 'economy/budget hotel';
      starLevel = '2-star economy';
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
            content: `You are a hotel market analyst specializing in competitive set analysis. Find REAL competitor hotels that match the subject hotel's location type, star level, and amenity profile.

Return ONLY valid JSON array with no additional text.

For each competitor hotel, provide:
- id: unique UUID
- name: EXACT real hotel name (must be a real hotel that exists)
- rating: Google rating (1-5 scale)
- tripadvisorRank: TripAdvisor ranking in the city (numeric, e.g., 5 means #5 in the city)
- starLevel: hotel star rating (2, 3, 4, or 5)
- distance: distance in miles from subject hotel (must be within 5 miles)
- address: real street address
- city: city name
- state: state abbreviation
- locationType: location category (downtown, airport, highway, suburban, etc.)

CRITICAL MATCHING CRITERIA:
1. ONLY include hotels in the SAME location type (e.g., downtown hotels for downtown hotels, airport hotels for airport hotels)
2. ONLY include hotels with similar star level (within 1 star)
3. ONLY include hotels with similar service type (extended-stay vs select-service vs full-service)
4. Rank results by TripAdvisor ranking first, then by star level, then by Google rating`
          },
          {
            role: 'user',
            content: `Find 6-8 REAL competitor hotels near:

Hotel: ${hotel.name}
Address: ${hotel.address}
Location: ${hotel.city}, ${hotel.state}
Location Type: ${locationType}
Hotel Segment: ${hotelType}
Star Level: ${starLevel}
Price Level: ${hotel.priceLevel}

IMPORTANT: Only find hotels that are:
1. In the ${locationType} area (same neighborhood/district)
2. Similar ${starLevel} properties
3. Same service type: ${hotelType}
4. Within 5 miles of the subject hotel

Order results by TripAdvisor city ranking (best ranked first), then by star level, then by Google rating.`
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
      tripadvisorRank: typeof c.tripadvisorRank === 'number' ? c.tripadvisorRank : index + 10,
      starLevel: typeof c.starLevel === 'number' ? c.starLevel : 3,
      rank: c.rank || index + 1,
      distance: typeof c.distance === 'number' ? c.distance : (index + 1) * 0.5,
      address: c.address || '',
      city: c.city || hotel.city,
      state: c.state || hotel.state,
      locationType: c.locationType || 'general',
    }));

    // Sort by TripAdvisor rank first, then by star level (desc), then by Google rating (desc)
    competitors = competitors
      .sort((a, b) => {
        // First by TripAdvisor rank (lower is better)
        if (a.tripadvisorRank !== b.tripadvisorRank) {
          return (a.tripadvisorRank || 999) - (b.tripadvisorRank || 999);
        }
        // Then by star level (higher is better)
        if (a.starLevel !== b.starLevel) {
          return (b.starLevel || 3) - (a.starLevel || 3);
        }
        // Finally by Google rating (higher is better)
        return b.rating - a.rating;
      })
      .map((c, index) => ({ ...c, rank: index + 1 })) // Re-assign ranks based on sorting
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
