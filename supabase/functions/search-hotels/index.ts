import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Knoxville, TN coordinates — the geographic centre of the allowed search area
const KNOXVILLE_CENTER = { lat: 35.9606, lng: -83.9207 };
const MAX_RADIUS_MILES = 100;
// Google Places hard-boundary radius (50 km ≈ 31 miles, covers greater Knoxville metro)
const GOOGLE_SEARCH_RADIUS_METERS = 50000;

// Calculate distance between two coordinates in miles (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPriceLevel(priceLevel?: string | number): string {
  if (priceLevel === undefined || priceLevel === null) return '$$';
  if (typeof priceLevel === 'string') return priceLevel;
  const levels: Record<number, string> = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$', 5: '$$$$$' };
  return levels[priceLevel] || '$$';
}

serve(async (req) => {
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

    console.log('Searching with Google Places API...');

    const searchQuery =
      query.toLowerCase().includes('hotel') ||
      query.toLowerCase().includes('inn') ||
      query.toLowerCase().includes('resort')
        ? query
        : `${query} hotel`;

    // Use locationRestriction (hard boundary) — only hotels inside the circle are returned
    const textSearchBody = {
      textQuery: searchQuery,
      includedType: 'lodging',
      maxResultCount: 10,
      languageCode: 'en',
      locationRestriction: {
        circle: {
          center: {
            latitude: KNOXVILLE_CENTER.lat,
            longitude: KNOXVILLE_CENTER.lng,
          },
          radius: GOOGLE_SEARCH_RADIUS_METERS, // 50 km hard boundary around Knoxville
        },
      },
    };

    const textSearchResponse = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.types,places.businessStatus,places.priceLevel,places.editorialSummary,places.primaryTypeDisplayName',
        },
        body: JSON.stringify(textSearchBody),
      }
    );

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

    // Process results — compute distance and hard-filter anything outside MAX_RADIUS_MILES
    const hotelsRaw = await Promise.all(
      textSearchData.places.map(async (place: any) => {
        const lat = place.location?.latitude || 0;
        const lng = place.location?.longitude || 0;
        const distance = calculateDistance(KNOXVILLE_CENTER.lat, KNOXVILLE_CENTER.lng, lat, lng);

        // Hard reject: outside 100-mile radius (secondary guard after Google's 50 km boundary)
        if (distance > MAX_RADIUS_MILES) {
          console.log(`Filtered out (outside radius): ${place.displayName?.text} — ${distance.toFixed(1)} mi`);
          return null;
        }

        const addressParts = (place.formattedAddress || '').split(', ');
        const city = addressParts.length >= 3 ? addressParts[addressParts.length - 3] : '';
        const stateZip = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '';
        const state = stateZip.split(' ')[0] || '';
        const country = addressParts.length >= 1 ? addressParts[addressParts.length - 1] : 'United States';
        const streetAddress = addressParts.slice(0, -3).join(', ') || addressParts[0] || '';

        // Fetch up to 6 photos from Google Places
        const photos: string[] = [];
        if (place.photos && place.photos.length > 0) {
          for (const photo of place.photos.slice(0, 6)) {
            const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=1200&key=${GOOGLE_PLACES_API_KEY}`;
            try {
              const photoResponse = await fetch(photoUrl, { method: 'GET', redirect: 'follow' });
              if (photoResponse.ok) photos.push(photoResponse.url);
            } catch (e) {
              console.error('Error fetching photo:', e);
            }
          }
        }

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
          description:
            place.editorialSummary?.text ||
            `${place.primaryTypeDisplayName?.text || 'Hotel'} in ${city}, ${state}`,
          imageUrl: finalPhotos[0],
          photos: finalPhotos,
          outsideArea: false, // already filtered above
          coordinates: { lat, lng },
          distanceFromKnoxville: Math.round(distance * 10) / 10,
        };
      })
    );

    // Remove nulls (filtered-out hotels) and sort by rating
    const hotels = hotelsRaw
      .filter(Boolean)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

    console.log(`Returning ${hotels.length} in-area hotels via Google Places`);

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

// ---------------------------------------------------------------------------
// Perplexity fallback — strictly limited to Knoxville, TN and surroundings
// ---------------------------------------------------------------------------
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
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a hotel search assistant. Search for REAL hotels in Knoxville, TN and surrounding areas (within 100 miles).

STRICT GEOGRAPHIC RULE: ONLY return hotels located in the following areas:
- Knoxville, TN (primary market)
- Gatlinburg, TN
- Pigeon Forge, TN
- Sevierville, TN
- Oak Ridge, TN
- Maryville, TN
- Morristown, TN
- Alcoa, TN
- Lenoir City, TN
- And other cities/towns within approximately 100 miles of Knoxville, TN

DO NOT return hotels outside the 100-mile Knoxville radius. If the search query refers to a hotel outside this area, return an empty array.

Return ONLY valid JSON array. For each real hotel found, provide:
- id: a unique UUID
- name: the REAL hotel name (exactly as it appears on Google/TripAdvisor)
- address: actual street address
- city: city name
- state: state abbreviation (must be "TN" or bordering area like "NC")
- country: "United States"
- rating: actual Google rating (1-5 scale)
- reviewCount: approximate number of reviews
- priceLevel: "$", "$$", "$$$", or "$$$$"
- description: brief description
- coordinates: { lat: number, lng: number } — actual GPS coordinates
- photos: empty array [] (real photos will be fetched separately)
- outsideArea: false

Return 3-5 REAL hotels that actually exist and are currently operating.`,
        },
        {
          role: 'user',
          content: `Search for real hotels in Knoxville, TN and surrounding areas matching: "${query}". Only include hotels within 100 miles of Knoxville, TN (35.9606, -83.9207). Do NOT include hotels outside this area.`,
        },
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

  let hotels: any[] = [];
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

  // Post-process: hard-filter anything outside the 100-mile radius using coordinates
  hotels = hotels
    .map((hotel: any) => ({
      ...hotel,
      id: hotel.id || crypto.randomUUID(),
      outsideArea: false,
    }))
    .filter((hotel: any) => {
      if (!hotel.coordinates?.lat || !hotel.coordinates?.lng) return true;
      const dist = calculateDistance(
        KNOXVILLE_CENTER.lat,
        KNOXVILLE_CENTER.lng,
        hotel.coordinates.lat,
        hotel.coordinates.lng
      );
      if (dist > MAX_RADIUS_MILES) {
        console.log(`Perplexity: filtered out-of-area hotel: ${hotel.name} (${dist.toFixed(1)} mi)`);
        return false;
      }
      return true;
    });

  // Fetch real photos from Google Places for each hotel
  const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (GOOGLE_PLACES_API_KEY && hotels.length > 0) {
    console.log('Fetching real Google Places photos for Perplexity results...');
    await Promise.all(
      hotels.map(async (hotel: any) => {
        try {
          const searchBody = {
            textQuery: `${hotel.name} ${hotel.city || ''} ${hotel.state || ''}`,
            includedType: 'lodging',
            maxResultCount: 1,
            languageCode: 'en',
          };
          const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
              'X-Goog-FieldMask': 'places.photos',
            },
            body: JSON.stringify(searchBody),
          });
          if (!resp.ok) return;
          const placeData = await resp.json();
          const place = placeData.places?.[0];
          if (place?.photos?.length > 0) {
            const realPhotos: string[] = [];
            for (const photo of place.photos.slice(0, 6)) {
              const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=1200&key=${GOOGLE_PLACES_API_KEY}`;
              try {
                const photoResp = await fetch(photoUrl, { method: 'GET', redirect: 'follow' });
                if (photoResp.ok) realPhotos.push(photoResp.url);
              } catch {}
            }
            if (realPhotos.length > 0) {
              hotel.photos = realPhotos;
              hotel.imageUrl = realPhotos[0];
              console.log(`Fetched ${realPhotos.length} real photos for ${hotel.name}`);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch photos for ${hotel.name}:`, e);
        }
      })
    );
  }

  // Fill any remaining hotels without real photos with fallback
  hotels.forEach((hotel: any, index: number) => {
    if (!hotel.photos?.length || hotel.photos[0]?.includes('unsplash.com')) {
      hotel.photos = generateHotelPhotos(index);
      hotel.imageUrl = hotel.photos[0];
    }
  });

  console.log(`Returning ${hotels.length} in-area hotels via Perplexity`);

  return new Response(
    JSON.stringify({ hotels, citations, source: 'perplexity' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Fallback: Lovable AI to structure an unstructured Perplexity response
// ---------------------------------------------------------------------------
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
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Extract hotel information from the provided text and return as JSON array. Only include hotels in Knoxville, TN and surrounding areas (within 100 miles).',
          },
          {
            role: 'user',
            content: `Extract hotels from this search result for "${query}" in Knoxville, TN:\n\n${perplexityContent}\n\nReturn a JSON array of hotels with: id (UUID), name, address, city, state, country, rating (number), reviewCount (number), priceLevel, description, coordinates (lat/lng). Only include hotels within 100 miles of Knoxville, TN.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_hotels',
              description: 'Return extracted hotels',
              parameters: {
                type: 'object',
                properties: {
                  hotels: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        city: { type: 'string' },
                        state: { type: 'string' },
                        country: { type: 'string' },
                        rating: { type: 'number' },
                        reviewCount: { type: 'number' },
                        priceLevel: { type: 'string' },
                        description: { type: 'string' },
                        coordinates: {
                          type: 'object',
                          properties: {
                            lat: { type: 'number' },
                            lng: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_hotels' } },
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
