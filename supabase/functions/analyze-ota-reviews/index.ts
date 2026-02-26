import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  rating: number;
  reviewCount: number;
}

interface Competitor {
  id: string;
  name: string;
  rating: number;
  rank: number;
}

interface OTAReviewPlatformMetrics {
  platform: 'tripadvisor' | 'google_reviews' | 'yelp' | 'expedia' | 'booking' | 'agoda';
  platformType: 'review' | 'ota';
  hotelMetrics: {
    rating: number | null;
    reviewCount: number | null;
    responseRate: number | null;
    averageResponseTime: string;
    recentReviewSentiment: 'positive' | 'mixed' | 'negative';
    listingCompleteness: number | null;
    lastReviewDate: string;
    bookingRank?: number;
  };
  competitorAverage: {
    rating: number | null;
    reviewCount: number | null;
    responseRate: number | null;
    listingCompleteness: number | null;
  };
  rank: number;
  totalCompetitors: number;
  status: 'leading' | 'competitive' | 'behind' | 'not_listed';
  recommendation: string;
}

interface ScrapedPlatformData {
  platform: string;
  rating?: number;
  reviewCount?: number;
  url?: string;
  rawContent?: string;
}

type PlatformId = OTAReviewPlatformMetrics['platform'];

const PLATFORM_META: Record<PlatformId, { platformType: 'review' | 'ota'; label: string }> = {
  google_reviews: { platformType: 'review', label: 'Google Reviews' },
  tripadvisor: { platformType: 'review', label: 'TripAdvisor' },
  yelp: { platformType: 'review', label: 'Yelp' },
  booking: { platformType: 'ota', label: 'Booking.com' },
  expedia: { platformType: 'ota', label: 'Expedia' },
  agoda: { platformType: 'ota', label: 'Agoda' },
};

function parseNumberLike(input: string): number | null {
  // Handles: 25,956  | 25.956 | 25 956
  const cleaned = input.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractReviewCountFromText(text: string): number | null {
  // Prefer patterns that explicitly mention reviews.
  const patterns: RegExp[] = [
    /([0-9][0-9,\.\s]{0,12})\s+(?:guest\s+)?reviews?/i,
    /reviews?\s*\(?\s*([0-9][0-9,\.\s]{0,12})\s*\)?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const n = parseNumberLike(m[1]);
      if (n != null) return n;
    }
  }
  return null;
}

function extractRatingFromText(text: string, platform?: string): number | null {
  // Booking.com uses X.X / 10 scale
  if (platform === 'booking') {
    const bookingPatterns: RegExp[] = [
      /(?:scored?|rated?|rating)\s*[:\s]*(\d{1,2}(?:\.\d)?)\s*(?:\/\s*10|out\s+of\s+10)/i,
      /(\d{1,2}\.\d)\s*(?:\/\s*10|out\s+of\s+10)/i,
      /(?:review\s+score|guest\s+review)[:\s]*(\d{1,2}(?:\.\d)?)/i,
      /(?:scored?)\s+(\d{1,2}(?:\.\d)?)\s/i,
    ];
    for (const p of bookingPatterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0 && n <= 10) {
          // Convert to 5-point scale
          return Math.round((n / 2) * 10) / 10;
        }
      }
    }
  }

  const patterns: RegExp[] = [
    /([0-5](?:\.[0-9])?)\s*(?:\/\s*5|out\s+of\s+5|stars?)/i,
    /rated\s*([0-5](?:\.[0-9])?)\s*(?:\/\s*5|out\s+of\s+5|stars?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 5) return n;
    }
  }
  return null;
}

async function firecrawlScrapeMarkdown(url: string, firecrawlApiKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 1500,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl scrape failed', response.status, url);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    return typeof markdown === 'string' && markdown.length ? markdown : null;
  } catch (e) {
    console.error('Firecrawl scrape exception', url, e);
    return null;
  }
}

// Scrape a single OTA/review platform using Firecrawl
async function scrapeOTAPlatform(
  hotelName: string, 
  city: string, 
  state: string,
  platform: string,
  firecrawlApiKey: string
): Promise<ScrapedPlatformData | null> {
  const searchUrls: Record<string, string> = {
    tripadvisor: `https://www.tripadvisor.com/Search?q=${encodeURIComponent(`${hotelName} ${city} ${state}`)}`,
    booking: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${hotelName} ${city} ${state}`)}`,
    expedia: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(`${hotelName} ${city} ${state}`)}`,
    yelp: `https://www.yelp.com/search?find_desc=${encodeURIComponent(hotelName)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}`,
    google_reviews: `https://www.google.com/search?q=${encodeURIComponent(`${hotelName} ${city} ${state} reviews`)}`,
  };

  const url = searchUrls[platform];
  if (!url) return null;

  try {
    console.log(`Scraping ${platform} for ${hotelName}...`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
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
      console.error(`Firecrawl error for ${platform}:`, response.status);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || '';
    
    return {
      platform,
      rawContent: markdown.substring(0, 5000), // Limit content size
      url,
    };
  } catch (error) {
    console.error(`Error scraping ${platform}:`, error);
    return null;
  }
}

async function findPlatformListingUrls(
  hotel: Hotel,
  perplexityApiKey: string
): Promise<Partial<Record<PlatformId, string>>> {
  // We ask Perplexity for the direct listing URLs so Firecrawl can scrape the listing page (not search results).
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Return ONLY valid JSON (no markdown) with the best direct listing URL for each platform for the subject hotel.

Schema:
{
  "tripadvisor": "https://..." | null,
  "google_reviews": "https://..." | null,
  "yelp": "https://..." | null,
  "booking": "https://..." | null,
  "expedia": "https://..." | null,
  "agoda": "https://..." | null
}

Rules:
- Use the official platform domain for each URL.
- Prefer a hotel details/listing page (not generic search results), where rating + total reviews are visible.
- If you can't find a confident match, return null for that platform.`
        },
        {
          role: 'user',
          content: `Subject hotel:
Name: ${hotel.name}
Location: ${hotel.address}, ${hotel.city}, ${hotel.state}, ${hotel.country}

Find the direct listing URLs on TripAdvisor, Google reviews panel, Yelp, Booking.com, Expedia, and Agoda.`
        }
      ],
    }),
  });

  if (!response.ok) {
    console.error('Perplexity listing URL lookup failed:', response.status);
    return {};
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    console.error('Failed to parse listing URL JSON from Perplexity', e);
    return {};
  }
}

function deriveStatusFromRank(rank: number, totalCompetitors: number): OTAReviewPlatformMetrics['status'] {
  if (rank <= 2) return 'leading';
  if (rank <= Math.ceil(totalCompetitors / 2)) return 'competitive';
  return 'behind';
}

function buildPlatformResult(args: {
  platform: PlatformId;
  totalCompetitors: number;
  rating: number | null;
  reviewCount: number | null;
  listingFound: boolean;
}): OTAReviewPlatformMetrics {
  const { platform, totalCompetitors, rating, reviewCount, listingFound } = args;
  const platformType = PLATFORM_META[platform].platformType;
  const rank = listingFound ? Math.min(totalCompetitors, 1 + Math.floor(Math.random() * totalCompetitors)) : totalCompetitors;
  const status: OTAReviewPlatformMetrics['status'] = listingFound ? deriveStatusFromRank(rank, totalCompetitors) : 'not_listed';

  return {
    platform,
    platformType,
    hotelMetrics: {
      rating,
      reviewCount,
      responseRate: null,
      averageResponseTime: 'N/A',
      recentReviewSentiment: rating != null ? (rating >= 4 ? 'positive' : rating >= 3 ? 'mixed' : 'negative') : 'mixed',
      listingCompleteness: null,
      lastReviewDate: new Date().toISOString(),
      ...(platformType === 'ota' ? { bookingRank: null as unknown as number } : {}),
    },
    competitorAverage: {
      rating: null,
      reviewCount: null,
      responseRate: null,
      listingCompleteness: null,
    },
    rank,
    totalCompetitors,
    status,
    recommendation: listingFound
      ? `Verify your ${PLATFORM_META[platform].label} listing details and keep responses consistent to improve visibility.`
      : `We couldn't confidently find a ${PLATFORM_META[platform].label} listing for this hotel. If it exists, ensure it's claimed and correctly named/addressed.`,
  };
}

// Use Perplexity to analyze scraped content and extract metrics
async function analyzeWithPerplexity(
  hotel: Hotel,
  scrapedData: ScrapedPlatformData[],
  competitors: Competitor[],
  perplexityApiKey: string
): Promise<OTAReviewPlatformMetrics[]> {
  const totalCompetitors = (competitors?.length || 0) + 1;
  
  const scrapedContext = scrapedData
    .filter(d => d.rawContent)
    .map(d => `### ${d.platform.toUpperCase()} Data:\n${d.rawContent}`)
    .join('\n\n');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ota_platforms',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              required: ['platform', 'platformType', 'hotelMetrics', 'competitorAverage', 'rank', 'totalCompetitors', 'status', 'recommendation'],
              properties: {
                platform: { type: 'string' },
                platformType: { type: 'string' },
                listingUrl: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                hotelMetrics: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['rating', 'reviewCount', 'responseRate', 'averageResponseTime', 'recentReviewSentiment', 'listingCompleteness', 'lastReviewDate'],
                  properties: {
                    rating: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    reviewCount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    responseRate: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    averageResponseTime: { type: 'string' },
                    recentReviewSentiment: { type: 'string' },
                    listingCompleteness: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    lastReviewDate: { type: 'string' },
                    bookingRank: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  },
                },
                competitorAverage: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['rating', 'reviewCount', 'responseRate', 'listingCompleteness'],
                  properties: {
                    rating: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    reviewCount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    responseRate: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    listingCompleteness: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  },
                },
                rank: { type: 'number' },
                totalCompetitors: { type: 'number' },
                status: { type: 'string' },
                recommendation: { type: 'string' },
              },
            },
          },
        },
      },
      messages: [
        {
          role: 'system',
           content: `You are a hotel industry analyst. Extract REAL ratings and TOTAL review counts for the subject hotel by searching online.

Return ONLY a valid JSON array with platform data. Be accurate - only report data you can verify from the scraped content or your search.

[
   {
     "platform": "tripadvisor" | "google_reviews" | "yelp" | "expedia" | "booking" | "agoda",
     "platformType": "review" | "ota",
     "listingUrl": "<direct hotel listing/details url on that platform>" | null,
     "hotelMetrics": {
       "rating": <actual rating found, or null if not found>,
       "reviewCount": <actual TOTAL review count, or null if not found>,
       "responseRate": <estimated 0-100 or null>,
       "averageResponseTime": "Within 24 hours" | "Within 48 hours" | "Within a week" | "N/A",
       "recentReviewSentiment": "positive" | "mixed" | "negative",
       "listingCompleteness": <0-100 or null>,
       "lastReviewDate": "<ISO date or estimate>",
       "bookingRank": <for OTAs only or null>
     },
     "competitorAverage": {
       "rating": <local avg or null>,
       "reviewCount": <local avg or null>,
       "responseRate": <avg or null>,
       "listingCompleteness": <avg or null>
     },
     "rank": <1-${totalCompetitors}>,
     "totalCompetitors": ${totalCompetitors},
     "status": "leading" | "competitive" | "behind" | "not_listed",
     "recommendation": "<specific actionable advice>"
   }
]

Include all 6 platforms: TripAdvisor, Google Reviews, Yelp, Expedia, Booking.com, Agoda`
        },
        {
          role: 'user',
          content: `Analyze OTA and review platform presence for:

Hotel: ${hotel.name}
Location: ${hotel.city}, ${hotel.state}, ${hotel.country}
Known Rating: ${hotel.rating}/5 (${hotel.reviewCount} reviews)

SCRAPED DATA FROM PLATFORMS:
 ${scrapedContext || 'No scraped data available.'}

Please find their ACTUAL ratings and review counts on TripAdvisor, Google Reviews, Booking.com, Expedia, Yelp, and Agoda. Use the scraped data where available and search for additional information.`
        }
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // With response_format=json_schema, content should be strict JSON.
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse Perplexity response:', e);

    // Fallback: attempt to extract the first valid JSON array.
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = content.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // ignore
      }
    }
  }

  return [];
}

function reconcileWithScraped(platforms: OTAReviewPlatformMetrics[], scraped: ScrapedPlatformData[]): OTAReviewPlatformMetrics[] {
  const byPlatform = new Map(scraped.map(s => [s.platform, s] as const));
  return platforms.map((p) => {
    const s = byPlatform.get(p.platform);
    if (!s) return p;
    // Prefer deterministic scraped extraction for rating/reviewCount when available.
    const rating = s.rating ?? p.hotelMetrics?.rating ?? null;
    const reviewCount = s.reviewCount ?? p.hotelMetrics?.reviewCount ?? null;
    return {
      ...p,
      hotelMetrics: {
        ...p.hotelMetrics,
        rating,
        reviewCount,
      },
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };
    
    console.log('Analyzing OTA platforms with Firecrawl + Perplexity for:', hotel.name);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const totalCompetitors = (competitors?.length || 0) + 1;
    let platforms: OTAReviewPlatformMetrics[] = [];

     // Step 1: No pre-scraping. We first ask Perplexity for the direct listing URLs + counts,
     // then use Firecrawl to verify counts from those listing pages (when possible).
     const scrapedData: ScrapedPlatformData[] = [];

    // Step 2: Analyze with Perplexity (combining scraped data + web search)
    try {
       platforms = await analyzeWithPerplexity(hotel, scrapedData, competitors, PERPLEXITY_API_KEY);
       console.log(`Perplexity analysis returned ${platforms.length} platforms`);

       if (FIRECRAWL_API_KEY) {
         const withUrls = (platforms as Array<OTAReviewPlatformMetrics & { listingUrl?: string | null }>).
           map((p) => ({ platform: p.platform, url: p.listingUrl }))
           .filter((x): x is { platform: PlatformId; url: string } => typeof x.url === 'string' && x.url.startsWith('http'));

         // Keep runtime predictable: only verify the highest-impact platforms.
         const priority: PlatformId[] = ['google_reviews', 'tripadvisor', 'booking', 'expedia', 'yelp', 'agoda'];
         const MAX_SCRAPES = 5;
         const targets = withUrls
           .sort((a, b) => priority.indexOf(a.platform) - priority.indexOf(b.platform))
           .slice(0, MAX_SCRAPES);

         const CONCURRENCY = 5;
         for (let i = 0; i < targets.length; i += CONCURRENCY) {
           const batch = targets.slice(i, i + CONCURRENCY);
           const batchResults = await Promise.all(batch.map(async (t) => {
             const markdown = await firecrawlScrapeMarkdown(t.url, FIRECRAWL_API_KEY);
             if (!markdown) return null;
              return {
                platform: t.platform,
                url: t.url,
                rawContent: markdown.substring(0, 5000),
                rating: extractRatingFromText(markdown, t.platform) ?? undefined,
                reviewCount: extractReviewCountFromText(markdown) ?? undefined,
              } satisfies ScrapedPlatformData;
           }));
           for (const r of batchResults) {
             if (r) scrapedData.push(r);
           }
         }

         if (scrapedData.length) {
           platforms = reconcileWithScraped(platforms, scrapedData);
           console.log(`Verified counts from ${scrapedData.length} scraped listing pages`);
         }
       }
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

     // Step 3: Dedicated Booking.com verification via Perplexity if scraped data is missing
     const bookingScraped = scrapedData.find(s => s.platform === 'booking');
     const bookingPlatform = platforms.find(p => p.platform === 'booking');
     const bookingNeedsVerification = !bookingScraped?.rating && !bookingScraped?.reviewCount;
     
     if (bookingNeedsVerification && PERPLEXITY_API_KEY) {
       try {
         console.log('Running dedicated Booking.com lookup for', hotel.name);
         const bookingRes = await fetch('https://api.perplexity.ai/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             model: 'sonar',
             temperature: 0.1,
             messages: [
               {
                 role: 'system',
                 content: `Return ONLY valid JSON with the Booking.com data for the given hotel. Booking.com rates on a scale of 1-10.
Schema: { "rating_out_of_10": <number or null>, "review_count": <number or null>, "listing_url": "<url or null>", "search_position": <number or null> }
Only report data you can verify from Booking.com. If the hotel is not listed, return nulls.`,
               },
               {
                 role: 'user',
                 content: `Find the Booking.com listing for: ${hotel.name}, ${hotel.address}, ${hotel.city}, ${hotel.state}, ${hotel.country}. What is the guest review score (out of 10) and total number of reviews?`,
               },
             ],
           }),
         });

         if (bookingRes.ok) {
           const bookingData = await bookingRes.json();
           const bookingContent = bookingData.choices?.[0]?.message?.content || '';
           try {
             const parsed = JSON.parse(bookingContent);
             const ratingOut10 = parsed.rating_out_of_10;
             const reviewCount = parsed.review_count;
             const listingUrl = parsed.listing_url;
             const searchPosition = parsed.search_position;

             if (ratingOut10 != null || reviewCount != null) {
               const rating5 = ratingOut10 != null ? Math.round((ratingOut10 / 2) * 10) / 10 : null;
               console.log(`Booking.com verified: rating=${ratingOut10}/10 (${rating5}/5), reviews=${reviewCount}`);
               
               // Update the booking platform entry
               platforms = platforms.map(p => {
                 if (p.platform !== 'booking') return p;
                 const newRating = rating5 ?? p.hotelMetrics.rating;
                 const newReviewCount = reviewCount ?? p.hotelMetrics.reviewCount;
                 const listed = newRating != null || newReviewCount != null;
                 return {
                   ...p,
                   status: listed ? (p.status === 'not_listed' ? 'competitive' : p.status) : p.status,
                   hotelMetrics: {
                     ...p.hotelMetrics,
                     rating: newRating,
                     reviewCount: newReviewCount,
                     bookingRank: searchPosition ?? p.hotelMetrics.bookingRank,
                   },
                 };
               });
             }
           } catch { console.error('Failed to parse Booking.com dedicated lookup'); }
         }
       } catch (e) { console.error('Booking.com dedicated lookup error:', e); }
     }

      // If Perplexity didn't return all platforms OR returned questionable counts, fill remaining with non-fabricated placeholders.
      platforms = ensureAllPlatforms(platforms || [], totalCompetitors);

      // Final reconciliation (in case Perplexity missed a platform but scraping did find a count)
      if (scrapedData.length) {
        const byPlatform = new Map(scrapedData.map(s => [s.platform, s] as const));
        platforms = platforms.map((p) => {
          const s = byPlatform.get(p.platform);
          if (!s) return p;
          const rating = s.rating ?? p.hotelMetrics.rating;
          const reviewCount = s.reviewCount ?? p.hotelMetrics.reviewCount;
          const listingFound = Boolean(s.url);
          const status = listingFound ? p.status : (p.hotelMetrics.reviewCount == null && p.hotelMetrics.rating == null ? 'not_listed' : p.status);
          return {
            ...p,
            status,
            hotelMetrics: {
              ...p.hotelMetrics,
              rating,
              reviewCount,
            },
          };
        });
      }

    console.log('OTA analysis complete:', platforms.length, 'platforms analyzed');

    return new Response(JSON.stringify({ 
      success: true,
      platforms,
      scrapedPlatforms: scrapedData.map(d => d.platform),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-ota-reviews function:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ensureAllPlatforms(
  existingPlatforms: OTAReviewPlatformMetrics[],
  totalCompetitors: number
): OTAReviewPlatformMetrics[] {
  const allPlatformConfigs: Array<{
    platform: OTAReviewPlatformMetrics['platform'];
    platformType: 'review' | 'ota';
  }> = [
    { platform: 'google_reviews', platformType: 'review' },
    { platform: 'tripadvisor', platformType: 'review' },
    { platform: 'booking', platformType: 'ota' },
    { platform: 'expedia', platformType: 'ota' },
    { platform: 'yelp', platformType: 'review' },
    { platform: 'agoda', platformType: 'ota' },
  ];

  const existingPlatformNames = new Set(existingPlatforms.map(p => p.platform));
  const result = [...existingPlatforms];

  for (const config of allPlatformConfigs) {
    if (!existingPlatformNames.has(config.platform)) {
      // IMPORTANT: do not fabricate ratings/review counts; instead mark as not listed.
      result.push({
        platform: config.platform,
        platformType: config.platformType,
        hotelMetrics: {
          rating: null,
          reviewCount: null,
          responseRate: null,
          averageResponseTime: 'N/A',
          recentReviewSentiment: 'mixed',
          listingCompleteness: null,
          lastReviewDate: new Date().toISOString(),
          ...(config.platformType === 'ota' ? { bookingRank: undefined } : {}),
        },
        competitorAverage: {
          rating: null,
          reviewCount: null,
          responseRate: null,
          listingCompleteness: null,
        },
        rank: totalCompetitors,
        totalCompetitors,
        status: 'not_listed',
        recommendation: `We couldn't verify a listing with a reliable review count on ${PLATFORM_META[config.platform].label}.`,
      });
    }
  }

  return result;
}

function getRecommendation(platform: string, status: string): string {
  const recommendations: Record<string, Record<string, string>> = {
    google_reviews: {
      leading: 'Maintain your strong presence by continuing to respond promptly to all reviews.',
      competitive: 'Increase review volume by sending follow-up emails to recent guests.',
      behind: 'Focus on generating more reviews and improving response time to climb rankings.',
    },
    tripadvisor: {
      leading: 'Leverage your top ranking by adding more photos and updating your listing regularly.',
      competitive: 'Respond to all reviews within 24 hours to improve engagement metrics.',
      behind: 'Update your listing photos and description, and actively solicit guest reviews.',
    },
    yelp: {
      leading: 'Keep engaging with the Yelp community and respond to all reviews.',
      competitive: 'Add more business photos and ensure all amenity information is current.',
      behind: 'Claim and optimize your listing with complete information and high-quality photos.',
    },
    booking: {
      leading: 'Maintain Genius partner status and keep response times under 24 hours.',
      competitive: 'Improve listing photos and consider promotional rates to boost visibility.',
      behind: 'Complete all listing sections, add virtual tours, and optimize pricing strategy.',
    },
    expedia: {
      leading: 'Leverage your visibility with Expedia TravelAds for peak seasons.',
      competitive: 'Join Expedia Rewards and ensure all amenities are accurately listed.',
      behind: 'Optimize your listing content and consider participating in promotional programs.',
    },
    agoda: {
      leading: 'Maintain VIP Access partnership and continue responsive communication.',
      competitive: 'Add more room photos and detailed descriptions to improve conversion.',
      behind: 'Update all listing information and consider promotional pricing to boost ranking.',
    },
  };

  return recommendations[platform]?.[status] || 'Review and optimize your platform presence regularly.';
}
