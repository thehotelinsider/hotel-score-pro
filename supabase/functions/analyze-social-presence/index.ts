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
  noDedicatedAccount?: boolean;
}

// Step 1: Use Perplexity to find social media profile URLs
async function findSocialProfileUrls(
  hotelName: string,
  city: string,
  state: string,
  apiKey: string
): Promise<{ urls: Record<string, string>; noDedicatedAccounts: string[] }> {
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
          content: `You find official social media profile URLs for specific hotel locations (NOT corporate/brand pages). Return ONLY valid JSON with this structure:
{
  "facebook": "<full facebook URL or null>",
  "instagram": "<full instagram URL or null>",
  "tiktok": "<full tiktok URL or null>",
  "youtube": "<full youtube URL or null>",
  "linkedin": "<full linkedin URL or null>",
  "no_dedicated_accounts": ["<platform names where you confirmed this specific hotel location does NOT have its own dedicated account, only corporate/brand pages exist>"]
}

IMPORTANT: Only include URLs for accounts that belong to this SPECIFIC hotel location. Do NOT include corporate brand pages (e.g. the main Marriott or Hilton page). Use null if unsure or not found. List platforms in "no_dedicated_accounts" where you can confirm the hotel has no location-specific social media presence.`
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
      const noDedicatedAccounts: string[] = parsed.no_dedicated_accounts || [];
      for (const [platform, url] of Object.entries(parsed)) {
        if (platform === 'no_dedicated_accounts') continue;
        if (url && typeof url === 'string' && url.startsWith('http')) {
          urls[platform] = url;
        }
      }
      console.log('Found profile URLs:', Object.keys(urls).join(', '));
      console.log('No dedicated accounts confirmed for:', noDedicatedAccounts.join(', ') || 'none');
      return { urls, noDedicatedAccounts };
    }
  } catch (e) {
    console.error('Failed to parse profile URLs:', e);
  }
  return { urls: {}, noDedicatedAccounts: [] };
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

// Step 4: Use AI (Lovable AI gateway) to synthesize all social media metrics
async function synthesizeSocialMetricsWithAI(
  hotel: Hotel,
  competitors: Competitor[],
  followerData: Record<string, { count: number | null; source: 'scraped' | 'searched' | 'estimated' }>,
  profileUrls: Record<string, string>,
  noDedicatedAccounts: string[],
  lovableApiKey: string
): Promise<SocialPlatformMetrics[]> {
  const totalCompetitors = (competitors?.length || 3) + 1;
  const competitorNames = competitors?.slice(0, 5).map(c => c.name).join(', ') || 'local competitors';
  const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];

  const followerSummary = allPlatforms.map(p => {
    const fd = followerData[p];
    return `${p}: ${fd?.count ?? 'unknown'} followers (source: ${fd?.source ?? 'none'}, has profile URL: ${!!profileUrls[p]})`;
  }).join('\n');

  const prompt = `You are a hotel social media analyst. Analyze the social media presence of "${hotel.name}" in ${hotel.city || 'unknown'}${hotel.state ? `, ${hotel.state}` : ''} compared to its competitors: ${competitorNames}.

Known follower data for "${hotel.name}":
${followerSummary}

Total competitors in analysis: ${totalCompetitors}

For each of the 5 platforms (facebook, instagram, tiktok, youtube, linkedin), provide realistic, data-informed estimates. Use the known follower counts where available, and make reasonable estimates for platforms where we have no data (mark those as "estimated"). 

Consider industry benchmarks for hospitality/hotels:
- Facebook: average hotel engagement 1.5-4%, posts 8-15/month
- Instagram: average hotel engagement 2-6%, posts 15-25/month
- TikTok: average hotel engagement 4-12%, posts 10-20/month
- YouTube: average hotel engagement 2-6%, posts 2-6/month
- LinkedIn: average hotel engagement 1-3%, posts 4-8/month

If a hotel has NO profile URL found and NO follower data, mark it as "inactive" status.
If a hotel has a profile, rank it 1-${totalCompetitors} where 1 is best. Base rank on known followers relative to typical competitors in this market.

Return ONLY valid JSON (no markdown) in this exact structure:
{
  "platforms": [
    {
      "platform": "facebook",
      "followers": <number>,
      "posts_per_month": <number>,
      "engagement_rate": <number like 2.4>,
      "last_post_days_ago": <number 1-60>,
      "content_types": ["photos", "events"],
      "competitor_avg_followers": <number>,
      "competitor_avg_posts": <number>,
      "competitor_avg_engagement": <number>,
      "rank": <1 to ${totalCompetitors}>,
      "status": "leading|competitive|behind|inactive",
      "recommendation": "<specific actionable recommendation for this hotel on this platform, 1-2 sentences>"
    }
  ]
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a hotel social media analyst. Return ONLY valid JSON, no markdown formatting, no code blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Lovable AI error:', response.status, errText);
      return buildFallbackMetrics(followerData, profileUrls, allPlatforms, totalCompetitors, noDedicatedAccounts);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    console.log('Lovable AI response length:', content.length);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return buildFallbackMetrics(followerData, profileUrls, allPlatforms, totalCompetitors, noDedicatedAccounts);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const aiPlatforms: any[] = parsed.platforms || [];

    return allPlatforms.map((platformName) => {
      const aiP = aiPlatforms.find((p: any) => p.platform === platformName);
      const fd = followerData[platformName];
      const isNoDedicatedAccount = noDedicatedAccounts.includes(platformName) && !profileUrls[platformName] && !fd?.count;

      if (isNoDedicatedAccount) {
        return {
          platform: platformName as SocialPlatformMetrics['platform'],
          hotelMetrics: {
            followers: 0,
            posts: 0,
            engagement: 0,
            lastPostDate: '',
            contentTypes: [],
          },
          competitorAverage: {
            followers: aiP?.competitor_avg_followers ?? 0,
            posts: aiP?.competitor_avg_posts ?? 0,
            engagement: aiP?.competitor_avg_engagement ?? 0,
          },
          rank: totalCompetitors,
          totalCompetitors,
          status: 'inactive' as const,
          recommendation: getDefaultRecommendation(platformName, 'inactive'),
          dataSource: 'estimated' as const,
          noDedicatedAccount: true,
        } as SocialPlatformMetrics;
      }

      // Prefer real scraped follower count over AI estimate
      const followers = (fd?.count != null) ? fd.count : (aiP?.followers ?? getEstimatedFollowers(platformName));
      const dataSource: 'scraped' | 'searched' | 'estimated' = fd?.source ?? 'estimated';

      const lastPostDaysAgo = aiP?.last_post_days_ago ?? 30;
      const lastPostDate = new Date(Date.now() - lastPostDaysAgo * 24 * 60 * 60 * 1000).toISOString();

      const status = (aiP?.status as SocialPlatformMetrics['status']) ?? 'behind';

      return {
        platform: platformName as SocialPlatformMetrics['platform'],
        hotelMetrics: {
          followers,
          posts: aiP?.posts_per_month ?? 8,
          engagement: aiP?.engagement_rate ?? 2.0,
          lastPostDate,
          contentTypes: aiP?.content_types ?? getContentTypes(platformName),
        },
        competitorAverage: {
          followers: aiP?.competitor_avg_followers ?? Math.round(followers * 1.2),
          posts: aiP?.competitor_avg_posts ?? 10,
          engagement: aiP?.competitor_avg_engagement ?? 2.5,
        },
        rank: aiP?.rank ?? totalCompetitors,
        totalCompetitors,
        status,
        recommendation: aiP?.recommendation ?? getDefaultRecommendation(platformName, status),
        dataSource,
        noDedicatedAccount: false,
      } as SocialPlatformMetrics;
    });

  } catch (e) {
    console.error('AI synthesis failed:', e);
    return buildFallbackMetrics(followerData, profileUrls, allPlatforms, totalCompetitors, noDedicatedAccounts);
  }
}

function buildFallbackMetrics(
  followerData: Record<string, { count: number | null; source: 'scraped' | 'searched' | 'estimated' }>,
  profileUrls: Record<string, string>,
  allPlatforms: string[],
  totalCompetitors: number,
  noDedicatedAccounts: string[] = []
): SocialPlatformMetrics[] {
  return allPlatforms.map((platform) => {
    const fd = followerData[platform];
    const isNoDedicatedAccount = noDedicatedAccounts.includes(platform) && !profileUrls[platform] && !fd?.count;

    if (isNoDedicatedAccount) {
      return {
        platform: platform as SocialPlatformMetrics['platform'],
        hotelMetrics: { followers: 0, posts: 0, engagement: 0, lastPostDate: '', contentTypes: [] },
        competitorAverage: { followers: 0, posts: 0, engagement: 0 },
        rank: totalCompetitors,
        totalCompetitors,
        status: 'inactive' as const,
        recommendation: getDefaultRecommendation(platform, 'inactive'),
        dataSource: 'estimated' as const,
        noDedicatedAccount: true,
      } as SocialPlatformMetrics;
    }

    const followers = fd?.count ?? getEstimatedFollowers(platform);
    const hasProfile = !!profileUrls[platform];
    const status: SocialPlatformMetrics['status'] = (!hasProfile && !fd?.count) ? 'inactive' : 'behind';
    return {
      platform: platform as SocialPlatformMetrics['platform'],
      hotelMetrics: {
        followers,
        posts: 8,
        engagement: 2.0,
        lastPostDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        contentTypes: getContentTypes(platform),
      },
      competitorAverage: {
        followers: Math.round(followers * 1.2),
        posts: 10,
        engagement: 2.5,
      },
      rank: totalCompetitors,
      totalCompetitors,
      status,
      recommendation: getDefaultRecommendation(platform, status),
      dataSource: fd?.source ?? 'estimated',
      noDedicatedAccount: false,
    } as SocialPlatformMetrics;
  });
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const allPlatforms: Array<'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin'> =
      ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];

    // Step 1: Find social media profile URLs
    const { urls: profileUrls, noDedicatedAccounts } = await findSocialProfileUrls(
      hotel.name,
      hotel.city || 'unknown',
      hotel.state || '',
      PERPLEXITY_API_KEY
    );

    // Step 2: Scrape found profiles with Firecrawl (in parallel)
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
        const count = extractFollowerCount(markdown, platform);
        if (count) {
          followerCounts[platform] = { count, source: 'scraped' };
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
        }
      } catch (e) {
        console.error('Perplexity search fallback failed:', e);
      }
    }

    // Step 5: Use Lovable AI to synthesize complete, intelligent metrics for all platforms
    console.log('Synthesizing social metrics with Lovable AI...');
    const platforms = await synthesizeSocialMetricsWithAI(
      hotel,
      competitors,
      followerCounts,
      profileUrls,
      noDedicatedAccounts,
      LOVABLE_API_KEY
    );

    console.log('Social analysis complete:', platforms.map(p => `${p.platform}: ${p.hotelMetrics.followers} followers, rank ${p.rank}/${p.totalCompetitors} (${p.status})`).join(' | '));

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
  // Use a deterministic middle value instead of random
  return Math.round((min + max) / 2);
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

function getDefaultRecommendation(platform: string, status: string): string {
  const recommendations: Record<string, Record<string, string>> = {
    facebook: {
      leading: 'Maintain posting frequency and leverage Facebook Events for local promotions.',
      competitive: 'Increase posting to 3x per week and boost high-performing posts.',
      behind: 'Revamp content strategy with more video content and guest stories.',
      inactive: 'Create a Facebook page and start with 2-3 posts per week to establish a presence.',
    },
    instagram: {
      leading: 'Continue creating engaging Reels and Stories to maintain top positioning.',
      competitive: 'Post daily Stories and increase Reels content for better reach.',
      behind: 'Focus on high-quality visuals and collaborate with local travel influencers.',
      inactive: 'Set up an Instagram Business account and post daily photos of amenities and local attractions.',
    },
    tiktok: {
      leading: 'Keep experimenting with trending sounds and challenges relevant to travel.',
      competitive: 'Increase posting frequency to 5+ videos per week to grow faster.',
      behind: 'Start with behind-the-scenes content and staff spotlights to humanize the brand.',
      inactive: 'Create a TikTok account to reach younger travelers with short, engaging property videos.',
    },
    youtube: {
      leading: 'Create longer-form content like full property tours and local area guides.',
      competitive: 'Optimize video SEO with local keywords and create room tour playlists.',
      behind: 'Start with a professional property tour video and local neighborhood guide.',
      inactive: 'Launch a YouTube channel with a hotel tour video to support direct bookings.',
    },
    linkedin: {
      leading: 'Share industry thought leadership and highlight staff achievements.',
      competitive: 'Post more company culture content and engage with local business community.',
      behind: 'Focus on corporate travel audience with business amenities showcases.',
      inactive: 'Create a LinkedIn company page to attract corporate travelers and B2B partnerships.',
    },
  };
  return recommendations[platform]?.[status] ?? 'Improve your social media presence on this platform.';
}
