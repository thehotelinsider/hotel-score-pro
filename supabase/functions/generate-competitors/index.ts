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

    // Extract location keywords from address (like "Turkey Creek", "Cedar Bluff", etc.)
    const addressLower = (hotel.address || '').toLowerCase();
    const nameLower = hotel.name.toLowerCase();
    const locationKeywords: string[] = [];
    
    // Common area/corridor names to look for
    const areaPatterns = [
      /turkey creek/i, /cedar bluff/i, /west town/i, /downtown/i, /airport/i,
      /medical center/i, /university/i, /convention center/i, /waterfront/i,
      /mall/i, /outlet/i, /interstate/i, /i-\d+/i, /highway/i, /exit \d+/i
    ];
    
    for (const pattern of areaPatterns) {
      const addressMatch = addressLower.match(pattern);
      const nameMatch = nameLower.match(pattern);
      if (addressMatch) locationKeywords.push(addressMatch[0]);
      if (nameMatch) locationKeywords.push(nameMatch[0]);
    }
    
    // Also extract from hotel name (e.g., "Knoxville West at Turkey Creek" -> "Turkey Creek", "West")
    const locationFromName = hotel.name.match(/(?:at|near|by)\s+([^,]+)/i);
    if (locationFromName) {
      locationKeywords.push(locationFromName[1].trim());
    }
    
    const locationHint = locationKeywords.length > 0 
      ? `Key area/corridor: ${[...new Set(locationKeywords)].join(', ')}` 
      : '';

    const systemPrompt = `You are an expert hotel market analyst with detailed knowledge of real hotels across the United States.

Your task: Identify REAL competitor hotels that exist and would be direct competitors for bookings.

## CRITICAL REQUIREMENTS:

### 1. REAL HOTELS ONLY
- Every hotel you list MUST be a real, currently operating hotel
- Use actual hotel names exactly as they appear (e.g., "Homewood Suites by Hilton Knoxville West at Turkey Creek")
- Include real street addresses for the specific location

### 2. SAME MICRO-LOCATION (MOST IMPORTANT)
- Competitors must be in the EXACT SAME commercial corridor/neighborhood
- If the hotel is "at Turkey Creek" - find other hotels "at Turkey Creek" or "Farragut" or "Cedar Bluff" areas
- Look for hotels along the same interstate exit or commercial strip
- Travelers compare hotels in the SAME immediate area, not across town

### 3. MATCHING SERVICE TYPE: "${serviceType.toUpperCase()}"
Find hotels that match this service category:
${serviceType === 'select-service' ? `
- SpringHill Suites, Fairfield Inn, Hampton Inn, Courtyard, Holiday Inn Express
- Comfort Inn/Suites, La Quinta, Best Western Plus, Hilton Garden Inn
- These are limited-service hotels with complimentary breakfast, business centers` : ''}
${serviceType === 'extended-stay' ? `
- Residence Inn, Homewood Suites, Staybridge Suites, Home2 Suites
- TownePlace Suites, Candlewood Suites, Extended Stay America
- Hotels with kitchens designed for stays of 5+ nights` : ''}
${serviceType === 'full-service' ? `
- Marriott Hotels, Hilton Hotels, Sheraton, Westin, Hyatt Regency
- Embassy Suites, DoubleTree, Crowne Plaza
- Hotels with restaurants, room service, meeting spaces` : ''}
${serviceType === 'luxury' ? `
- Ritz-Carlton, Four Seasons, St. Regis, Waldorf Astoria, JW Marriott
- Premium hotels with extensive amenities and service` : ''}
${serviceType === 'economy' ? `
- Motel 6, Super 8, Red Roof Inn, Econo Lodge, Days Inn
- Budget-friendly basic accommodations` : ''}
${serviceType === 'boutique' ? `
- Autograph Collection, Curio Collection, Tribute Portfolio
- Independent boutique hotels with unique character` : ''}

### 4. OUTPUT FORMAT
For each competitor provide:
- id: unique UUID
- name: EXACT real hotel name as it appears on Google/booking sites
- rating: actual Google/TripAdvisor rating (typically 3.8-4.6)
- rank: competitive ranking 1-8 in local market
- distance: actual distance in miles (most should be 0.5-3 miles)
- address: real street address
- city: city name
- state: state abbreviation`;

    const userPrompt = `Find the 8 closest REAL competitor hotels for:

**SUBJECT HOTEL:**
${hotel.name}
${hotel.address}
${hotel.city}, ${hotel.state} ${hotel.country}
Rating: ${hotel.rating}/5 | Price: ${hotel.priceLevel} | Type: ${serviceType}
${locationHint}

**WHAT TO FIND:**
1. Hotels within 0.5-3 miles in the SAME commercial area/corridor
2. Same service type: ${serviceType} properties
3. Hotels that travelers would directly compare when booking this area

**EXAMPLE COMPETITORS FOR A SPRINGHILL SUITES IN TURKEY CREEK AREA:**
- Homewood Suites by Hilton Knoxville West at Turkey Creek
- Hampton Inn & Suites Knoxville-Turkey Creek/Farragut  
- Fairfield by Marriott Inn & Suites Knoxville Turkey Creek
- Staybridge Suites Knoxville-West, an IHG Hotel
- Home2 Suites by Hilton Knoxville West
- TownePlace Suites by Marriott Knoxville Cedar Bluff
- Residence Inn by Marriott Knoxville Cedar Bluff
- Embassy Suites by Hilton Knoxville West

**FIND SIMILAR REAL HOTELS FOR THE SUBJECT HOTEL'S SPECIFIC LOCATION.**`;

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
