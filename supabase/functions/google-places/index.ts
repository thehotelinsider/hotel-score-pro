import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  userRatingsTotal?: number;
  photos: string[];
  types?: string[];
  businessStatus?: string;
  priceLevel?: number;
  openingHours?: {
    openNow?: boolean;
    weekdayText?: string[];
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = 'hotel', location, radius = 50000, maxPhotos = 10 } = await req.json();
    
    console.log('Google Places request:', { query, type, location, radius });

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    let placeId: string | null = null;
    let placeDetails: PlaceResult | null = null;

    // Step 1: Find the place using Text Search (New API)
    console.log('Step 1: Searching for place...');
    
    const textSearchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const textSearchBody = {
      textQuery: query,
      includedType: type === 'hotel' ? 'lodging' : type,
      maxResultCount: 1,
      languageCode: 'en',
    };

    // Add location bias if coordinates provided
    if (location?.lat && location?.lng) {
      (textSearchBody as any).locationBias = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius,
        },
      };
    }

    const textSearchResponse = await fetch(textSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.types,places.businessStatus,places.priceLevel,places.currentOpeningHours',
      },
      body: JSON.stringify(textSearchBody),
    });

    if (!textSearchResponse.ok) {
      const errorText = await textSearchResponse.text();
      console.error('Text search error:', textSearchResponse.status, errorText);
      throw new Error(`Google Places API error: ${textSearchResponse.status} - ${errorText}`);
    }

    const textSearchData = await textSearchResponse.json();
    console.log('Text search results:', textSearchData.places?.length || 0);

    if (!textSearchData.places || textSearchData.places.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No places found matching the query',
        place: null,
        photos: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const place = textSearchData.places[0];
    placeId = place.id;

    // Step 2: Fetch photos for the place
    console.log('Step 2: Fetching photos for place:', placeId);
    
    const photoUrls: string[] = [];
    
    if (place.photos && place.photos.length > 0) {
      // Limit to maxPhotos
      const photosToFetch = place.photos.slice(0, maxPhotos);
      
      for (const photo of photosToFetch) {
        // Extract the photo reference from the resource name
        // Format: places/{place_id}/photos/{photo_reference}
        const photoName = photo.name;
        
        // Use the Places Photo API to get the actual image URL
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=1200&key=${GOOGLE_PLACES_API_KEY}`;
        
        try {
          // Make a HEAD request to get the redirect URL (actual image URL)
          const photoResponse = await fetch(photoUrl, {
            method: 'GET',
            redirect: 'follow',
          });
          
          if (photoResponse.ok) {
            // The final URL after redirects is the actual image URL
            photoUrls.push(photoResponse.url);
          }
        } catch (photoErr) {
          console.error('Error fetching photo:', photoErr);
        }
      }
    }

    console.log(`Fetched ${photoUrls.length} photos`);

    // Build the place result
    placeDetails = {
      placeId: placeId!,
      name: place.displayName?.text || '',
      formattedAddress: place.formattedAddress || '',
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
      photos: photoUrls,
      types: place.types,
      businessStatus: place.businessStatus,
      priceLevel: place.priceLevel,
      openingHours: place.currentOpeningHours ? {
        openNow: place.currentOpeningHours.openNow,
        weekdayText: place.currentOpeningHours.weekdayDescriptions,
      } : undefined,
    };

    return new Response(JSON.stringify({
      success: true,
      place: placeDetails,
      photos: photoUrls,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-places function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        place: null,
        photos: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
