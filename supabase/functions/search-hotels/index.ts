import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Knoxville, TN coordinates for distance calculation
const KNOXVILLE_CENTER = { lat: 35.9606, lng: -83.9207 };
const MAX_RADIUS_MILES = 100;
const GOOGLE_SEARCH_RADIUS_METERS = 50000; // Google Places max radius

// Calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Convert Google price level to string
function formatPriceLevel(priceLevel?: string | number): string {
  if (priceLevel === undefined || priceLevel === null) return '$$';
  if (typeof priceLevel === 'string') return priceLevel;
  const levels: Record<number, string> = {
    0: '$',
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
    5: '$$$$$'
  };
  return levels[priceLevel] || '$$';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ hotels: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching for hotels: ${query}`);

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!GOOGLE_PLACES_API_KEY) {
      console.log('Google Places API key not configured, falling back to Perplexity');
      return await searchWithPerplexity(query);
    }

    // Use Google Places Text Search API
    console.log('Searching with Google Places API...');
    
    const textSearchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchQuery = query.toLowerCase().includes('hotel') || query.toLowerCase().includes('inn') || query.toLowerCase().includes('resort')
      ? query
      : `${query} hotel`;
    
    const textSearchBody = {
      textQuery: searchQuery,
      includedType: 'lodging',
      maxResultCount: 10,
      languageCode: 'en',
    locationBias: {
        circle: {
          center: {
            latitude: KNOXVILLE_CENTER.lat,
            longitude: KNOXVILLE_CENTER.lng,
          },
          radius: GOOGLE_SEARCH_RADIUS_METERS, // Use Google's max radius
        },
      },
    };

    const textSearchResponse = await fetch(textSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.types,places.businessStatus,places.priceLevel,places.editorialSummary,places.primaryTypeDisplayName',
      },
      body: JSON.stringify(textSearchBody),
    });

    if (!textSearchResponse.ok) {
      const errorText = await textSearchResponse.text();
      console.error('Google Places API error:', textSearchResponse.status, errorText);
      console.log('Falling back to Perplexity search...');
      return await searchWithPerplexity(query);
    }

    const textSearchData = await textSearchResponse.json();
    console.log('Google Places results:', textSearchData.places?.length || 0);

    if (!textSearchData.places || textSearchData.places.length === 0) {
      console.log('No Google Places results, trying Perplexity...');
      return await searchWithPerplexity(query);
    }

    // Process Google Places results
    const hotels = await Promise.all(textSearchData.places.map(async (place: any) => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;
      const distance = calculateDistance(KNOXVILLE_CENTER.lat, KNOXVILLE_CENTER.lng, lat, lng);
      const outsideArea = distance > MAX_RADIUS_MILES;

      // Parse address components
      const addressParts = (place.formattedAddress || '').split(', ');
      const city = addressParts.length >= 3 ? addressParts[addressParts.length - 3] : '';
      const stateZip = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '';
      const state = stateZip.split(' ')[0] || '';
      const country = addressParts.length >= 1 ? addressParts[addressParts.length - 1] : 'United States';
      const streetAddress = addressParts.slice(0, -3).join(', ') || addressParts[0] || '';

      // Fetch photos
      const photos: string[] = [];
      if (place.photos && place.photos.length > 0) {
        const photosToFetch = place.photos.slice(0, 6);
        for (const photo of photosToFetch) {
          const photoName = photo.name;
          const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=1200&key=${GOOGLE_PLACES_API_KEY}`;
          try {
            const photoResponse = await fetch(photoUrl, { method: 'GET', redirect: 'follow' });
            if (photoResponse.ok) {
              photos.push(photoResponse.url);
            }
          } catch (e) {
            console.error('Error fetching photo:', e);
          }
        }
      }

      // Use fallback photos if none fetched
      const finalPhotos = photos.length > 0 ? photos : generateHotelPhotos(0);

      return {
        id: place.id || crypto.randomUUID(),
        name: place.displayName?.text || '',
        address: streetAddress,
        city,
        state,
        country,
        rating: place.rating || 0,
        reviewCount: place.userRatingCount || 0,
        priceLevel: formatPriceLevel(place.priceLevel),
        description: place.editorialSummary?.text || `${place.primaryTypeDisplayName?.text || 'Hotel'} in ${city}, ${state}`,
        imageUrl: finalPhotos[0],
        photos: finalPhotos,
        outsideArea,
        coordinates: {
          lat,
          lng,
        },
      };
    }));

    // Sort: in-area hotels first, then by rating
    hotels.sort((a: any, b: any) => {
      if (a.outsideArea !== b.outsideArea) {
        return a.outsideArea ? 1 : -1;
      }
      return (b.rating || 0) - (a.rating || 0);
    });

    console.log(`Found ${hotels.length} hotels via Google Places`);

    return new Response(
      JSON.stringify({ hotels, source: 'google_places' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-hotels function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fallback to Perplexity search
async function searchWithPerplexity(query: string): Promise<Response> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    console.error('PERPLEXITY_API_KEY is not configured');
    return new Response(
      JSON.stringify({ hotels: [], error: 'Search service unavailable' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Searching with Perplexity API...');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
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
          content: `You are a hotel search assistant. Search for real hotels matching the user's query and return structured data.

IMPORTANT GEOGRAPHIC RESTRICTION: Only return hotels located within 100 miles of Knoxville, Tennessee. This includes cities like:
- Knoxville, TN (center)
- Gatlinburg, TN
- Pigeon Forge, TN
- Sevierville, TN
- Oak Ridge, TN
- Maryville, TN
- Morristown, TN
- Johnson City, TN
- Kingsport, TN
- Bristol, TN
- Asheville, NC (eastern edge)
- And other cities within approximately 100 miles of Knoxville

If the user searches for a hotel that is OUTSIDE this 100-mile radius, still return results but add "outsideArea": true to each hotel object.

IMPORTANT: Return ONLY valid JSON with no additional text.

For each real hotel found, provide:
- id: a unique UUID
- name: the REAL hotel name
- address: actual street address
- city: city name
- state: state/province abbreviation  
- country: country name (default to "United States" if in US)
- rating: actual Google/TripAdvisor rating (1-5 scale)
- reviewCount: approximate number of reviews
- priceLevel: "$", "$$", "$$$", "$$$$", or "$$$$$"
- description: brief description from their website or reviews
- coordinates: { lat: number, lng: number } - actual GPS coordinates
- photos: array of 6-8 Unsplash hotel photo URLs (use realistic hotel images like https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80)
- outsideArea: boolean (true if hotel is outside 100-mile radius of Knoxville, TN; false or omit if within area)

Return 3-5 REAL hotels that actually exist.`
        },
        {
          role: 'user',
          content: `Search for real hotels: "${query}". Find actual hotels that exist with their real addresses, ratings, and information. Remember to only include hotels within 100 miles of Knoxville, TN, or mark them as outsideArea if they are farther.`
        }
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.error('Perplexity rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const errorText = await response.text();
    console.error('Perplexity API error:', response.status, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  console.log('Perplexity response received, citations:', citations.length);

  // Parse hotels from the response
  let hotels = [];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      hotels = JSON.parse(jsonMatch[0]);
    } else {
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        hotels = parsed.hotels || [];
      }
    }
  } catch (parseError) {
    console.error('Failed to parse Perplexity response as JSON:', parseError);
    hotels = await fallbackToLovableAI(query, content);
  }

  // Ensure photos and proper structure
  hotels = hotels.map((hotel: any, index: number) => ({
    ...hotel,
    id: hotel.id || crypto.randomUUID(),
    photos: hotel.photos?.length > 0 ? hotel.photos : generateHotelPhotos(index),
    imageUrl: hotel.imageUrl || hotel.photos?.[0] || generateHotelPhotos(index)[0],
  }));

  console.log(`Found ${hotels.length} hotels via Perplexity`);

  return new Response(
    JSON.stringify({ hotels, citations, source: 'perplexity' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Fallback to Lovable AI to structure unstructured Perplexity response
async function fallbackToLovableAI(query: string, perplexityContent: string): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not available for fallback');
    return [];
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Extract hotel information from the provided text and return as JSON array.'
          },
          {
            role: 'user',
            content: `Extract hotels from this search result for "${query}":\n\n${perplexityContent}\n\nReturn a JSON array of hotels with: id (UUID), name, address, city, state, country, rating (number), reviewCount (number), priceLevel, description, coordinates (lat/lng).`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_hotels",
              description: "Return extracted hotels",
              parameters: {
                type: "object",
                properties: {
                  hotels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        address: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        country: { type: "string" },
                        rating: { type: "number" },
                        reviewCount: { type: "number" },
                        priceLevel: { type: "string" },
                        description: { type: "string" },
                        coordinates: {
                          type: "object",
                          properties: {
                            lat: { type: "number" },
                            lng: { type: "number" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_hotels" } }
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return args.hotels || [];
    }
  } catch (e) {
    console.error('Fallback AI also failed:', e);
  }

  return [];
}

function generateHotelPhotos(index: number): string[] {
  const photoSets = [
    [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
      'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&q=80',
      'https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
      'https://images.unsplash.com/photo-1587985064135-0366536eab42?w=800&q=80',
      'https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=800&q=80',
      'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80',
    ],
  ];
  return photoSets[index % photoSets.length];
}
