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
  platform: 'tripadvisor' | 'google_reviews' | 'yelp' | 'facebook_reviews' | 'expedia' | 'booking' | 'agoda';
  platformType: 'review' | 'ota';
  hotelMetrics: {
    rating: number;
    reviewCount: number;
    responseRate: number;
    averageResponseTime: string;
    recentReviewSentiment: 'positive' | 'mixed' | 'negative';
    listingCompleteness: number;
    lastReviewDate: string;
    bookingRank?: number;
  };
  competitorAverage: {
    rating: number;
    reviewCount: number;
    responseRate: number;
    listingCompleteness: number;
  };
  rank: number;
  totalCompetitors: number;
  status: 'leading' | 'competitive' | 'behind' | 'not_listed';
  recommendation: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel, competitors } = await req.json() as { hotel: Hotel; competitors: Competitor[] };
    
    console.log('Analyzing OTA and review platforms for:', hotel.name);
    console.log('Comparing against', competitors?.length || 0, 'competitors');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const totalCompetitors = (competitors?.length || 0) + 1; // Including the hotel itself

const systemPrompt = `You are an expert hotel industry analyst specializing in OTA (Online Travel Agencies) and review platforms. 
Your task is to generate realistic performance metrics for a hotel across various review and OTA platforms, comparing them against competitors.

IMPORTANT: Return ONLY a valid JSON array, no markdown, no code blocks, no explanations.

The platforms to analyze are:
- Review Platforms: TripAdvisor, Google Reviews, Yelp, Facebook Reviews
- OTA Platforms: Expedia, Booking.com, Agoda

CRITICAL - Review Count Guidelines (these are typical ranges for established hotels):
- Google Reviews: Usually the highest - typically 500-5000 reviews for established hotels
- TripAdvisor: Second highest - typically 300-3000 reviews
- Booking.com: Third - typically 200-2000 verified guest reviews
- Expedia: Moderate - typically 100-1500 reviews
- Yelp: Lower for hotels - typically 50-500 reviews
- Facebook: Variable - typically 50-400 recommendations
- Agoda: Similar to Expedia - typically 100-1000 reviews

Scale these numbers appropriately based on the hotel's total review count - a hotel with 1000 total reviews should have proportionally more on each platform than one with 100 reviews.`;

    const userPrompt = `Generate OTA and review platform performance data for this hotel:

Hotel: ${hotel.name}
Location: ${hotel.city}, ${hotel.state}, ${hotel.country}
Current Rating: ${hotel.rating}/5 (${hotel.reviewCount} total reviews across all platforms)

Competitors (${competitors?.length || 0}):
${competitors?.map(c => `- ${c.name} (Rating: ${c.rating})`).join('\n') || 'No competitors provided'}

Generate a JSON array with exactly 7 platform objects. Each object must have this exact structure:
{
  "platform": "tripadvisor" | "google_reviews" | "yelp" | "facebook_reviews" | "expedia" | "booking" | "agoda",
  "platformType": "review" | "ota",
  "hotelMetrics": {
    "rating": <number 1-5, typically within 0.3 of overall rating>,
    "reviewCount": <number - MUST be realistic for the platform, see guidelines above>,
    "responseRate": <number 0-100>,
    "averageResponseTime": "<string like 'Within 24 hours'>",
    "recentReviewSentiment": "positive" | "mixed" | "negative",
    "listingCompleteness": <number 0-100>,
    "lastReviewDate": "<ISO date string within last 30 days>",
    "bookingRank": <number 1-50, only for OTA platforms>
  },
  "competitorAverage": {
    "rating": <number>,
    "reviewCount": <number - should be similar scale to hotel's count>,
    "responseRate": <number>,
    "listingCompleteness": <number>
  },
  "rank": <number 1-${totalCompetitors}>,
  "totalCompetitors": ${totalCompetitors},
  "status": "leading" | "competitive" | "behind" | "not_listed",
  "recommendation": "<specific actionable recommendation>"
}

IMPORTANT - Make data accurate and realistic:
- Google Reviews should have the most reviews, followed by TripAdvisor
- Review counts should be proportional to the hotel's overall review count (${hotel.reviewCount})
- OTA platforms (booking, expedia, agoda) typically have fewer reviews than review platforms
- All review counts should be reasonable whole numbers
- Status should reflect rank (1-2: leading, 3-4: competitive, 5+: behind)

Return ONLY the JSON array, nothing else.`;

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
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing platforms data');

    // Parse the JSON from the response
    let platforms: OTAReviewPlatformMetrics[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        platforms = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw content:', content);
      
      // Generate fallback data
      platforms = generateFallbackData(hotel, totalCompetitors);
    }

    console.log('Successfully generated', platforms.length, 'platform metrics');

    return new Response(JSON.stringify({ 
      success: true,
      platforms 
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

function generateFallbackData(hotel: Hotel, totalCompetitors: number): OTAReviewPlatformMetrics[] {
  const baseRating = hotel.rating || 4.0;
  const baseReviews = hotel.reviewCount || 500;
  
  // Platform-specific review count multipliers (realistic distribution)
  // Google Reviews typically has the most, followed by TripAdvisor
  const platformConfigs: Array<{
    platform: OTAReviewPlatformMetrics['platform'];
    platformType: 'review' | 'ota';
    reviewMultiplierMin: number;
    reviewMultiplierMax: number;
  }> = [
    { platform: 'google_reviews', platformType: 'review', reviewMultiplierMin: 0.8, reviewMultiplierMax: 1.2 },
    { platform: 'tripadvisor', platformType: 'review', reviewMultiplierMin: 0.5, reviewMultiplierMax: 0.9 },
    { platform: 'booking', platformType: 'ota', reviewMultiplierMin: 0.3, reviewMultiplierMax: 0.6 },
    { platform: 'expedia', platformType: 'ota', reviewMultiplierMin: 0.15, reviewMultiplierMax: 0.35 },
    { platform: 'yelp', platformType: 'review', reviewMultiplierMin: 0.08, reviewMultiplierMax: 0.2 },
    { platform: 'facebook_reviews', platformType: 'review', reviewMultiplierMin: 0.05, reviewMultiplierMax: 0.15 },
    { platform: 'agoda', platformType: 'ota', reviewMultiplierMin: 0.1, reviewMultiplierMax: 0.25 },
  ];

  return platformConfigs.map((config, index) => {
    const ratingVariation = (Math.random() - 0.5) * 0.4;
    const rating = Math.min(5, Math.max(1, baseRating + ratingVariation));
    
    // Calculate review count using platform-specific multipliers
    const multiplier = config.reviewMultiplierMin + Math.random() * (config.reviewMultiplierMax - config.reviewMultiplierMin);
    const reviewCount = Math.max(10, Math.round(baseReviews * multiplier));
    
    const rank = Math.min(totalCompetitors, Math.floor(Math.random() * totalCompetitors) + 1);
    
    let status: OTAReviewPlatformMetrics['status'];
    if (rank <= 2) status = 'leading';
    else if (rank <= Math.ceil(totalCompetitors / 2)) status = 'competitive';
    else status = 'behind';

    // Calculate competitor average with slight variation
    const competitorReviewMultiplier = 0.8 + Math.random() * 0.4;

    return {
      platform: config.platform,
      platformType: config.platformType,
      hotelMetrics: {
        rating: Number(rating.toFixed(1)),
        reviewCount,
        responseRate: Math.round(Math.random() * 40 + 40),
        averageResponseTime: ['Within 24 hours', 'Within 48 hours', 'Within a week'][Math.floor(Math.random() * 3)],
        recentReviewSentiment: (['positive', 'mixed', 'negative'] as const)[rating >= 4 ? 0 : rating >= 3 ? 1 : 2],
        listingCompleteness: Math.round(Math.random() * 30 + 70),
        lastReviewDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        ...(config.platformType === 'ota' && { bookingRank: Math.floor(Math.random() * 20) + 1 }),
      },
      competitorAverage: {
        rating: Number((baseRating - 0.1 + Math.random() * 0.2).toFixed(1)),
        reviewCount: Math.round(reviewCount * competitorReviewMultiplier),
        responseRate: Math.round(Math.random() * 30 + 50),
        listingCompleteness: Math.round(Math.random() * 20 + 70),
      },
      rank,
      totalCompetitors,
      status,
      recommendation: getRecommendation(config.platform, status),
    };
  });
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
    facebook_reviews: {
      leading: 'Continue your social engagement and cross-promote positive reviews.',
      competitive: 'Post more frequently and engage with guests who leave recommendations.',
      behind: 'Increase Facebook activity and ask satisfied guests to leave recommendations.',
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
