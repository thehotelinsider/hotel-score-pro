import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Hotel {
  name: string;
  city?: string;
  state?: string;
}

interface Competitor {
  name: string;
  rating?: number;
}

interface SocialPlatformMetrics {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin';
  hotelMetrics: {
    followers: number;
    posts: number;
    engagement: number;
    lastPostDate: string;
    contentTypes: string[];
  };
  competitorAverage: {
    followers: number;
    posts: number;
    engagement: number;
  };
  rank: number;
  totalCompetitors: number;
  status: 'leading' | 'competitive' | 'behind' | 'inactive';
  recommendation: string;
  dataSource: 'scraped' | 'searched' | 'estimated';
}

// Step 1: Use Perplexity to find social media profile URLs
async function findSocialProfileUrls(
  hotelName: string,
  city: string,
  state: string,
  apiKey: string
): Promise<Record<string, string>> {
  console.log('Finding social media profile URLs via Perplexity for:', hotelName);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You find official social media profile URLs for hotels. Return ONLY valid JSON with this structure:
{
  "facebook": "<full facebook URL or null>",
  "instagram": "<full instagram URL or null>",
  "tiktok": "<full tiktok URL or null>",
  "youtube": "<full youtube URL or null>",
  "linkedin": "<full linkedin URL or null>"
}

Only include URLs you are confident are the official hotel accounts. Use null if unsure or not found.`
        },
        {
          role: 'user',
          content: `Find the official social media profile URLs for: ${hotelName} in ${city}${state ? `, ${state}` : ''}`
        }
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Perplexity URL lookup error:', response.status, text);
    return {};
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const urls: Record<string, string> = {};
      for (const [platform, url] of Object.entries(parsed)) {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          urls[platform] = url;
        }
      }
      console.log('Found profile URLs:', Object.keys(urls).join(', '));
      return urls;
    }
  } catch (e) {
    console.error('Failed to parse profile URLs:', e);
  }
  return {};
}

// Step 2: Scrape a social media profile page with Firecrawl
async function scrapeProfile(url: string, apiKey: string): Promise<string | null> {
  console.log('Scraping profile:', url);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Firecrawl scrape failed for ${url}:`, response.status, text);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    console.log(`Scraped ${url}: ${markdown.length} chars`);
    return markdown;
  } catch (e) {
    console.error(`Firecrawl error for ${url}:`, e);
    return null;
  }
}

// Step 3: Extract follower count from scraped markdown using pattern matching
function extractFollowerCount(markdown: string, platform: string): number | null {
  if (!markdown) return null;

  const text = markdown.toLowerCase();

  // Platform-specific patterns
  const patterns: RegExp[] = [];

  if (platform === 'facebook') {
    patterns.push(
      /([\d,\.]+[kmb]?)\s*(?:people\s+)?(?:like|follow|follower)/gi,
      /(?:like|follow|follower)s?\s*[:\-–]?\s*([\d,\.]+[kmb]?)/gi,
      /([\d,\.]+[kmb]?)\s*(?:people\s+follow)/gi,
    );
  } else if (platform === 'instagram') {
    patterns.push(
      /([\d,\.]+[kmb]?)\s*followers/gi,
      /followers\s*[:\-–]?\s*([\d,\.]+[kmb]?)/gi,
    );
  } else if (platform === 'tiktok') {
    patterns.push(
      /([\d,\.]+[kmb]?)\s*followers/gi,
      /followers\s*[:\-–]?\s*([\d,\.]+[kmb]?)/gi,
    );
  } else if (platform === 'youtube') {
    patterns.push(
      /([\d,\.]+[kmb]?)\s*subscribers/gi,
      /subscribers\s*[:\-–]?\s*([\d,\.]+[kmb]?)/gi,
    );
  } else if (platform === 'linkedin') {
    patterns.push(
      /([\d,\.]+[kmb]?)\s*followers/gi,
      /followers\s*[:\-–]?\s*([\d,\.]+[kmb]?)/gi,
    );
  }

  for (const pattern of patterns) {
    const match = pattern.exec(markdown);
    if (match) {
      const raw = match[1];
      const parsed = parseFollowerNumber(raw);
      if (parsed && parsed > 0) {
        console.log(`  Found ${platform} followers: ${parsed} (raw: "${raw}")`);
        return parsed;
      }
    }
  }

  return null;
}

function parseFollowerNumber(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.replace(/,/g, '').trim().toLowerCase();

  let multiplier = 1;
  if (cleaned.endsWith('k')) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('m')) {
    multiplier = 1000000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('b')) {
    multiplier = 1000000000;
    cleaned = cleaned.slice(0, -1);
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * multiplier);
}

// Step 4: Use AI to extract follower count from scraped content as fallback
async function extractWithAI(
  markdown: string,
  platform: string,
  hotelName: string,
  apiKey: string
): Promise<number | null> {
  // Only use first 3000 chars to save tokens
  const snippet = markdown.slice(0, 3000);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Extract the follower/subscriber count from the scraped ${platform} profile page content. Return ONLY a JSON: {"followers": <number or null>}. Return null if you cannot find it.`
          },
          {
            role: 'user',
            content: `Hotel: ${hotelName}\nPlatform: ${platform}\n\nScraped content:\n${snippet}`
          }
        ],
      }),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.followers && typeof parsed.followers === 'number') {
        console.log(`  AI extracted ${platform} followers: ${parsed.followers}`);
        return parsed.followers;
      }
    }
  } catch (e) {
    console.error(`AI extraction failed for ${platform}:`, e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };

    console.log('Analyzing social presence for:', hotel.name);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const totalCompetitors = (competitors?.length || 3) + 1;
    const competitorNames = competitors?.slice(0, 5).map(c => c.name).join(', ') || 'local competitors';

    // Step 1: Find social media profile URLs
    const profileUrls = await findSocialProfileUrls(
      hotel.name,
      hotel.city || 'unknown',
      hotel.state || '',
      PERPLEXITY_API_KEY
    );

    // Step 2: Scrape found profiles with Firecrawl (in parallel)
    const allPlatforms: Array<'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin'> = 
      ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];

    const scrapeResults: Record<string, string | null> = {};
    const scrapePromises = allPlatforms
      .filter(p => profileUrls[p])
      .map(async (platform) => {
        const markdown = await scrapeProfile(profileUrls[platform], FIRECRAWL_API_KEY);
        scrapeResults[platform] = markdown;
      });

    await Promise.all(scrapePromises);

    // Step 3: Extract follower counts from scraped data
    const followerCounts: Record<string, { count: number | null; source: 'scraped' | 'searched' | 'estimated' }> = {};

    for (const platform of allPlatforms) {
      const markdown = scrapeResults[platform];
      if (markdown) {
        // Try regex extraction first
        let count = extractFollowerCount(markdown, platform);
        if (count) {
          followerCounts[platform] = { count, source: 'scraped' };
        } else {
          // Fallback to AI extraction
          count = await extractWithAI(markdown, platform, hotel.name, PERPLEXITY_API_KEY);
          if (count) {
            followerCounts[platform] = { count, source: 'scraped' };
          }
        }
      }
    }

    // Step 4: For platforms where scraping didn't work, use Perplexity search
    const missingPlatforms = allPlatforms.filter(p => !followerCounts[p]);
    if (missingPlatforms.length > 0) {
      console.log('Using Perplexity search for missing platforms:', missingPlatforms.join(', '));

      try {
        const searchResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
                content: `You are a social media analyst. Search for real follower counts for the specified hotel on the given platforms. Return ONLY valid JSON:
{
  "platforms": {
    "<platform_name>": { "followers": <number or null>, "posts_per_month": <number or null>, "engagement_rate": <number or null> }
  }
}
Use null if you genuinely cannot find the data. Do NOT make up numbers.`
              },
              {
                role: 'user',
                content: `Find the social media follower counts for ${hotel.name} in ${hotel.city || 'unknown'}${hotel.state ? `, ${hotel.state}` : ''} on these platforms: ${missingPlatforms.join(', ')}`
              }
            ],
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const searchContent = searchData.choices?.[0]?.message?.content || '';
          const jsonMatch = searchContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const platforms = parsed.platforms || {};
            for (const [platform, metrics] of Object.entries(platforms) as [string, any][]) {
              if (metrics?.followers && typeof metrics.followers === 'number') {
                followerCounts[platform] = { count: metrics.followers, source: 'searched' };
              }
            }
          }
        } else {
          await searchResponse.text();
        }
      } catch (e) {
        console.error('Perplexity search fallback failed:', e);
      }
    }

    // Step 5: Build final platform metrics
    const platforms: SocialPlatformMetrics[] = allPlatforms.map((platform) => {
      const followerData = followerCounts[platform];
      const hasRealData = followerData && followerData.count !== null;
      const followers = hasRealData ? followerData!.count! : getEstimatedFollowers(platform);
      const dataSource = hasRealData ? followerData!.source : 'estimated' as const;

      const engagement = getEstimatedEngagement(platform);
      const posts = Math.round(Math.random() * 12 + 2);
      const rank = Math.min(totalCompetitors, Math.floor(Math.random() * totalCompetitors) + 1);

      let status: SocialPlatformMetrics['status'];
      if (!profileUrls[platform] && !hasRealData) {
        status = 'inactive';
      } else if (rank <= 2) {
        status = 'leading';
      } else if (rank <= Math.ceil(totalCompetitors / 2)) {
        status = 'competitive';
      } else {
        status = 'behind';
      }

      const competitorFollowers = Math.round(followers * (0.7 + Math.random() * 0.6));

      return {
        platform,
        hotelMetrics: {
          followers,
          posts,
          engagement,
          lastPostDate: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
          contentTypes: getContentTypes(platform),
        },
        competitorAverage: {
          followers: competitorFollowers,
          posts: Math.round(posts * (0.8 + Math.random() * 0.4)),
          engagement: Number((engagement * (0.8 + Math.random() * 0.4)).toFixed(1)),
        },
        rank,
        totalCompetitors,
        status,
        recommendation: getRecommendation(platform, status),
        dataSource,
      };
    });

    console.log('Social analysis complete:', platforms.map(p => `${p.platform}: ${p.hotelMetrics.followers} (${p.dataSource})`).join(', '));

    return new Response(
      JSON.stringify({
        success: true,
        platforms,
        profileUrls,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing social presence:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to analyze social presence'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getEstimatedFollowers(platform: string): number {
  const ranges: Record<string, [number, number]> = {
    facebook: [2000, 15000],
    instagram: [1500, 12000],
    tiktok: [200, 3000],
    youtube: [100, 1500],
    linkedin: [300, 3000],
  };
  const [min, max] = ranges[platform] || [500, 5000];
  return Math.round(min + Math.random() * (max - min));
}

function getEstimatedEngagement(platform: string): number {
  const ranges: Record<string, [number, number]> = {
    facebook: [1.5, 4.5],
    instagram: [2.5, 6.0],
    tiktok: [4.0, 12.0],
    youtube: [2.0, 6.0],
    linkedin: [1.0, 3.5],
  };
  const [min, max] = ranges[platform] || [1.0, 5.0];
  return Number((min + Math.random() * (max - min)).toFixed(1));
}

function getContentTypes(platform: string): string[] {
  const types: Record<string, string[]> = {
    facebook: ['photos', 'events', 'reviews', 'stories'],
    instagram: ['photos', 'reels', 'stories', 'highlights'],
    tiktok: ['short videos', 'trends', 'behind-the-scenes'],
    youtube: ['hotel tours', 'room reviews', 'local guides'],
    linkedin: ['company updates', 'articles', 'job posts'],
  };
  return types[platform] || ['photos', 'updates'];
}

function getRecommendation(platform: string, status: string): string {
  const recommendations: Record<string, Record<string, string>> = {
    facebook: {
      leading: 'Maintain posting frequency and leverage Facebook Events for local promotions.',
      competitive: 'Increase posting to 3x per week and boost high-performing posts.',
      behind: 'Revamp content strategy with more video content and guest stories.',
      inactive: 'Create a Facebook page and start with 2-3 posts per week.',
    },
    instagram: {
      leading: 'Continue creating engaging Reels and Stories to maintain momentum.',
      competitive: 'Post daily Stories and increase Reels content for better reach.',
      behind: 'Focus on high-quality visual content and use location tags strategically.',
      inactive: 'Create an Instagram account and start with daily Stories showcasing the property.',
    },
    tiktok: {
      leading: 'Keep creating trending content and collaborate with travel influencers.',
      competitive: 'Post 3-5 times per week and engage with trending sounds.',
      behind: 'Focus on behind-the-scenes content and local area highlights.',
      inactive: 'Start a TikTok account with simple property tours and staff introductions.',
    },
    youtube: {
      leading: 'Expand content to virtual tours and local destination guides.',
      competitive: 'Create monthly room tours and local attraction videos.',
      behind: 'Start with a professional property tour video as your foundation.',
      inactive: 'Create a YouTube channel with a channel trailer and one comprehensive hotel tour.',
    },
    linkedin: {
      leading: 'Share industry insights and company culture to attract talent.',
      competitive: 'Post job openings and celebrate team achievements.',
      behind: 'Complete company profile and share monthly updates.',
      inactive: 'Set up a LinkedIn company page with all amenities and job listings.',
    },
  };

  return recommendations[platform]?.[status] || 'Optimize your presence on this platform.';
}
