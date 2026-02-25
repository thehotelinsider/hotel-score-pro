import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Hotel {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  rating: number;
  priceLevel: string;
  lat?: number;
  lng?: number;
}

interface Competitor {
  id: string;
  name: string;
  rating: number;
  rank: number;
  tripadvisorRank?: number;
  starLevel?: number;
  distance: number;
  address: string;
  city: string;
  state: string;
  locationType?: string;
  googlePlaceId?: string;
  verified: boolean;
}

/**
 * Structure-aware JSON sanitizer.
 */
function sanitizeJsonControlChars(raw: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const code = raw.charCodeAt(i);

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (code === 0x0A) { result += '\\n'; continue; }
      if (code === 0x0D) { result += '\\r'; continue; }
      if (code === 0x09) { result += '\\t'; continue; }
      if (code < 0x20 || code === 0x7F) { continue; }
    }

    result += char;
  }

  return result;
}

/** Haversine distance in miles between two lat/lng pairs */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Verify a competitor hotel exists using the Google Places Text Search API.
 * Returns the place data if found within maxDistanceMiles of the subject hotel center,
 * otherwise returns null (hotel does not exist / is not in the right area).
 */
async function verifyHotelWithGooglePlaces(
  hotelName: string,
  city: string,
  state: string,
  googleApiKey: string,
  subjectLat: number,
  subjectLng: number,
  maxDistanceMiles = 5
): Promise<{ name: string; address: string; rating: number; placeId: string; lat: number; lng: number; distance: number } | null> {
  try {
    const query = encodeURIComponent(`${hotelName} hotel ${city} ${state}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=lodging&key=${googleApiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Google Places API error for "${hotelName}": ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log(`Google Places: No results found for "${hotelName}" in ${city}, ${state} — REJECTED`);
      return null;
    }

    // Check each result to find one that matches close enough to the subject hotel
    for (const place of data.results) {
      const placeName: string = place.name || '';
      const placeAddress: string = place.formatted_address || '';
      const placeLat: number = place.geometry?.location?.lat;
      const placeLng: number = place.geometry?.location?.lng;

      if (!placeLat || !placeLng) continue;

      // Distance from subject hotel
      const distanceMiles = haversineDistance(subjectLat, subjectLng, placeLat, placeLng);

      // Must be within the distance limit
      if (distanceMiles > maxDistanceMiles) {
        console.log(`Google Places: "${placeName}" is ${distanceMiles.toFixed(1)} miles away — too far, skipping`);
        continue;
      }

      // Name similarity check — the returned place name must be reasonably close to what was requested
      const requestedLower = hotelName.toLowerCase();
      const returnedLower = placeName.toLowerCase();

      // Extract brand and location keywords for loose matching
      const brandMatch = (
        requestedLower.includes('marriott') && returnedLower.includes('marriott') ||
        requestedLower.includes('hilton') && returnedLower.includes('hilton') ||
        requestedLower.includes('hyatt') && returnedLower.includes('hyatt') ||
        requestedLower.includes('ihg') && returnedLower.includes('ihg') ||
        requestedLower.includes('holiday inn') && returnedLower.includes('holiday inn') ||
        requestedLower.includes('courtyard') && returnedLower.includes('courtyard') ||
        requestedLower.includes('residence inn') && returnedLower.includes('residence inn') ||
        requestedLower.includes('hampton') && returnedLower.includes('hampton') ||
        requestedLower.includes('homewood') && returnedLower.includes('homewood') ||
        requestedLower.includes('towneplace') && returnedLower.includes('towneplace') ||
        requestedLower.includes('fairfield') && returnedLower.includes('fairfield') ||
        requestedLower.includes('springhill') && returnedLower.includes('springhill') ||
        requestedLower.includes('embassy') && returnedLower.includes('embassy') ||
        requestedLower.includes('doubletree') && returnedLower.includes('doubletree') ||
        requestedLower.includes('best western') && returnedLower.includes('best western') ||
        requestedLower.includes('comfort') && returnedLower.includes('comfort') ||
        requestedLower.includes('candlewood') && returnedLower.includes('candlewood') ||
        requestedLower.includes('staybridge') && returnedLower.includes('staybridge') ||
        requestedLower.includes('aloft') && returnedLower.includes('aloft') ||
        requestedLower.includes('westin') && returnedLower.includes('westin') ||
        requestedLower.includes('sheraton') && returnedLower.includes('sheraton') ||
        requestedLower.includes('wyndham') && returnedLower.includes('wyndham') ||
        requestedLower.includes('radisson') && returnedLower.includes('radisson') ||
        requestedLower.includes('la quinta') && returnedLower.includes('la quinta')
      );

      // Also check if a significant word from the requested name appears in the returned name
      const requestedWords = requestedLower.split(/\s+/).filter(w => w.length > 3);
      const wordOverlap = requestedWords.some(w => returnedLower.includes(w));

      if (!brandMatch && !wordOverlap) {
        console.log(`Google Places: Name mismatch — requested "${hotelName}", got "${placeName}" — REJECTED`);
        continue;
      }

      // Verify address contains the right state
      const addressUpper = placeAddress.toUpperCase();
      if (!addressUpper.includes(state.toUpperCase()) && !addressUpper.includes(city.toUpperCase())) {
        console.log(`Google Places: "${placeName}" address "${placeAddress}" doesn't match ${city}, ${state} — REJECTED`);
        continue;
      }

      console.log(`Google Places: VERIFIED "${placeName}" at "${placeAddress}" (${distanceMiles.toFixed(1)} mi from subject)`);

      return {
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || 0,
        placeId: place.place_id,
        lat: placeLat,
        lng: placeLng,
        distance: Math.round(distanceMiles * 10) / 10,
      };
    }

    console.log(`Google Places: No valid match for "${hotelName}" within ${maxDistanceMiles} miles — REJECTED`);
    return null;
  } catch (err) {
    console.error(`Error verifying "${hotelName}" with Google Places:`, err);
    return null;
  }
}

/**
 * Get the lat/lng for the subject hotel from Google Places.
 */
async function getHotelCoordinates(
  hotelName: string,
  address: string,
  city: string,
  state: string,
  googleApiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${hotelName} ${address} ${city} ${state}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=lodging&key=${googleApiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`Subject hotel coordinates: ${lat}, ${lng}`);
      return { lat, lng };
    }

    // Fallback: geocode the city
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${city}, ${state}`)}&key=${googleApiKey}`;
    const geoResponse = await fetch(geocodeUrl);
    const geoData = await geoResponse.json();

    if (geoData.results?.[0]?.geometry?.location) {
      const { lat, lng } = geoData.results[0].geometry.location;
      console.log(`Fallback city coordinates: ${lat}, ${lng}`);
      return { lat, lng };
    }

    return null;
  } catch (err) {
    console.error('Error getting hotel coordinates:', err);
    return null;
  }
}

function classifyHotel(hotel: Hotel) {
  const nameLower = hotel.name.toLowerCase();
  const addressLower = hotel.address.toLowerCase();

  let locationType = 'general area';
  if (nameLower.includes('downtown') || addressLower.includes('downtown') ||
      addressLower.includes('city center') || addressLower.includes('main st')) {
    locationType = 'downtown/city center';
  } else if (nameLower.includes('airport') || addressLower.includes('airport')) {
    locationType = 'airport area';
  } else if (nameLower.includes('convention') || addressLower.includes('convention')) {
    locationType = 'convention center area';
  } else if (addressLower.includes('interstate') || addressLower.match(/i-\d+/) || addressLower.includes('highway')) {
    locationType = 'highway/interstate corridor';
  } else if (nameLower.includes('resort') || nameLower.includes('spa')) {
    locationType = 'resort/destination area';
  }

  let hotelType = 'select-service hotel';
  let starLevel = '3-star';
  if (nameLower.includes('residence inn') || nameLower.includes('homewood') ||
      nameLower.includes('staybridge') || nameLower.includes('extended stay') ||
      nameLower.includes('towneplace') || nameLower.includes('candlewood')) {
    hotelType = 'extended-stay hotel with suites and kitchens';
    starLevel = '3-star extended-stay';
  } else if (nameLower.includes('ritz') || nameLower.includes('four seasons') ||
             nameLower.includes('waldorf') || nameLower.includes('st. regis') ||
             hotel.priceLevel === '$$$$') {
    hotelType = 'luxury full-service hotel';
    starLevel = '5-star luxury';
  } else if (nameLower.includes('marriott hotel') || nameLower.includes('hilton hotel') ||
             nameLower.includes('sheraton') || nameLower.includes('hyatt regency') ||
             nameLower.includes('westin') || nameLower.includes('renaissance')) {
    hotelType = 'full-service hotel with restaurant and meeting rooms';
    starLevel = '4-star full-service';
  } else if (nameLower.includes('courtyard') || nameLower.includes('hampton') ||
             nameLower.includes('hilton garden') || nameLower.includes('holiday inn express') ||
             nameLower.includes('fairfield')) {
    hotelType = 'select-service hotel';
    starLevel = '3-star select-service';
  } else if (nameLower.includes('la quinta') || nameLower.includes('comfort inn') ||
             nameLower.includes('best western') || nameLower.includes('days inn') ||
             nameLower.includes('super 8') || hotel.priceLevel === '$') {
    hotelType = 'economy/budget hotel';
    starLevel = '2-star economy';
  }

  return { locationType, hotelType, starLevel };
}

// Known cities/areas within ~100 miles of Knoxville, TN
const KNOXVILLE_AREA_CITIES = new Set([
  'knoxville', 'gatlinburg', 'pigeon forge', 'sevierville', 'oak ridge',
  'maryville', 'morristown', 'alcoa', 'lenoir city', 'farragut', 'powell',
  'clinton', 'newport', 'greeneville', 'jefferson city', 'harriman',
  'kingston', 'rockwood', 'crossville', 'lafollette', 'jellico',
  'johnson city', 'kingsport', 'bristol', 'elizabethton', 'erwin',
  'asheville', 'waynesville', 'sylva',
]);

function isInKnoxvilleArea(city: string, state: string): boolean {
  const cityLower = (city || '').toLowerCase().trim();
  const stateUpper = (state || '').toUpperCase().trim();
  if (stateUpper !== 'TN' && stateUpper !== 'NC') return false;
  return KNOXVILLE_AREA_CITIES.has(cityLower);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel } = await req.json() as { hotel: Hotel };

    if (!hotel || !hotel.city || !hotel.state) {
      return new Response(
        JSON.stringify({ competitors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Guard: subject hotel must be within the Knoxville, TN service area
    if (!isInKnoxvilleArea(hotel.city, hotel.state)) {
      console.warn(`Subject hotel "${hotel.name}" in ${hotel.city}, ${hotel.state} is outside the Knoxville, TN service area.`);
      return new Response(
        JSON.stringify({ competitors: [], error: 'Hotel is outside the supported geographic area (Knoxville, TN and surroundings).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Finding competitors for: ${hotel.name} in ${hotel.city}, ${hotel.state}`);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY is not configured');
    if (!GOOGLE_PLACES_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not configured');

    const { locationType, hotelType, starLevel } = classifyHotel(hotel);
    console.log(`Classification: ${locationType}, ${hotelType}, ${starLevel}`);

    // Step 1: Get the subject hotel's exact coordinates so we can measure real distances
    const subjectCoords = hotel.lat && hotel.lng
      ? { lat: hotel.lat, lng: hotel.lng }
      : await getHotelCoordinates(hotel.name, hotel.address, hotel.city, hotel.state, GOOGLE_PLACES_API_KEY);

    if (!subjectCoords) {
      console.error('Could not determine subject hotel coordinates — aborting competitor search');
      return new Response(
        JSON.stringify({ competitors: [], error: 'Could not locate the subject hotel on Google Maps.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Ask Perplexity for candidate competitor hotel names
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a hotel market analyst. Your ONLY job is to identify REAL, currently-operating competitor hotels near a subject hotel.

CRITICAL — EXISTENCE RULE:
- Every hotel name you return will be verified against Google Maps. If it does not exist on Google Maps within 2 miles of the subject hotel, it will be REJECTED.
- Do NOT invent or guess hotel names. Only return hotels you have seen on Google Maps, TripAdvisor, Booking.com, or Expedia.
- Do NOT combine brand names with locations to create hotels that might not exist (e.g., "TownePlace Suites Knoxville Downtown" — if you have not seen it listed, do not include it).
- Only include hotels you are highly confident exist and are currently open for business.

LOCATION RULE:
- ALL competitors must be in ${hotel.city}, ${hotel.state} — the exact same city.
- All competitors must be within 2 miles of "${hotel.name}" at ${hotel.address}, ${hotel.city}, ${hotel.state}.
- Same sub-market required: if the subject is downtown, competitors must also be downtown.

BRAND RULE:
- Do NOT include "${hotel.name}" itself.
- Similar hotel tier preferred (${starLevel}, ${hotelType}).

Return ONLY valid JSON:
{
  "candidates": [
    {
      "name": "<exact hotel name as it appears on Google Maps or TripAdvisor>",
      "address": "<real street address>",
      "city": "${hotel.city}",
      "state": "${hotel.state}",
      "tripadvisorRank": <integer or null>,
      "starLevel": <2-5>,
      "locationType": "<downtown|airport|highway|suburban|resort>"
    }
  ]
}

Include 8-10 candidates so that after verification some may be filtered out but 4 remain.`
          },
          {
            role: 'user',
            content: `Find 8-10 REAL competitor hotels for "${hotel.name}" located at ${hotel.address}, ${hotel.city}, ${hotel.state}.

Requirements:
- Same city: ${hotel.city}, ${hotel.state}
- Same sub-market: ${locationType}
- Similar tier: ${starLevel} (${hotelType})
- Within 2 miles
- Must be real hotels currently operating and listed on Google Maps

Only return hotels you are certain exist. These will be validated against Google Maps — fabricated names will be discarded.`
          }
        ],
      }),
    });

    if (!perplexityResponse.ok) {
      if (perplexityResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';
    console.log('Perplexity raw response snippet:', content.slice(0, 400));

    // Parse candidate list
    let candidates: any[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const sanitized = sanitizeJsonControlChars(jsonMatch[0]);
        const parsed = JSON.parse(sanitized);
        candidates = parsed.candidates || parsed.competitors || [];
        console.log(`Perplexity returned ${candidates.length} candidate hotels`);
      } else {
        console.warn('No JSON found in Perplexity response');
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
    }

    // Step 3: Validate EVERY candidate against Google Places API
    // Only hotels that Google can confirm exist within 2 miles are accepted
    console.log(`Verifying ${candidates.length} candidates against Google Places API...`);

    const verifiedCompetitors: Competitor[] = [];

    for (const candidate of candidates) {
      if (verifiedCompetitors.length >= 4) break; // We only need 4

      const candidateName: string = candidate.name || '';
      const candidateCity: string = candidate.city || hotel.city;
      const candidateState: string = candidate.state || hotel.state;

      if (!candidateName) continue;

      // Skip if it's the subject hotel itself
      if (candidateName.toLowerCase().trim() === hotel.name.toLowerCase().trim()) {
        console.log(`Skipping subject hotel: ${candidateName}`);
        continue;
      }

      // Quick city/state pre-check before hitting the API
      if (
        candidateCity.toLowerCase().trim() !== hotel.city.toLowerCase().trim() ||
        candidateState.toUpperCase().trim() !== hotel.state.toUpperCase().trim()
      ) {
        console.log(`Pre-filter rejected "${candidateName}" — wrong city: ${candidateCity}, ${candidateState}`);
        continue;
      }

      // Verify via Google Places — this is the authoritative existence check
      const verified = await verifyHotelWithGooglePlaces(
        candidateName,
        candidateCity,
        candidateState,
        GOOGLE_PLACES_API_KEY,
        subjectCoords.lat,
        subjectCoords.lng,
        2 // max 2 miles from subject hotel
      );

      if (!verified) {
        // Hotel could not be confirmed — reject it
        console.log(`REJECTED (not found on Google Maps): "${candidateName}"`);
        continue;
      }

      // Skip if we already have a competitor with the same Google Place ID (prevents duplicates)
      if (verifiedCompetitors.some(c => c.googlePlaceId === verified.placeId)) {
        console.log(`SKIPPED (duplicate placeId ${verified.placeId}): "${verified.name}"`);
        continue;
      }

      console.log(`ACCEPTED: "${verified.name}" at "${verified.address}" — ${verified.distance} mi away`);

      verifiedCompetitors.push({
        id: crypto.randomUUID(),
        name: verified.name,
        rating: verified.rating || (typeof candidate.rating === 'number' ? candidate.rating : 4.0),
        tripadvisorRank: typeof candidate.tripadvisorRank === 'number' ? candidate.tripadvisorRank : undefined,
        starLevel: typeof candidate.starLevel === 'number' ? candidate.starLevel : 3,
        rank: verifiedCompetitors.length + 1,
        distance: verified.distance,
        address: verified.address,
        city: candidateCity,
        state: candidateState,
        locationType: candidate.locationType || locationType,
        googlePlaceId: verified.placeId,
        verified: true,
      });
    }

    // Sort by star level (highest first), then reassign ranks
    const sortedCompetitors = verifiedCompetitors
      .sort((a, b) => (b.starLevel || 3) - (a.starLevel || 3))
      .map((c, index) => ({ ...c, rank: index + 1 }));

    console.log(`Final verified competitors (${sortedCompetitors.length}):`,
      sortedCompetitors.map(c => `${c.name} — ${c.city}, ${c.state} (${c.distance} mi)`).join(' | '));

    // If we got fewer than 4, try a broader Google Places nearby search as fallback
    let finalCompetitors = sortedCompetitors;
    if (finalCompetitors.length < 4) {
      console.log(`Only ${finalCompetitors.length} verified. Attempting Google Places nearby search fallback...`);
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${subjectCoords.lat},${subjectCoords.lng}&radius=3219&type=lodging&key=${GOOGLE_PLACES_API_KEY}`;

      try {
        const nearbyResponse = await fetch(nearbyUrl);
        const nearbyData = await nearbyResponse.json();
        const nearbyPlaces = nearbyData.results || [];
        console.log(`Google Places nearby search returned ${nearbyPlaces.length} lodging results`);

        for (const place of nearbyPlaces) {
          if (finalCompetitors.length >= 4) break;

          const placeName: string = place.name || '';
          const placeAddress: string = place.formatted_address || place.vicinity || '';
          const placeRating: number = place.rating || 4.0;
          const placeLat: number = place.geometry?.location?.lat;
          const placeLng: number = place.geometry?.location?.lng;

          if (!placeName || !placeLat || !placeLng) continue;

          // Skip subject hotel
          if (placeName.toLowerCase().trim() === hotel.name.toLowerCase().trim()) continue;

          // Skip already accepted (by name or placeId)
          if (finalCompetitors.some(c => c.name.toLowerCase() === placeName.toLowerCase() || c.googlePlaceId === place.place_id)) continue;

          // Must contain the city name in address
          if (!placeAddress.toUpperCase().includes(hotel.city.toUpperCase()) &&
              !placeAddress.toUpperCase().includes(hotel.state.toUpperCase())) continue;

          const distanceMiles = haversineDistance(subjectCoords.lat, subjectCoords.lng, placeLat, placeLng);
          if (distanceMiles > 2) continue;

          console.log(`Fallback ACCEPTED from nearby search: "${placeName}" (${distanceMiles.toFixed(1)} mi)`);

          finalCompetitors.push({
            id: crypto.randomUUID(),
            name: placeName,
            rating: placeRating,
            tripadvisorRank: undefined,
            starLevel: 3,
            rank: finalCompetitors.length + 1,
            distance: Math.round(distanceMiles * 10) / 10,
            address: placeAddress,
            city: hotel.city,
            state: hotel.state,
            locationType,
            googlePlaceId: place.place_id,
            verified: true,
          });
        }

        // Re-sort and re-rank after fallback additions
        finalCompetitors = finalCompetitors
          .sort((a, b) => (b.starLevel || 3) - (a.starLevel || 3))
          .map((c, index) => ({ ...c, rank: index + 1 }));
      } catch (nearbyErr) {
        console.error('Google Places nearby search fallback failed:', nearbyErr);
      }
    }

    return new Response(
      JSON.stringify({
        competitors: finalCompetitors,
        citations: perplexityData.citations || [],
        subjectHotelTripadvisorRank: null,
        subjectHotelStarLevel: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-competitors function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
