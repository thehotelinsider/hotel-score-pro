 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 serve(async (req) => {
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { hotelName, hotelCity, hotelState, hotelCountry } = await req.json();
     
     console.log('Fetching photos for:', hotelName, hotelCity, hotelState);
 
     const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
     const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
     
     if (!PERPLEXITY_API_KEY) {
       throw new Error('PERPLEXITY_API_KEY is not configured');
     }
     
     if (!FIRECRAWL_API_KEY) {
       throw new Error('FIRECRAWL_API_KEY is not configured');
     }
 
     // Step 1: Use Perplexity to find the hotel's Google Business Profile or photo sources
     console.log('Step 1: Using Perplexity to find hotel photo sources...');
     
     const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
             content: `You are a hotel photo research assistant. Find real photo URLs for the specified hotel.
 
 Search for:
 1. Google Business Profile photos
 2. Hotel's official website photos
 3. TripAdvisor photos
 4. Booking.com photos
 5. Expedia photos
 
 Return ONLY a valid JSON array of direct image URLs (jpg, png, webp). 
 Find at least 5-10 real photo URLs.
 Make sure URLs are direct links to actual images, not web pages.
 
 Example format:
 ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]`
           },
           {
             role: 'user',
             content: `Find real photos for: ${hotelName} located in ${hotelCity || ''}, ${hotelState || ''} ${hotelCountry || 'USA'}`
           }
         ],
       }),
     });
 
     if (!perplexityResponse.ok) {
       const errorText = await perplexityResponse.text();
       console.error('Perplexity API error:', perplexityResponse.status, errorText);
       throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
     }
 
     const perplexityData = await perplexityResponse.json();
     const perplexityContent = perplexityData.choices?.[0]?.message?.content || '';
     const citations = perplexityData.citations || [];
     
     console.log('Perplexity response received, citations:', citations.length);
 
     // Try to extract photo URLs from Perplexity response
     let photoUrls: string[] = [];
     
     try {
       const jsonMatch = perplexityContent.match(/\[[\s\S]*?\]/);
       if (jsonMatch) {
         const parsed = JSON.parse(jsonMatch[0]);
         if (Array.isArray(parsed)) {
           photoUrls = parsed.filter((url: string) => 
             typeof url === 'string' && 
             (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp') || url.includes('googleusercontent'))
           );
         }
       }
     } catch (parseErr) {
       console.log('Could not parse photo URLs from Perplexity, trying Firecrawl...');
     }
 
     // Step 2: Use Firecrawl to scrape photos from hotel pages
     if (photoUrls.length < 5 && citations.length > 0) {
       console.log('Step 2: Using Firecrawl to scrape photos from citations...');
       
       // Try scraping up to 3 citation URLs for photos
       const urlsToScrape = citations.slice(0, 3);
       
       for (const url of urlsToScrape) {
         try {
           console.log('Scraping:', url);
           
           const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
               'Content-Type': 'application/json',
             },
             body: JSON.stringify({
               url: url,
               formats: ['links', 'html'],
               onlyMainContent: false,
               waitFor: 2000,
             }),
           });
 
           if (firecrawlResponse.ok) {
             const firecrawlData = await firecrawlResponse.json();
             const links = firecrawlData.data?.links || firecrawlData.links || [];
             const html = firecrawlData.data?.html || firecrawlData.html || '';
             
             // Extract image URLs from links
             const imageLinks = links.filter((link: string) => 
               /\.(jpg|jpeg|png|webp)/i.test(link) ||
               link.includes('googleusercontent') ||
               link.includes('/photos/') ||
               link.includes('/images/')
             );
             
             // Also try to extract from HTML
             const imgMatches = html.match(/src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp)[^"']*)/gi) || [];
             const extractedFromHtml = imgMatches.map((match: string) => {
               const urlMatch = match.match(/src=["'](https?:\/\/[^"']+)/);
               return urlMatch ? urlMatch[1] : null;
             }).filter(Boolean);
             
             photoUrls.push(...imageLinks, ...extractedFromHtml);
             console.log(`Found ${imageLinks.length + extractedFromHtml.length} images from ${url}`);
           }
         } catch (scrapeErr) {
           console.error('Error scraping URL:', url, scrapeErr);
         }
         
         if (photoUrls.length >= 10) break;
       }
     }
 
     // Step 3: Try Google Maps/Places photo URL patterns as fallback
     if (photoUrls.length < 5) {
       console.log('Step 3: Trying to construct Google Places photo search...');
       
       // Search for the hotel on Google Maps via Firecrawl
       const searchQuery = encodeURIComponent(`${hotelName} ${hotelCity || ''} ${hotelState || ''} photos`);
       const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;
       
       try {
         const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             url: googleSearchUrl,
             formats: ['html'],
             waitFor: 3000,
           }),
         });
 
         if (firecrawlResponse.ok) {
           const data = await firecrawlResponse.json();
           const html = data.data?.html || data.html || '';
           
           // Extract image URLs from Google Images results
           const imgMatches = html.match(/https:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi) || [];
           const googleImages = imgMatches.filter((url: string) => 
             !url.includes('google.com/images') &&
             !url.includes('gstatic.com/images') &&
             url.length < 500
           ).slice(0, 10);
           
           photoUrls.push(...googleImages);
           console.log(`Found ${googleImages.length} images from Google Images`);
         }
       } catch (searchErr) {
         console.error('Error searching Google Images:', searchErr);
       }
     }
 
     // Deduplicate and filter valid URLs
     const uniquePhotos = [...new Set(photoUrls)]
       .filter(url => {
         try {
           new URL(url);
           return url.startsWith('http') && 
                  !url.includes('favicon') && 
                  !url.includes('logo') &&
                  !url.includes('icon') &&
                  !url.includes('sprite') &&
                  url.length < 1000;
         } catch {
           return false;
         }
       })
       .slice(0, 12);
 
     console.log(`Returning ${uniquePhotos.length} unique photos`);
 
     return new Response(JSON.stringify({ 
       success: true,
       photos: uniquePhotos,
       citations 
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Error in fetch-hotel-photos:', error);
     return new Response(
       JSON.stringify({ 
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error occurred',
         photos: []
       }),
       {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       }
     );
   }
 });