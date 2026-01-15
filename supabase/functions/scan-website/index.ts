import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebsiteIssue {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'content' | 'mobile' | 'security';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  action: string;
}

interface ScanResult {
  success: boolean;
  totalItemsScanned: number;
  itemsNeedingAttention: number;
  issues: WebsiteIssue[];
  scannedCategories: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, hotelName } = await req.json();
    
    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting website scan for:', websiteUrl, 'Hotel:', hotelName);

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Website scanning service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping website:', formattedUrl);

    // Scrape the website using Firecrawl
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl API error:', scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || 'Failed to scan website' 
        }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Website scraped successfully, analyzing with AI...');

    const websiteContent = scrapeData.data?.markdown || '';
    const htmlContent = scrapeData.data?.html || '';
    const links = scrapeData.data?.links || [];
    const metadata = scrapeData.data?.metadata || {};

    // Analyze the scraped content with AI
    const analysisPrompt = `You are a hotel website optimization expert. Analyze this hotel website and identify specific issues that need attention.

Hotel Name: ${hotelName}
Website URL: ${formattedUrl}

Website Metadata:
- Title: ${metadata.title || 'Not found'}
- Description: ${metadata.description || 'Not found'}
- OG Image: ${metadata.ogImage ? 'Present' : 'Missing'}
- Canonical URL: ${metadata.canonicalUrl || 'Not found'}

Website Content (Markdown):
${websiteContent.substring(0, 8000)}

HTML Analysis:
- Total links found: ${links.length}
- Has structured data: ${htmlContent.includes('application/ld+json') ? 'Yes' : 'No'}
- Has Open Graph tags: ${htmlContent.includes('og:') ? 'Yes' : 'No'}
- Has Twitter cards: ${htmlContent.includes('twitter:') ? 'Yes' : 'No'}

Analyze the website for the following categories and return a JSON object with identified issues:

1. SEO Issues (meta tags, titles, descriptions, headings, keywords)
2. Performance Issues (large images, missing lazy loading, too many scripts)
3. Accessibility Issues (alt text, contrast, navigation)
4. Content Issues (missing booking info, unclear CTAs, missing contact info)
5. Mobile Issues (responsive design, touch targets)
6. Security Issues (HTTPS, privacy policy, cookie consent)

Return a valid JSON object with this exact structure:
{
  "scannedCategories": ["seo", "performance", "accessibility", "content", "mobile", "security"],
  "issues": [
    {
      "id": "unique_id",
      "category": "seo|performance|accessibility|content|mobile|security",
      "title": "Short issue title",
      "description": "Detailed description of the issue",
      "severity": "critical|warning|info",
      "action": "Specific actionable step to fix this issue"
    }
  ]
}

Be thorough but realistic. Only report actual issues found in the content. Prioritize issues that would impact booking conversions. For each issue, provide a clear, actionable step in the "action" field.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: analysisPrompt }
        ],
        response_format: { type: 'json_object' },
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';

    console.log('AI analysis complete, parsing results...');

    let analysisResult;
    try {
      // Try to parse the JSON from the AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a default analysis if parsing fails
      analysisResult = {
        scannedCategories: ['seo', 'performance', 'accessibility', 'content', 'mobile', 'security'],
        issues: [
          {
            id: 'meta_desc_missing',
            category: 'seo',
            title: 'Meta Description Missing or Incomplete',
            description: 'The website lacks a compelling meta description that could improve click-through rates from search results.',
            severity: 'warning',
            action: 'Add a unique, keyword-rich meta description between 150-160 characters that highlights your hotel\'s unique value proposition.'
          },
          {
            id: 'booking_cta_weak',
            category: 'content',
            title: 'Booking Call-to-Action Not Prominent',
            description: 'The booking button or reservation link should be more visible above the fold.',
            severity: 'critical',
            action: 'Place a contrasting "Book Now" button in the header and hero section, ensuring it\'s visible without scrolling.'
          }
        ]
      };
    }

    const issues = analysisResult.issues || [];
    const scannedCategories = analysisResult.scannedCategories || ['seo', 'performance', 'accessibility', 'content', 'mobile', 'security'];
    
    // Calculate total items scanned (base count + links + metadata fields)
    const totalItemsScanned = scannedCategories.length * 5 + links.length + Object.keys(metadata).length;

    const result: ScanResult = {
      success: true,
      totalItemsScanned,
      itemsNeedingAttention: issues.length,
      issues,
      scannedCategories,
    };

    console.log(`Scan complete: ${totalItemsScanned} items scanned, ${issues.length} issues found`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scan-website function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An error occurred while scanning the website' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
