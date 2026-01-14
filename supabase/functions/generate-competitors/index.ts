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

    // Determine hotel service type from name and price level
    const hotelNameLower = hotel.name.toLowerCase();
    let serviceType = 'select-service';
    
    if (hotelNameLower.includes('residence inn') || hotelNameLower.includes('homewood') || 
        hotelNameLower.includes('staybridge') || hotelNameLower.includes('home2') ||
        hotelNameLower.includes('towneplace') || hotelNameLower.includes('extended stay')) {
      serviceType = 'extended-stay';
    } else if (hotelNameLower.includes('ritz') || hotelNameLower.includes('four seasons') || 
               hotelNameLower.includes('st. regis') || hotelNameLower.includes('waldorf') ||
               hotelNameLower.includes('luxury') || hotel.priceLevel === '$$$$') {
      serviceType = 'luxury';
    } else if (hotelNameLower.includes('boutique') || hotelNameLower.includes('autograph') ||
               hotelNameLower.includes('curio') || hotelNameLower.includes('tribute')) {
      serviceType = 'boutique';
    } else if (hotelNameLower.includes('marriott hotel') || hotelNameLower.includes('hilton hotel') ||
               hotelNameLower.includes('sheraton') || hotelNameLower.includes('westin') ||
               hotelNameLower.includes('hyatt regency') || hotelNameLower.includes('embassy suites')) {
      serviceType = 'full-service';
    } else if (hotelNameLower.includes('motel 6') || hotelNameLower.includes('super 8') ||
               hotelNameLower.includes('red roof') || hotelNameLower.includes('econo') ||
               hotelNameLower.includes('budget') || hotel.priceLevel === '$') {
      serviceType = 'economy';
    } else if (hotelNameLower.includes('springhill') || hotelNameLower.includes('fairfield') ||
               hotelNameLower.includes('hampton') || hotelNameLower.includes('holiday inn express') ||
               hotelNameLower.includes('comfort') || hotelNameLower.includes('la quinta') ||
               hotelNameLower.includes('best western') || hotelNameLower.includes('courtyard')) {
      serviceType = 'select-service';
    }

    const systemPrompt = `You are a hotel market research expert. Given a subject hotel, identify REAL competitor hotels that exist in the EXACT SAME geographic area/neighborhood.

CRITICAL RULES FOR COMPETITOR SELECTION:
1. **PROXIMITY IS PARAMOUNT**: Competitors MUST be within 5 miles, preferably within 2-3 miles. They should be in the SAME neighborhood/area/corridor (e.g., if subject is at "Turkey Creek", find hotels at "Turkey Creek" or immediately adjacent areas).

2. **MATCHING SERVICE TYPE**: The subject hotel is a "${serviceType}" property. Find competitors that are the SAME service type:
   - Select-service: Hampton Inn, Fairfield Inn, Courtyard, Holiday Inn Express, Comfort Inn, La Quinta, Best Western Plus, SpringHill Suites
   - Extended-stay: Residence Inn, Homewood Suites, Staybridge Suites, Home2 Suites, TownePlace Suites, Extended Stay America
   - Full-service: Marriott, Hilton, Sheraton, Westin, Hyatt Regency, Embassy Suites
   - Luxury: Ritz-Carlton, Four Seasons, St. Regis, Waldorf Astoria
   - Economy: Motel 6, Super 8, Red Roof Inn, Econo Lodge
   - Boutique: Autograph Collection, Curio Collection, Tribute Portfolio, independent boutique hotels

3. **USE REAL HOTELS**: Only include hotels that actually exist at that location. Use real hotel names, real addresses in that specific area.

4. **SAME MARKET SEGMENT**: Match the price level and target customer (business travelers, families, etc.)

For each competitor, provide:
- id: unique UUID
- name: the REAL hotel name (must be a real hotel that exists)
- rating: realistic rating 3.5-5.0
- rank: local market ranking 1-8
- distance: actual approximate distance in miles (prioritize closest hotels, most should be under 3 miles)
- address: real street address
- city: same city/area as subject
- state: same state

Generate 8 competitor hotels, prioritizing the CLOSEST hotels that match the service type.`;

    const userPrompt = `Find the 8 closest REAL competitor hotels for this property:

Subject Hotel: ${hotel.name}
Address: ${hotel.address}
City: ${hotel.city}, ${hotel.state}
Country: ${hotel.country}
Rating: ${hotel.rating}/5
Price Level: ${hotel.priceLevel}
Service Type: ${serviceType}

IMPORTANT: Find REAL hotels that actually exist in the immediate ${hotel.city} area, especially near "${hotel.address}". 
Prioritize hotels in the SAME neighborhood/corridor that offer similar ${serviceType} accommodations.
The competitors should be hotels a traveler would realistically compare when booking in this specific location.`;

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

    // Sort by distance (closest first) then by rank, and ensure we have top 8
    competitors = competitors
      .sort((a, b) => a.distance - b.distance || a.rank - b.rank)
      .slice(0, 8);

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
