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
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a hotel market analyst specializing in competitive set analysis. Your task is to find REAL, VERIFIED competitor hotels using current search data.

CRITICAL REQUIREMENTS:
1. ONLY return hotels that ACTUALLY EXIST with REAL, VERIFIED data from Google, TripAdvisor, or travel booking sites
2. DO NOT generate fake hotels, fake ratings, or estimated data
3. Every hotel must have a real street address that can be verified
4. Every rating and ranking must come from actual review platforms
5. If you cannot find real data for a hotel, DO NOT include it

Return ONLY a valid JSON array with hotels you found in your search. Each hotel must have:
- id: unique UUID
- name: EXACT real hotel name as listed on Google/TripAdvisor
- rating: REAL Google rating (verified from search results)
- tripadvisorRank: REAL TripAdvisor ranking in the city (from TripAdvisor search)
- starLevel: Official hotel star rating (2, 3, 4, or 5)
- distance: Actual distance in miles from subject hotel
- address: REAL street address
- city: city name
- state: state abbreviation
- locationType: Must match subject hotel location (${locationType})

STRICT MATCHING RULES:
1. SAME LOCATION TYPE ONLY: If subject is ${locationType}, only include ${locationType} hotels
2. SAME STAR LEVEL: Within 1 star of subject hotel
3. SAME SERVICE TYPE: ${hotelType} properties only
4. WITHIN 3 MILES: Must be close proximity competitors
5. REAL DATA ONLY: Skip any hotel where you cannot verify real ratings/rankings`
          },
          {
            role: 'user',
            content: `Search Google and TripAdvisor for REAL competitor hotels near:

Subject Hotel: ${hotel.name}
Address: ${hotel.address}
Location: ${hotel.city}, ${hotel.state}
Location Type: ${locationType}
Hotel Segment: ${hotelType}
Star Level: ${starLevel}
Price Level: ${hotel.priceLevel}

Find 6-8 REAL hotels that meet ALL these criteria:
1. Located in ${locationType} area of ${hotel.city} (MUST be same location type)
2. Similar ${starLevel} properties (within 1 star)
3. Same service type: ${hotelType}
4. Within 3 miles of ${hotel.address}
5. Have REAL verified ratings on Google and TripAdvisor

Search TripAdvisor for "${hotel.city} ${locationType} hotels" to find actual rankings.
Search Google Maps for "hotels near ${hotel.address}" to find nearby competitors.

Return ONLY hotels with VERIFIED real data. Order by TripAdvisor city ranking (best first).`
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
      // Return empty array instead of fallback - we only want real data
      console.log('No valid competitor data found, returning empty array');
      competitors = [];
    }

    // Filter out any competitors that don't have required real data fields
    competitors = competitors.filter((c: any) => {
      const hasRequiredData = c.name && c.address && typeof c.rating === 'number' && typeof c.tripadvisorRank === 'number';
      if (!hasRequiredData) {
        console.log(`Filtering out incomplete competitor: ${c.name || 'unknown'}`);
      }
      return hasRequiredData;
    });

    // Map competitors with real data only - don't fill in fake defaults
    competitors = competitors.map((c: any, index: number) => ({
      id: c.id || crypto.randomUUID(),
      name: c.name,
      rating: c.rating,
      tripadvisorRank: c.tripadvisorRank,
      starLevel: c.starLevel,
      rank: index + 1,
      distance: c.distance,
      address: c.address,
      city: c.city || hotel.city,
      state: c.state || hotel.state,
      locationType: c.locationType || locationType,
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

// Removed fallback function - we only use real data from Perplexity
