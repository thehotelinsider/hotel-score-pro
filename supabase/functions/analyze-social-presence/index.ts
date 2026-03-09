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
  accountCount?: number;
}

type PlatformId = SocialPlatformMetrics['platform'];
const ALL_PLATFORMS: PlatformId[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];

interface PlatformResult {
  hasAccount: boolean;
  accountCount: number;
  isRecentlyActive: boolean;
  profileUrl: string | null;
}

/**
 * Use Perplexity sonar-pro WITHOUT a domain filter to do a Google-style web search.
 * We search using "site:facebook.com" style queries in the user message, which leverages
 * Google's indexed data rather than Perplexity trying to crawl social platforms directly.
 * This is far more reliable because Google HAS indexed many hotel social pages.
 *
 * We do a single call for ALL 5 platforms at once to reduce API call count and also
 * give Perplexity better cross-platform context.
 */
async function checkAllPlatforms(
  hotel: Hotel,
  perplexityApiKey: string
): Promise<Record<PlatformId, PlatformResult>> {
  const location = [hotel.city, hotel.state].filter(Boolean).join(', ');

  // Strip "by Marriott/Hilton/etc" for better search matching
  const simpleName = hotel.name
    .replace(/\s+by\s+(Marriott|Hilton|Hyatt|IHG|Wyndham|Radisson|Choice|Accor|Best Western|Holiday Inn)\b/gi, '')
    .trim();

  // Short name = first 2-3 meaningful words + city
  const shortName = simpleName.split(' ').slice(0, 3).join(' ');

  console.log(`Checking all social platforms for: "${hotel.name}" (simplified: "${simpleName}")`);

  const defaultResult = (): PlatformResult => ({
    hasAccount: false, accountCount: 0, isRecentlyActive: false, profileUrl: null
  });

  const systemPrompt = [
    'You are a hotel social media researcher. Your job is to find social media pages for hotels using web searches.',
    '',
    'SEARCH APPROACH: Use site: operator style searches to find this hotel on each social platform.',
    'Look for the hotel name, simplified hotel name, and brand+city variations.',
    '',
    'WHAT COUNTS as "has_account" = true:',
    '- A page for this specific hotel property',
    '- A city/location brand page (e.g. "TownePlace Suites Knoxville") that represents this property',
    '- A shared page for a dual-branded hotel that includes this property',
    '- Any page clearly associated with this hotel or its brand at this location',
    '',
    'IMPORTANT: Be INCLUSIVE. When in doubt, set has_account to true.',
    '"recently_active" defaults to true when an account is found.',
    '',
    'Return ONLY valid JSON (no markdown, no explanations):',
    '{',
    '  "facebook": {"has_account":true,"account_count":1,"recently_active":true,"profile_url":"URL or null"},',
    '  "instagram": {"has_account":true,"account_count":1,"recently_active":true,"profile_url":"URL or null"},',
    '  "tiktok": {"has_account":false,"account_count":0,"recently_active":false,"profile_url":null},',
    '  "youtube": {"has_account":false,"account_count":0,"recently_active":false,"profile_url":null},',
    '  "linkedin": {"has_account":true,"account_count":1,"recently_active":true,"profile_url":"URL or null"}',
    '}',
  ].join('\n');

  const userPrompt = [
    `Search the web for these queries to find social media pages for this hotel:`,
    ``,
    `Hotel: "${hotel.name}"`,
    `Also search for: "${simpleName}" and "${shortName} ${hotel.city || ''}"`,
    `Location: ${location}`,
    ``,
    `Search queries to use:`,
    `1. site:facebook.com "${simpleName}" ${location}`,
    `2. site:instagram.com "${simpleName}" ${location}`,
    `3. site:tiktok.com "${simpleName}" ${location}`,
    `4. site:youtube.com "${simpleName}" ${location}`,
    `5. site:linkedin.com/company "${simpleName}"`,
    ``,
    `For each platform, check if a relevant page exists and return the JSON above.`,
  ].join('\n');

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        temperature: 0.1,
        // NO domain filter — let Perplexity use Google/Bing index to find social pages
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Perplexity error:', response.status, err);
      return Object.fromEntries(ALL_PLATFORMS.map(p => [p, defaultResult()])) as Record<PlatformId, PlatformResult>;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('Perplexity response (600 chars):', content.substring(0, 600));

    // Extract JSON block — handle markdown code fences
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Perplexity response');
      return Object.fromEntries(ALL_PLATFORMS.map(p => [p, defaultResult()])) as Record<PlatformId, PlatformResult>;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const results: Record<string, PlatformResult> = {};
    for (const platform of ALL_PLATFORMS) {
      const p = parsed[platform];
      if (!p || p.has_account !== true) {
        results[platform] = defaultResult();
        console.log(`  ${platform}: not found`);
      } else {
        const accountCount = Math.max(1, Number(p.account_count) || 1);
        const isRecentlyActive = p.recently_active !== false; // default true
        const profileUrl = typeof p.profile_url === 'string' && p.profile_url.startsWith('http')
          ? p.profile_url : null;
        results[platform] = { hasAccount: true, accountCount, isRecentlyActive, profileUrl };
        console.log(`  ${platform}: FOUND (count=${accountCount}, active=${isRecentlyActive})`);
      }
    }

    return results as Record<PlatformId, PlatformResult>;

  } catch (e) {
    console.error('Social check error:', e);
    return Object.fromEntries(ALL_PLATFORMS.map(p => [p, defaultResult()])) as Record<PlatformId, PlatformResult>;
  }
}

function buildMetrics(
  platform: PlatformId,
  result: PlatformResult,
  totalCompetitors: number
): SocialPlatformMetrics {
  if (!result.hasAccount) {
    return {
      platform,
      hotelMetrics: { followers: 0, posts: 0, engagement: 0, lastPostDate: '', contentTypes: [] },
      competitorAverage: { followers: 0, posts: 0, engagement: 0 },
      rank: totalCompetitors,
      totalCompetitors,
      status: 'inactive',
      recommendation: getRecommendation(platform, 'inactive'),
      dataSource: 'searched',
      noDedicatedAccount: true,
      accountCount: 0,
    };
  }

  const status: SocialPlatformMetrics['status'] = result.isRecentlyActive ? 'competitive' : 'behind';
  return {
    platform,
    hotelMetrics: {
      followers: 0,
      posts: result.isRecentlyActive ? 8 : 1,
      engagement: 2.0,
      lastPostDate: result.isRecentlyActive
        ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      contentTypes: getContentTypes(platform),
    },
    competitorAverage: { followers: 0, posts: 0, engagement: 0 },
    rank: status === 'competitive' ? Math.ceil(totalCompetitors / 2) : totalCompetitors - 1,
    totalCompetitors,
    status,
    recommendation: getRecommendation(platform, status),
    dataSource: 'searched',
    noDedicatedAccount: false,
    accountCount: result.accountCount,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };
    console.log('Analyzing social presence for:', hotel.name);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY is not configured');

    const totalCompetitors = (competitors?.length || 0) + 1;

    // Single call for all 5 platforms using Google-style site: queries
    const presenceMap = await checkAllPlatforms(hotel, PERPLEXITY_API_KEY);

    const platforms: SocialPlatformMetrics[] = ALL_PLATFORMS.map(platform =>
      buildMetrics(platform, presenceMap[platform], totalCompetitors)
    );

    const profileUrls: Record<string, string> = {};
    for (const platform of ALL_PLATFORMS) {
      if (presenceMap[platform].profileUrl) profileUrls[platform] = presenceMap[platform].profileUrl!;
    }

    console.log('Social analysis done:', platforms.map(p =>
      `${p.platform}:${p.status}(${p.accountCount})`
    ).join(' | '));

    return new Response(
      JSON.stringify({ success: true, platforms, profileUrls }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze social presence' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getContentTypes(platform: PlatformId): string[] {
  const types: Record<PlatformId, string[]> = {
    facebook: ['photos', 'events', 'reviews', 'stories'],
    instagram: ['photos', 'reels', 'stories', 'highlights'],
    tiktok: ['short videos', 'trends', 'behind-the-scenes'],
    youtube: ['hotel tours', 'room reviews', 'local guides'],
    linkedin: ['company updates', 'articles', 'job posts'],
  };
  return types[platform] || ['photos', 'updates'];
}

function getRecommendation(platform: PlatformId, status: string): string {
  const recs: Record<PlatformId, Record<string, string>> = {
    facebook: {
      leading: 'Maintain posting frequency and leverage Facebook Events for local promotions.',
      competitive: 'Increase posting to 3x per week and boost high-performing posts.',
      behind: 'Account found but not recently active — revamp content with guest stories.',
      inactive: 'Create a Facebook page and start with 2–3 posts per week.',
    },
    instagram: {
      leading: 'Continue creating engaging Reels and Stories to maintain top positioning.',
      competitive: 'Post daily Stories and increase Reels content for better reach.',
      behind: 'Account found but not recently active — re-engage with high-quality visuals.',
      inactive: 'Set up an Instagram Business account and post daily property photos.',
    },
    tiktok: {
      leading: 'Keep experimenting with trending sounds and travel challenges.',
      competitive: 'Post 5+ videos per week to grow faster.',
      behind: 'Account found but stale — restart with behind-the-scenes content.',
      inactive: 'Create a TikTok account to reach younger travelers.',
    },
    youtube: {
      leading: 'Create full property tours and local area guide videos.',
      competitive: 'Optimize video SEO and create room tour playlists.',
      behind: 'Channel found but inactive — publish a refreshed property tour.',
      inactive: 'Launch a YouTube channel with a hotel tour video.',
    },
    linkedin: {
      leading: 'Share industry insights and highlight staff achievements.',
      competitive: 'Post more company culture content and engage locally.',
      behind: 'Page found but inactive — start posting corporate travel content.',
      inactive: 'Create a LinkedIn company page to attract corporate travelers.',
    },
  };
  return recs[platform]?.[status] ?? 'Improve your social media presence on this platform.';
}
