import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HotelScore {
  overall: number;
  seo: number;
  website: number;
  reviews: number;
  socialMedia: number;
  ota: number;
}

interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'seo' | 'website' | 'reviews' | 'social' | 'ota';
  title: string;
  description: string;
  potentialLoss?: number;
}

interface Competitor {
  id: string;
  name: string;
  rating: number;
  rank: number;
}

interface SearchRanking {
  keyword: string;
  position: number | 'unranked';
  topCompetitor: string;
}

interface HotelData {
  name: string;
  address: string;
  city: string;
  state: string;
  rating: number;
  reviewCount: number;
  score: HotelScore;
  issues: Issue[];
  competitors: Competitor[];
  rankings: SearchRanking[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelData } = await req.json() as { hotelData: HotelData };
    
    console.log('Analyzing hotel:', hotelData.name);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert hotel digital marketing consultant specializing in online presence optimization. Your role is to analyze hotel data and provide actionable, personalized recommendations to improve their online score and beat competitors.

Focus on:
1. SEO optimization for local and travel searches
2. Website user experience and conversion optimization
3. Online reputation management and review strategies
4. OTA (Online Travel Agency) visibility and ranking
5. Social media presence and engagement
6. Competitive positioning

IMPORTANT: For each recommendation in sections 2, 3, and 4, you MUST use this exact format:
- The Issue: [Describe the specific problem or gap]
- Action: [Provide the specific step(s) to take]
- Why: [Explain the impact and benefit of this action]

Be specific, actionable, and prioritize recommendations by potential impact and ease of implementation.`;

    const userPrompt = `Analyze this hotel's online presence data and provide personalized improvement recommendations:

**Hotel Information:**
- Name: ${hotelData.name}
- Location: ${hotelData.address}, ${hotelData.city}, ${hotelData.state}
- Current Rating: ${hotelData.rating}/5 (${hotelData.reviewCount} reviews)

**Current Scores:**
- Overall Score: ${hotelData.score.overall}/100
- SEO Score: ${hotelData.score.seo}/100
- Website Score: ${hotelData.score.website}/100
- Reviews Score: ${hotelData.score.reviews}/100
- Social Media Score: ${hotelData.score.socialMedia}/100
- OTA Score: ${hotelData.score.ota}/100

**Current Issues Detected:**
${hotelData.issues.map(issue => `- [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.description}${issue.potentialLoss ? ` (Potential Loss: $${issue.potentialLoss.toLocaleString()}/year)` : ''}`).join('\n')}

**Competitor Landscape:**
${hotelData.competitors.map(c => `- #${c.rank} ${c.name} (Rating: ${c.rating})`).join('\n')}

**Search Ranking Performance:**
${hotelData.rankings.map(r => `- "${r.keyword}": ${typeof r.position === 'number' ? `Position #${r.position}` : 'Unranked'} (Top competitor: ${r.topCompetitor})`).join('\n')}

Provide a comprehensive analysis with:
1. Executive Summary (2-3 sentences on the hotel's current online health)
2. Top 5 Priority Actions (for EACH action use this format: "The Issue:" followed by "Action:" followed by "Why:")
3. Quick Wins (3 things they can do this week, for EACH use: "The Issue:" followed by "Action:" followed by "Why:")
4. Competitive Strategy (for EACH strategy use: "The Issue:" followed by "Action:" followed by "Why:")
5. Revenue Impact Estimate (potential revenue increase if recommendations are implemented)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const recommendations = data.choices?.[0]?.message?.content || 'Unable to generate recommendations at this time.';

    console.log('Successfully generated recommendations for:', hotelData.name);

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-hotel function:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
