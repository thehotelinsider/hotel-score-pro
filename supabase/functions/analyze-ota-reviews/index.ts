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
  const cleaned = input.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractReviewCountFromText(text: string): number | null {
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
  if (platform === 'booking') {
    const bookingPatterns: RegExp[] = [
      /(?:scored?|rated?|rating)\s*[:\s]*(\d{1,2}(?:\.\d)?)\s*(?:\/\s*10|out\s+of\s+10)/i,
      /(\d{1,2}\.\d)\s*(?:\/\s*10|out\s+of\s+10)/i,
      /(?:review\s+score|guest\s+review)[:\s]*(\d{1,2}(?:\.\d)?)/i,
      /(?:scored?)\s+(\d{1,2}(?:\.\d)?)\s/i,
      /(\d\.\d)\s*(?:Very Good|Superb|Exceptional|Good|Fabulous|Wonderful|Pleasant|Review score)/i,
      /(?:Very Good|Superb|Exceptional|Good|Fabulous|Wonderful|Pleasant)\s+(\d\.\d)/i,
    ];
    for (const p of bookingPatterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0 && n <= 10) {
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

// Generate fallback search URLs for platforms when Perplexity can't find direct listings
function generateFallbackUrls(hotel: Hotel): Partial<Record<PlatformId, string>> {
  const encodedName = encodeURIComponent(`${hotel.name} ${hotel.city} ${hotel.state}`);
  return {
    booking: `https://www.booking.com/searchresults.html?ss=${encodedName}`,
    expedia: `https://www.expedia.com/Hotel-Search?destination=${encodedName}`,
    yelp: `https://www.yelp.com/search?find_desc=${encodeURIComponent(hotel.name)}&find_loc=${encodeURIComponent(`${hotel.city}, ${hotel.state}`)}`,
    agoda: `https://www.agoda.com/search?searchText=${encodedName}`,
  };
}

// Step 1: Use Perplexity to find direct listing URLs for each platform
async function findPlatformListingUrls(
  hotel: Hotel,
  perplexityApiKey: string
): Promise<Partial<Record<PlatformId, string>>> {
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
- For Booking.com, look for URLs like: https://www.booking.com/hotel/us/hotel-name.html
- For Expedia, look for URLs like: https://www.expedia.com/Hotel-Name.hXXXXXXX.Hotel-Information
- For TripAdvisor, look for URLs like: https://www.tripadvisor.com/Hotel_Review-gXXXXX-dXXXXXXX-Reviews-Hotel_Name.html
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    
    // Fill in fallback URLs for any platforms that came back null
    const fallbacks = generateFallbackUrls(hotel);
    for (const [platform, fallbackUrl] of Object.entries(fallbacks)) {
      if (!parsed[platform]) {
        parsed[platform] = fallbackUrl;
        console.log(`Using fallback URL for ${platform}: ${fallbackUrl}`);
      }
    }
    
    return parsed;
  } catch (e) {
    console.error('Failed to parse listing URL JSON from Perplexity', e);
    return generateFallbackUrls(hotel);
  }
}

// Step 2: Scrape listing pages with Firecrawl and extract ratings/reviews
async function scrapeListingPages(
  listingUrls: Partial<Record<PlatformId, string>>,
  firecrawlApiKey: string
): Promise<ScrapedPlatformData[]> {
  const platforms = Object.entries(listingUrls)
    .filter((entry): entry is [PlatformId, string] => typeof entry[1] === 'string' && entry[1].startsWith('http'));

  const results: ScrapedPlatformData[] = [];

  // Scrape up to 6 in parallel
  const batchResults = await Promise.all(
    platforms.map(async ([platform, url]) => {
      console.log(`Scraping ${platform} listing: ${url}`);
      const markdown = await firecrawlScrapeMarkdown(url, firecrawlApiKey);
      if (!markdown) return null;

      const rating = extractRatingFromText(markdown, platform) ?? undefined;
      const reviewCount = extractReviewCountFromText(markdown) ?? undefined;

      console.log(`  ${platform} scraped: rating=${rating}, reviewCount=${reviewCount}`);

      return {
        platform,
        url,
        rawContent: markdown.substring(0, 5000),
        rating,
        reviewCount,
      } satisfies ScrapedPlatformData;
    })
  );

  for (const r of batchResults) {
    if (r) results.push(r);
  }

  return results;
}

// Step 3: Send scraped content to Perplexity for comprehensive analysis
async function analyzeWithPerplexity(
  hotel: Hotel,
  scrapedData: ScrapedPlatformData[],
  listingUrls: Partial<Record<PlatformId, string>>,
  competitors: Competitor[],
  perplexityApiKey: string
): Promise<OTAReviewPlatformMetrics[]> {
  const totalCompetitors = (competitors?.length || 0) + 1;

  // Build context from scraped data
  const scrapedContext = scrapedData
    .filter(d => d.rawContent)
    .map(d => {
      let header = `### ${d.platform.toUpperCase()} Data (from ${d.url || 'scrape'}):`;
      if (d.rating !== undefined) header += `\n  Extracted rating: ${d.rating}`;
      if (d.reviewCount !== undefined) header += `\n  Extracted review count: ${d.reviewCount}`;
      header += `\n${d.rawContent}`;
      return header;
    })
    .join('\n\n');

  // Build listing URL context
  const urlContext = Object.entries(listingUrls)
    .filter(([, url]) => url)
    .map(([platform, url]) => `  ${platform}: ${url}`)
    .join('\n');

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
          content: `You are a hotel industry analyst. Your task is to extract ACCURATE, VERIFIED ratings and review counts for the subject hotel on each platform.

CRITICAL RULES:
- Use the scraped listing page content as the PRIMARY source of truth for ratings and review counts.
- Cross-reference with your own knowledge to verify accuracy.
- For Booking.com: ratings are on a 1-10 scale. Convert to 5-point scale by dividing by 2.
- ONLY report data you can verify. Use null for any metric you cannot confirm.
- Do NOT fabricate or estimate ratings/review counts. If unsure, use null.

Return ONLY a valid JSON array with this structure:
[
   {
     "platform": "tripadvisor" | "google_reviews" | "yelp" | "expedia" | "booking" | "agoda",
     "platformType": "review" | "ota",
     "hotelMetrics": {
       "rating": <verified rating on 5-point scale, or null>,
       "reviewCount": <verified TOTAL review count, or null>,
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

Include all 6 platforms: TripAdvisor, Google Reviews, Yelp, Expedia, Booking.com, Agoda.`
        },
        {
          role: 'user',
          content: `Analyze OTA and review platform presence for:

Hotel: ${hotel.name}
Full Address: ${hotel.address}, ${hotel.city}, ${hotel.state}, ${hotel.country}
Google Places Rating: ${hotel.rating}/5 (${hotel.reviewCount} reviews)

LISTING URLs FOUND:
${urlContext || 'None found'}

SCRAPED LISTING PAGE CONTENT:
${scrapedContext || 'No scraped data available - please search for the hotel\'s actual ratings and review counts on each platform.'}

Using the scraped content above AND your own search capabilities, find the ACTUAL verified ratings and total review counts for "${hotel.name}" on each of the 6 platforms.`
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

  try {
    // Try parsing directly first
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: extract JSON array
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
  }

  return [];
}

// Reconcile: prefer scraped deterministic values over AI-reported ones
function reconcileWithScraped(platforms: OTAReviewPlatformMetrics[], scraped: ScrapedPlatformData[]): OTAReviewPlatformMetrics[] {
  const byPlatform = new Map(scraped.map(s => [s.platform, s] as const));
  return platforms.map((p) => {
    const s = byPlatform.get(p.platform);
    if (!s) return p;
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

function ensureAllPlatforms(
  existingPlatforms: OTAReviewPlatformMetrics[],
  totalCompetitors: number
): OTAReviewPlatformMetrics[] {
  const allPlatformConfigs: Array<{ platform: PlatformId; platformType: 'review' | 'ota' }> = [
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
        recommendation: `We couldn't verify a listing on ${PLATFORM_META[config.platform].label}.`,
      });
    }
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };

    console.log('Analyzing OTA platforms for:', hotel.name);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const totalCompetitors = (competitors?.length || 0) + 1;
    let platforms: OTAReviewPlatformMetrics[] = [];
    let scrapedData: ScrapedPlatformData[] = [];

    // ==========================================
    // 3-STEP PIPELINE FOR ACCURATE DATA
    // ==========================================

    // STEP 1: Use Perplexity to discover direct listing URLs
    console.log('Step 1: Finding listing URLs via Perplexity...');
    let listingUrls: Partial<Record<PlatformId, string>> = {};
    try {
      listingUrls = await findPlatformListingUrls(hotel, PERPLEXITY_API_KEY);
      const foundCount = Object.values(listingUrls).filter(Boolean).length;
      console.log(`Found ${foundCount} listing URLs:`, JSON.stringify(listingUrls));
    } catch (e) {
      console.error('Step 1 failed (listing URL discovery):', e);
    }

    // STEP 2: Scrape those listing pages with Firecrawl for real data
    if (FIRECRAWL_API_KEY && Object.keys(listingUrls).length > 0) {
      console.log('Step 2: Scraping listing pages with Firecrawl...');
      try {
        scrapedData = await scrapeListingPages(listingUrls, FIRECRAWL_API_KEY);
        console.log(`Scraped ${scrapedData.length} listing pages successfully`);
        for (const s of scrapedData) {
          console.log(`  ${s.platform}: rating=${s.rating}, reviewCount=${s.reviewCount}`);
        }
      } catch (e) {
        console.error('Step 2 failed (Firecrawl scraping):', e);
      }
    } else {
      console.log('Step 2: Skipped (no Firecrawl key or no URLs found)');
    }

    // STEP 3: Send scraped content + URLs to Perplexity for comprehensive analysis
    console.log('Step 3: Analyzing with Perplexity (with scraped data context)...');
    try {
      platforms = await analyzeWithPerplexity(hotel, scrapedData, listingUrls, competitors, PERPLEXITY_API_KEY);
      console.log(`Perplexity analysis returned ${platforms.length} platforms`);
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // STEP 4: Final reconciliation - prefer deterministic scraped values over AI
    if (scrapedData.length > 0) {
      platforms = reconcileWithScraped(platforms, scrapedData);
      console.log('Reconciled with scraped data');
    }

    // Ensure all 6 platforms are present
    platforms = ensureAllPlatforms(platforms, totalCompetitors);

    // Dedicated Booking.com verification if still missing
    // Always verify Booking.com data with a dedicated lookup
    const bookingPlatform = platforms.find(p => p.platform === 'booking');
    const bookingScraped = scrapedData.find(s => s.platform === 'booking');
    const bookingNeedsVerification = bookingPlatform &&
      (bookingPlatform.hotelMetrics.rating == null ||
       (!bookingScraped?.rating && !bookingScraped?.reviewCount));

    if (bookingNeedsVerification && PERPLEXITY_API_KEY) {
      try {
        console.log('Running dedicated Booking.com lookup...');
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
            const jsonMatch = bookingContent.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(bookingContent);
            const ratingOut10 = parsed.rating_out_of_10;
            const reviewCount = parsed.review_count;
            const searchPosition = parsed.search_position;

            if (ratingOut10 != null || reviewCount != null) {
              const rating5 = ratingOut10 != null ? Math.round((ratingOut10 / 2) * 10) / 10 : null;
              console.log(`Booking.com verified: rating=${ratingOut10}/10 (${rating5}/5), reviews=${reviewCount}`);

              platforms = platforms.map(p => {
                if (p.platform !== 'booking') return p;
                return {
                  ...p,
                  status: (rating5 != null || reviewCount != null) && p.status === 'not_listed' ? 'competitive' : p.status,
                  hotelMetrics: {
                    ...p.hotelMetrics,
                    rating: rating5 ?? p.hotelMetrics.rating,
                    reviewCount: reviewCount ?? p.hotelMetrics.reviewCount,
                    bookingRank: searchPosition ?? p.hotelMetrics.bookingRank,
                  },
                };
              });
            }
          } catch { console.error('Failed to parse Booking.com dedicated lookup'); }
        }
      } catch (e) { console.error('Booking.com dedicated lookup error:', e); }
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
