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
}

interface SearchRanking {
  keyword: string;
  position: number | 'unranked';
  topCompetitor: string;
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
        JSON.stringify({ rankings: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating search rankings for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Determine hotel service type for more relevant keywords
    const hotelNameLower = hotel.name.toLowerCase();
    let serviceType = 'select-service';
    let keywordFocus = 'business travelers and families';
    
    if (hotelNameLower.includes('residence inn') || hotelNameLower.includes('homewood') || 
        hotelNameLower.includes('staybridge') || hotelNameLower.includes('home2') ||
        hotelNameLower.includes('towneplace') || hotelNameLower.includes('extended stay')) {
      serviceType = 'extended-stay';
      keywordFocus = 'extended stay, suites, kitchens, long-term stays';
    } else if (hotelNameLower.includes('ritz') || hotelNameLower.includes('four seasons') || 
               hotelNameLower.includes('st. regis') || hotelNameLower.includes('waldorf') ||
               hotelNameLower.includes('luxury') || hotel.priceLevel === '$$$$') {
      serviceType = 'luxury';
      keywordFocus = 'luxury, upscale, fine dining, spa';
    } else if (hotelNameLower.includes('boutique') || hotelNameLower.includes('autograph') ||
               hotelNameLower.includes('curio') || hotelNameLower.includes('tribute')) {
      serviceType = 'boutique';
      keywordFocus = 'boutique, unique, stylish, local experience';
    } else if (hotelNameLower.includes('marriott hotel') || hotelNameLower.includes('hilton hotel') ||
               hotelNameLower.includes('sheraton') || hotelNameLower.includes('westin') ||
               hotelNameLower.includes('hyatt regency') || hotelNameLower.includes('embassy suites')) {
      serviceType = 'full-service';
      keywordFocus = 'full-service, restaurant, meeting rooms, conference';
    } else if (hotelNameLower.includes('motel 6') || hotelNameLower.includes('super 8') ||
               hotelNameLower.includes('red roof') || hotelNameLower.includes('econo') ||
               hotelNameLower.includes('budget') || hotel.priceLevel === '$') {
      serviceType = 'economy';
      keywordFocus = 'budget, affordable, cheap, value';
    } else if (hotelNameLower.includes('springhill') || hotelNameLower.includes('fairfield') ||
               hotelNameLower.includes('hampton') || hotelNameLower.includes('holiday inn express') ||
               hotelNameLower.includes('comfort') || hotelNameLower.includes('la quinta') ||
               hotelNameLower.includes('best western') || hotelNameLower.includes('courtyard')) {
      serviceType = 'select-service';
      keywordFocus = 'business travel, complimentary breakfast, clean, convenient';
    }

    // Build competitor context
    const competitorNames = competitors?.slice(0, 5).map(c => c.name).join(', ') || 'local competing hotels';

    const systemPrompt = `You are a hotel SEO and search marketing expert. Given a hotel and its location, generate realistic search ranking data showing where this hotel would appear in Google search results for relevant local search queries.

CRITICAL RULES:
1. **USE THE EXACT CITY**: All keywords must include "${hotel.city}" or "${hotel.city}, ${hotel.state}" - use the ACTUAL city name provided.

2. **REALISTIC SEARCH TERMS**: Generate keywords that real travelers would actually search for when looking for hotels in ${hotel.city}, such as:
   - "hotels in ${hotel.city}"
   - "best hotels ${hotel.city}"
   - "${hotel.city} hotels near [landmark/area]"
   - "hotels with [amenity] in ${hotel.city}"
   - Service-type specific terms for ${serviceType} properties

3. **REALISTIC RANKINGS**: Most hotels don't rank #1 for competitive terms. Use realistic positions:
   - Position 1-3: Only for very specific/niche queries
   - Position 4-10: Common for moderate competition queries
   - "unranked": Use for highly competitive generic terms

4. **USE REAL COMPETITORS**: For topCompetitor, use actual competitor names from the area: ${competitorNames}

5. **LOCAL RELEVANCE**: Include search terms relevant to:
   - The specific neighborhood/area: ${hotel.address}
   - ${keywordFocus}
   - Local attractions or business districts near the hotel

Generate exactly 6 search rankings showing a mix of rankings (some ranked, some unranked) to give a realistic picture.`;

    const userPrompt = `Generate 6 search ranking entries for this hotel:

Hotel: ${hotel.name}
Address: ${hotel.address}
City: ${hotel.city}, ${hotel.state}
Rating: ${hotel.rating}/5
Price Level: ${hotel.priceLevel}
Service Type: ${serviceType}
Nearby Competitors: ${competitorNames}

Create realistic Google search rankings for queries travelers in ${hotel.city} would actually use. Include the city name "${hotel.city}" in each keyword.`;

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
              name: "return_rankings",
              description: "Return a list of search rankings for the hotel",
              parameters: {
                type: "object",
                properties: {
                  rankings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string", description: "The search query including the city name" },
                        position: { 
                          oneOf: [
                            { type: "number", description: "Ranking position 1-10" },
                            { type: "string", enum: ["unranked"], description: "Use 'unranked' if not in top 10" }
                          ]
                        },
                        topCompetitor: { type: "string", description: "Name of the top-ranking competitor for this keyword" }
                      },
                      required: ["keyword", "position", "topCompetitor"]
                    }
                  }
                },
                required: ["rankings"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_rankings" } }
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
    let rankings: SearchRanking[] = [];
    
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

    // Ensure we have exactly 6 rankings
    rankings = rankings.slice(0, 6);

    console.log(`Generated ${rankings.length} search rankings for ${hotel.city}`);

    return new Response(
      JSON.stringify({ rankings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-rankings function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
