import { Hotel, ScanResult, Issue, Competitor, SearchRanking, Review } from '@/types/hotel';

export const mockHotels: Hotel[] = [
  {
    id: '1',
    name: 'The Grand Marriott Downtown',
    address: '123 Main Street',
    city: 'Nashville',
    state: 'TN',
    country: 'USA',
    rating: 4.2,
    reviewCount: 1247,
    priceLevel: '$$$$',
    description: 'Luxury hotel in the heart of downtown with stunning city views',
    coordinates: { lat: 36.1627, lng: -86.7816 }
  },
  {
    id: '2',
    name: 'Hilton Garden Inn Airport',
    address: '456 Airport Blvd',
    city: 'Nashville',
    state: 'TN',
    country: 'USA',
    rating: 4.0,
    reviewCount: 892,
    priceLevel: '$$$',
    description: 'Convenient airport hotel with complimentary shuttle service',
    coordinates: { lat: 36.1245, lng: -86.6781 }
  },
  {
    id: '3',
    name: 'The Hermitage Hotel',
    address: '231 6th Avenue North',
    city: 'Nashville',
    state: 'TN',
    country: 'USA',
    rating: 4.8,
    reviewCount: 2156,
    priceLevel: '$$$$$',
    description: 'Historic luxury hotel with world-class dining and service',
    coordinates: { lat: 36.1656, lng: -86.7823 }
  },
  {
    id: '4',
    name: 'Courtyard by Marriott Music Row',
    address: '789 Division Street',
    city: 'Nashville',
    state: 'TN',
    country: 'USA',
    rating: 4.1,
    reviewCount: 634,
    priceLevel: '$$$',
    description: 'Modern hotel near Music Row and downtown attractions',
    coordinates: { lat: 36.1512, lng: -86.7912 }
  },
  {
    id: '5',
    name: 'Four Seasons Resort Palm Beach',
    address: '2800 South Ocean Boulevard',
    city: 'Palm Beach',
    state: 'FL',
    country: 'USA',
    rating: 4.9,
    reviewCount: 3421,
    priceLevel: '$$$$$',
    description: 'Beachfront luxury resort with world-class spa and dining',
    coordinates: { lat: 26.6857, lng: -80.0344 }
  }
];

export const mockIssues: Issue[] = [
  {
    id: '1',
    severity: 'critical',
    category: 'seo',
    title: 'H1 doesn\'t mention the service area',
    description: 'Your main heading should include your location to improve local search rankings.',
    potentialLoss: 450
  },
  {
    id: '2',
    severity: 'critical',
    category: 'seo',
    title: 'H1 is missing relevant keywords',
    description: 'Include keywords like "hotel", "luxury", or "boutique" in your heading.',
    potentialLoss: 320
  },
  {
    id: '3',
    severity: 'critical',
    category: 'website',
    title: 'Images are missing "alt" tags',
    description: '12 images on your website lack alt text, hurting accessibility and SEO.',
    potentialLoss: 180
  },
  {
    id: '4',
    severity: 'warning',
    category: 'website',
    title: 'Page load speed is slow',
    description: 'Your homepage takes 4.2 seconds to load. Aim for under 3 seconds.',
    potentialLoss: 150
  },
  {
    id: '5',
    severity: 'warning',
    category: 'reviews',
    title: 'Low response rate to reviews',
    description: 'You\'ve responded to only 23% of reviews. Aim for 80%+.',
    potentialLoss: 200
  },
  {
    id: '6',
    severity: 'info',
    category: 'social',
    title: 'Instagram posting frequency is low',
    description: 'You post an average of 2 times per month. Competitors post 8+ times.',
  },
  {
    id: '7',
    severity: 'warning',
    category: 'ota',
    title: 'Missing content on Booking.com',
    description: 'Your Booking.com listing is missing 5 amenity descriptions.',
    potentialLoss: 280
  }
];

// Static mock competitors - these will be replaced by AI-generated competitors
export const mockCompetitors: Competitor[] = [
  { id: '1', name: 'The Hermitage Hotel', rating: 4.8, rank: 1, distance: 0.3, address: '231 6th Ave N', city: 'Nashville', state: 'TN' },
  { id: '2', name: 'JW Marriott Nashville', rating: 4.6, rank: 2, distance: 0.5, address: '201 8th Ave S', city: 'Nashville', state: 'TN' },
  { id: '3', name: 'The Westin Nashville', rating: 4.5, rank: 3, distance: 0.8, address: '807 Clark Pl', city: 'Nashville', state: 'TN' },
  { id: '4', name: 'Thompson Nashville', rating: 4.4, rank: 5, distance: 1.2, address: '401 11th Ave S', city: 'Nashville', state: 'TN' },
  { id: '5', name: 'Kimpton Aertson Hotel', rating: 4.3, rank: 6, distance: 2.1, address: '2021 Broadway', city: 'Nashville', state: 'TN' },
];

export const mockRankings: SearchRanking[] = [
  { keyword: 'Best luxury hotel in Nashville', position: 'unranked', topCompetitor: 'The Hermitage Hotel' },
  { keyword: 'Nashville downtown hotels', position: 4, topCompetitor: 'JW Marriott Nashville' },
  { keyword: 'Best fine dining hotel Nashville', position: 2, topCompetitor: 'The Hermitage Hotel' },
  { keyword: 'Nashville boutique hotels', position: 'unranked', topCompetitor: 'Noelle Nashville' },
  { keyword: 'Hotels near Broadway Nashville', position: 3, topCompetitor: 'Thompson Nashville' },
  { keyword: 'Romantic hotels Nashville', position: 'unranked', topCompetitor: 'The Hermitage Hotel' }
];

export const mockReviews: Review[] = [
  {
    id: '1',
    author: 'Sarah Mitchell',
    rating: 5,
    date: '2 weeks ago',
    text: 'Absolutely stunning hotel! The service was impeccable and the room had the most amazing view of the city. Will definitely be back!'
  },
  {
    id: '2',
    author: 'James Cooper',
    rating: 5,
    date: '1 month ago',
    text: 'Best hotel experience in Nashville. The staff went above and beyond to make our anniversary special. Highly recommend the rooftop bar.'
  },
  {
    id: '3',
    author: 'Emily Rodriguez',
    rating: 4,
    date: '1 month ago',
    text: 'Great location and beautiful rooms. The only downside was the restaurant was a bit slow during breakfast. Otherwise perfect!'
  },
  {
    id: '4',
    author: 'Michael Chen',
    rating: 5,
    date: '2 months ago',
    text: 'We stayed here for a business conference and couldn\'t have been happier. The meeting facilities were top-notch.'
  },
  {
    id: '5',
    author: 'Amanda Foster',
    rating: 3,
    date: '3 weeks ago',
    text: 'Nice hotel but felt a bit overpriced for what you get. The spa was good though and location is unbeatable.'
  }
];

export const mockHotelPhotos = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400&h=300&fit=crop'
];

export function generateMockScanResult(hotel: Hotel): ScanResult {
  // Generate individual sub-scores independently
  const seo = Math.floor(Math.random() * 40) + 40;  // 40–79
  const website = Math.floor(Math.random() * 35) + 55;  // 55–89
  const reviews = Math.floor(Math.random() * 25) + 65;  // 65–89
  const socialMedia = Math.floor(Math.random() * 50) + 30;  // 30–79
  const ota = Math.floor(Math.random() * 30) + 60;  // 60–89

  // Overall = weighted average of all five sub-scores:
  //   Reviews     30% — primary guest trust signal
  //   SEO         25% — online discoverability
  //   OTA         20% — direct booking channel impact
  //   Website     15% — brand & conversion foundation
  //   Social      10% — awareness & engagement
  const overall = Math.round(
    reviews * 0.30 +
    seo * 0.25 +
    ota * 0.20 +
    website * 0.15 +
    socialMedia * 0.10
  );

  const score = { overall, seo, website, reviews, socialMedia, ota };

  return {
    hotel,
    score,
    issues: mockIssues.slice(0, Math.floor(Math.random() * 4) + 4),
    competitors: mockCompetitors,
    rankings: mockRankings,
    photos: mockHotelPhotos,
    reviews: mockReviews
  };
}
