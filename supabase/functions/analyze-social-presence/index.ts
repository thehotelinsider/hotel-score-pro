import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };

    console.log('Analyzing social presence for:', hotel.name);
    console.log('Competitors count:', competitors?.length || 0);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const competitorNames = competitors?.slice(0, 5).map(c => c.name).join(', ') || 'local competitors';

const systemPrompt = `You are a social media analytics expert for the hospitality industry. 
You analyze hotels' social media presence and provide realistic, data-driven insights.
Always return valid JSON matching the exact schema requested.

CRITICAL - Follower Count Guidelines for Hotels (these are realistic ranges):
- Facebook: Most hotels have 1,000-50,000 followers. Large chains/resorts: 50,000-500,000. Boutique hotels: 500-10,000.
- Instagram: Similar to Facebook but often slightly lower. Most hotels: 1,000-30,000. Luxury resorts: 20,000-200,000.
- TikTok: Hotels are newer to TikTok. Most: 100-5,000 followers. Viral hotels: 10,000-100,000.
- YouTube: Hotels rarely focus here. Most: 50-2,000 subscribers. Active channels: 2,000-20,000.
- LinkedIn: Company pages. Most hotels: 200-5,000 followers. Large chains: 10,000-100,000.

Engagement rates should be realistic:
- Facebook: 1-5% typical, 5-10% excellent
- Instagram: 2-6% typical, 6-12% excellent  
- TikTok: 3-10% typical, 10-20% excellent
- YouTube: 2-8% typical
- LinkedIn: 1-4% typical`;

    const userPrompt = `Analyze the social media presence for "${hotel.name}" located in ${hotel.city || 'the area'}${hotel.state ? `, ${hotel.state}` : ''}.

Compare against these competitors: ${competitorNames}

For each social platform (Facebook, Instagram, TikTok, YouTube, LinkedIn), provide:
1. Realistic estimated metrics for the hotel based on the guidelines:
   - Followers: Use realistic numbers for a hotel of this type (see guidelines above)
   - Posts: Number of posts in last 30 days (typically 4-20 for active hotels)
   - Engagement rate: Percentage (typically 1-8% depending on platform)
2. Average competitor metrics (should be similar scale)
3. A rank (1 being best) among ${(competitors?.length || 3) + 1} total hotels
4. Status: "leading" (rank 1-2), "competitive" (rank 3-4), "behind" (rank 5+), or "inactive" (minimal/no presence)
5. Specific actionable recommendation

Return a JSON object with this structure:
{
  "platforms": [
    {
      "platform": "facebook",
      "hotelMetrics": {
        "followers": 8500,
        "posts": 12,
        "engagement": 3.2,
        "lastPostDate": "2025-01-10",
        "contentTypes": ["photos", "events", "reviews"]
      },
      "competitorAverage": {
        "followers": 7200,
        "posts": 10,
        "engagement": 2.8
      },
      "rank": 2,
      "totalCompetitors": 5,
      "status": "leading",
      "recommendation": "Increase posting frequency to 3x per week and leverage Facebook Events for local promotions"
    }
  ]
}

IMPORTANT:
- Follower counts MUST be realistic whole numbers based on the guidelines
- Smaller boutique hotels typically have 1,000-10,000 followers on major platforms
- Larger chain hotels/resorts may have 10,000-100,000+ followers
- TikTok and YouTube typically have fewer followers than Facebook/Instagram for hotels
- All numbers should be believable for a real hotel's social media presence`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a few moments.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Extract JSON from the response
    let platforms;
    try {
      // Try to parse the entire content as JSON
      const parsed = JSON.parse(content);
      platforms = parsed.platforms || parsed;
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        platforms = parsed.platforms || parsed;
      } else {
        // Try to find JSON object in the content
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          const parsed = JSON.parse(objectMatch[0]);
          platforms = parsed.platforms || parsed;
        } else {
          throw new Error('Could not parse AI response as JSON');
        }
      }
    }

    console.log('Parsed platforms:', platforms?.length || 0);

    return new Response(
      JSON.stringify({ 
        success: true,
        platforms: Array.isArray(platforms) ? platforms : []
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
