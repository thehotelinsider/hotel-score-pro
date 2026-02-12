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

function classifyHotel(hotel: Hotel) {
  const nameLower = hotel.name.toLowerCase();
  const addressLower = hotel.address.toLowerCase();

  let locationType = 'general area';
  if (nameLower.includes('downtown') || addressLower.includes('downtown') ||
      addressLower.includes('city center') || addressLower.includes('main st')) {
    locationType = 'downtown/city center';
  } else if (nameLower.includes('airport') || addressLower.includes('airport')) {
    locationType = 'airport area';
  } else if (nameLower.includes('convention') || addressLower.includes('convention')) {
    locationType = 'convention center area';
  } else if (addressLower.includes('interstate') || addressLower.match(/i-\d+/) || addressLower.includes('highway')) {
    locationType = 'highway/interstate corridor';
  } else if (nameLower.includes('resort') || nameLower.includes('spa')) {
    locationType = 'resort/destination area';
  }

  let hotelType = 'select-service hotel';
  let starLevel = '3-star';
  if (nameLower.includes('residence inn') || nameLower.includes('homewood') ||
      nameLower.includes('staybridge') || nameLower.includes('extended stay') ||
      nameLower.includes('towneplace') || nameLower.includes('candlewood')) {
    hotelType = 'extended-stay hotel with suites and kitchens';
    starLevel = '3-star extended-stay';
  } else if (nameLower.includes('ritz') || nameLower.includes('four seasons') ||
             nameLower.includes('waldorf') || nameLower.includes('st. regis') ||
             hotel.priceLevel === '$$$$') {
    hotelType = 'luxury full-service hotel';
    starLevel = '5-star luxury';
  } else if (nameLower.includes('marriott hotel') || nameLower.includes('hilton hotel') ||
             nameLower.includes('sheraton') || nameLower.includes('hyatt regency') ||
             nameLower.includes('westin') || nameLower.includes('renaissance')) {
    hotelType = 'full-service hotel with restaurant and meeting rooms';
    starLevel = '4-star full-service';
  } else if (nameLower.includes('courtyard') || nameLower.includes('hampton') ||
             nameLower.includes('hilton garden') || nameLower.includes('holiday inn express') ||
             nameLower.includes('fairfield')) {
    hotelType = 'select-service hotel';
    starLevel = '3-star select-service';
  } else if (nameLower.includes('la quinta') || nameLower.includes('comfort inn') ||
             nameLower.includes('best western') || nameLower.includes('days inn') ||
             nameLower.includes('super 8') || hotel.priceLevel === '$') {
    hotelType = 'economy/budget hotel';
    starLevel = '2-star economy';
  }

  return { locationType, hotelType, starLevel };
}

async function scrapeTripAdvisorPage(url: string, firecrawlKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl scrape failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || null;
  } catch (err) {
    console.error('Firecrawl error:', err);
    return null;
  }
}

serve(async (req) => {
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

    console.log(`Finding competitors with TripAdvisor Travelers' Choice rankings for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const { locationType, hotelType, starLevel } = classifyHotel(hotel);
    console.log(`Classification: ${locationType}, ${hotelType}, ${starLevel}`);

    // Step 1: Use Perplexity to find the subject hotel's TripAdvisor page and competitors
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: `You are a hotel market analyst. Find REAL TripAdvisor Travelers' Choice rankings and competitor data.

ABSOLUTELY CRITICAL: Every hotel you return MUST be a REAL, currently operational hotel that EXISTS today and can be booked online (on Booking.com, Expedia, Marriott.com, Hilton.com, etc.). 
- Do NOT invent, fabricate, or guess hotel names. 
- Do NOT combine a brand name with a location to create a hotel that doesn't exist (e.g., "TownePlace Suites Downtown Knoxville" does NOT exist — do not include it).
- If you are not 100% certain a hotel exists and is currently open for business, DO NOT include it.
- Use only hotels you can verify from real TripAdvisor listings, Google Maps, or OTA search results.

Return ONLY valid JSON with this structure:
{
  "subjectHotel": {
    "tripadvisorUrl": "<TripAdvisor URL for the subject hotel>",
    "tripadvisorRank": <number - Travelers' Choice rank in the city, e.g. #5 of 120 hotels>,
    "totalHotelsInCity": <total hotels on TripAdvisor in this city>
  },
  "competitors": [
    {
      "name": "<exact real hotel name as listed on TripAdvisor or Google>",
      "tripadvisorUrl": "<real TripAdvisor URL that resolves to this hotel's page>",
      "tripadvisorRank": <Travelers' Choice rank in the city>,
      "starLevel": <2-5>,
      "rating": <Google rating 1-5>,
      "distance": <miles from subject hotel>,
      "address": "<real street address>",
      "city": "<city>",
      "state": "<state>",
      "locationType": "<downtown/airport/highway/suburban/resort>"
    }
  ]
}

CRITICAL RULES:
1. ONLY include hotels that ACTUALLY EXIST and are CURRENTLY OPEN for business — verify each one
2. ONLY include hotels in the SAME sub-market/location type as the subject hotel
3. ONLY include hotels with similar star level (within 1 star)
4. ONLY include hotels within 5 miles
5. Use REAL TripAdvisor Travelers' Choice rankings (the "# of N hotels" ranking on TripAdvisor)
6. Include exactly 4 competitors (no more, no less)
7. Sort by TripAdvisor Travelers' Choice rank (best first)
8. Use the EXACT hotel name as it appears on TripAdvisor or Google — do not paraphrase or fabricate names`
          },
          {
            role: 'user',
            content: `Find the TripAdvisor Travelers' Choice ranking for "${hotel.name}" at ${hotel.address}, ${hotel.city}, ${hotel.state}.

Then find exactly 4 REAL competitor hotels that are:
1. In the ${locationType} area (same sub-market/neighborhood)
2. Similar to ${starLevel} (${hotelType})
3. Within 5 miles of the subject hotel
4. Ranked by their TripAdvisor Travelers' Choice position in ${hotel.city}
5. VERIFIED to exist and be currently operational — each hotel must be bookable on major OTAs or brand websites

IMPORTANT: Do NOT fabricate hotel names. Every competitor must be a real, operating property with a verifiable TripAdvisor listing. Include each hotel's real TripAdvisor URL and Travelers' Choice rank.`
          }
        ],
      }),
    });

    if (!perplexityResponse.ok) {
      if (perplexityResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];
    console.log('Perplexity response received, citations:', citations.length);

    // Parse the Perplexity response
    let parsedData: any = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
    }

    let competitors: Competitor[] = [];
    let subjectHotelTAUrl: string | null = null;
    let subjectHotelTARank: number | null = null;

    if (parsedData) {
      subjectHotelTAUrl = parsedData.subjectHotel?.tripadvisorUrl || null;
      subjectHotelTARank = parsedData.subjectHotel?.tripadvisorRank || null;

      competitors = (parsedData.competitors || []).map((c: any, index: number) => ({
        id: crypto.randomUUID(),
        name: c.name || `Competitor ${index + 1}`,
        rating: typeof c.rating === 'number' ? c.rating : 4.0,
        tripadvisorRank: typeof c.tripadvisorRank === 'number' ? c.tripadvisorRank : null,
        starLevel: typeof c.starLevel === 'number' ? c.starLevel : 3,
        rank: index + 1,
        distance: typeof c.distance === 'number' ? c.distance : (index + 1) * 0.5,
        address: c.address || '',
        city: c.city || hotel.city,
        state: c.state || hotel.state,
        locationType: c.locationType || locationType,
        tripadvisorUrl: c.tripadvisorUrl || null,
      }));
    }

    // Step 2: Use Firecrawl to verify TripAdvisor rankings from actual pages
    if (FIRECRAWL_API_KEY && (subjectHotelTAUrl || competitors.some((c: any) => c.tripadvisorUrl))) {
      console.log('Verifying TripAdvisor rankings via Firecrawl...');

      // Scrape subject hotel's TripAdvisor page
      if (subjectHotelTAUrl) {
        const subjectMarkdown = await scrapeTripAdvisorPage(subjectHotelTAUrl, FIRECRAWL_API_KEY);
        if (subjectMarkdown) {
          // Extract rank from TripAdvisor page content (e.g., "#5 of 120 hotels")
          const rankMatch = subjectMarkdown.match(/#(\d+)\s+of\s+\d+\s+hotel/i);
          if (rankMatch) {
            subjectHotelTARank = parseInt(rankMatch[1]);
            console.log(`Verified subject hotel TripAdvisor rank: #${subjectHotelTARank}`);
          }
        }
      }

      // Scrape top competitor TripAdvisor pages in parallel (limit to 4 to avoid rate limits)
      const scrapePromises = competitors
        .filter((c: any) => c.tripadvisorUrl)
        .slice(0, 4)
        .map(async (comp: any) => {
          const markdown = await scrapeTripAdvisorPage(comp.tripadvisorUrl, FIRECRAWL_API_KEY);
          if (markdown) {
            const rankMatch = markdown.match(/#(\d+)\s+of\s+\d+\s+hotel/i);
            if (rankMatch) {
              comp.tripadvisorRank = parseInt(rankMatch[1]);
              console.log(`Verified ${comp.name} TripAdvisor rank: #${comp.tripadvisorRank}`);
            }
            // Also try to extract rating
            const ratingMatch = markdown.match(/(\d\.\d)\s+of\s+5\s+bubbles/i) ||
                                markdown.match(/(\d\.\d)\s+out\s+of\s+5/i);
            if (ratingMatch) {
              comp.rating = parseFloat(ratingMatch[1]);
            }
          }
        });

      await Promise.all(scrapePromises);
    }

    // Sort competitors by TripAdvisor Travelers' Choice rank (primary), then star level, then Google rating
    competitors = competitors
      .sort((a: any, b: any) => {
        const aRank = a.tripadvisorRank ?? 999;
        const bRank = b.tripadvisorRank ?? 999;
        if (aRank !== bRank) return aRank - bRank;
        if ((b.starLevel || 3) !== (a.starLevel || 3)) return (b.starLevel || 3) - (a.starLevel || 3);
        return b.rating - a.rating;
      })
      .map((c, index) => ({ ...c, rank: index + 1 }))
      .slice(0, 4);

    // Attach the subject hotel's TripAdvisor rank to the response
    console.log(`Found ${competitors.length} competitors. Subject hotel TA rank: ${subjectHotelTARank}`);

    return new Response(
      JSON.stringify({
        competitors,
        citations,
        subjectHotelTripadvisorRank: subjectHotelTARank,
      }),
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
