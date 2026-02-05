const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Review {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  text: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName, city, state, country } = await req.json();

    if (!hotelName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Hotel name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!perplexityApiKey || !firecrawlApiKey) {
      console.error('Missing API keys');
      return new Response(
        JSON.stringify({ success: false, error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const location = [city, state, country].filter(Boolean).join(', ');
    console.log(`Fetching reviews for: ${hotelName} in ${location}`);

    // Step 1: Use Perplexity to find TripAdvisor/Google Reviews URLs and get review summaries
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a hotel review research assistant. Find and extract real guest reviews for hotels. Return ONLY valid JSON, no markdown or explanation.`
          },
          {
            role: 'user',
            content: `Find the TripAdvisor listing URL for "${hotelName}" located in ${location}. Also provide 5-8 recent real guest reviews with their ratings. 

Return JSON in this exact format:
{
  "tripadvisorUrl": "https://www.tripadvisor.com/...",
  "googleMapsUrl": "https://www.google.com/maps/place/...",
  "reviews": [
    {
      "author": "Guest Name",
      "rating": 4,
      "date": "January 2025",
      "text": "Review text here..."
    }
  ]
}`
          }
        ],
        temperature: 0.1,
      }),
    });

    let reviews: Review[] = [];
    let tripadvisorUrl = '';

    if (perplexityResponse.ok) {
      const perplexityData = await perplexityResponse.json();
      const content = perplexityData.choices?.[0]?.message?.content || '';
      console.log('Perplexity response received');

      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          tripadvisorUrl = parsed.tripadvisorUrl || '';
          
          if (parsed.reviews && Array.isArray(parsed.reviews)) {
            reviews = parsed.reviews.map((r: any, index: number) => ({
              id: `review-${index + 1}`,
              author: r.author || 'Guest',
              rating: Math.min(5, Math.max(1, parseInt(r.rating) || 4)),
              date: r.date || 'Recent',
              text: r.text || '',
            }));
          }
        }
      } catch (parseError) {
        console.error('Error parsing Perplexity response:', parseError);
      }
    }

    // Step 2: If we have a TripAdvisor URL, try to scrape more reviews with Firecrawl
    if (tripadvisorUrl && reviews.length < 5) {
      console.log(`Attempting to scrape TripAdvisor: ${tripadvisorUrl}`);
      
      try {
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: tripadvisorUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
          
          if (markdown) {
            // Extract additional reviews from scraped content using pattern matching
            const reviewPatterns = markdown.match(/(?:wrote a review|reviewed)[\s\S]{0,50}?(\d)(?:\/5|stars?|⭐)[\s\S]{0,500}?([^]*?)(?=(?:wrote a review|reviewed|$))/gi);
            
            if (reviewPatterns && reviewPatterns.length > 0) {
              console.log(`Found ${reviewPatterns.length} additional review patterns`);
            }
          }
        }
      } catch (scrapeError) {
        console.error('Firecrawl scrape error:', scrapeError);
      }
    }

    // Step 3: If still not enough reviews, use Perplexity for more detailed search
    if (reviews.length < 5) {
      console.log('Fetching additional reviews via Perplexity...');
      
      const additionalResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You find and summarize real hotel guest reviews. Return ONLY valid JSON array.'
            },
            {
              role: 'user',
              content: `Find 8 real recent guest reviews for "${hotelName}" in ${location} from Google Reviews, TripAdvisor, or Booking.com. Include variety of ratings (some 5-star, some 4-star, some 3-star).

Return JSON array:
[
  {"author": "Name", "rating": 5, "date": "Month Year", "text": "Review..."},
  ...
]`
            }
          ],
          temperature: 0.2,
        }),
      });

      if (additionalResponse.ok) {
        const additionalData = await additionalResponse.json();
        const content = additionalData.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const additionalReviews = JSON.parse(jsonMatch[0]);
            if (Array.isArray(additionalReviews)) {
              const newReviews = additionalReviews.map((r: any, index: number) => ({
                id: `review-add-${index + 1}`,
                author: r.author || 'Guest',
                rating: Math.min(5, Math.max(1, parseInt(r.rating) || 4)),
                date: r.date || 'Recent',
                text: r.text || '',
              }));
              
              // Merge without duplicates
              const existingAuthors = new Set(reviews.map(r => r.author.toLowerCase()));
              for (const review of newReviews) {
                if (!existingAuthors.has(review.author.toLowerCase()) && reviews.length < 10) {
                  reviews.push(review);
                  existingAuthors.add(review.author.toLowerCase());
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing additional reviews:', e);
        }
      }
    }

    // Filter out any reviews with empty text
    reviews = reviews.filter(r => r.text && r.text.length > 10);

    console.log(`Returning ${reviews.length} reviews for ${hotelName}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reviews,
        source: tripadvisorUrl ? 'tripadvisor' : 'perplexity'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
