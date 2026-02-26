export interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  rating: number;
  reviewCount: number;
  priceLevel: string;
  description: string;
  imageUrl?: string;
  photos?: string[]; // Array of hotel photo URLs
  outsideArea?: boolean; // True if hotel is outside the 100-mile Knoxville, TN radius
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface HotelScore {
  overall: number;
  seo: number;
  website: number;
  reviews: number;
  socialMedia: number;
  ota: number;
}

export interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'seo' | 'website' | 'reviews' | 'social' | 'ota';
  title: string;
  description: string;
  potentialLoss?: number;
}

export interface Competitor {
  id: string;
  name: string;
  rating: number;
  rank: number;
  imageUrl?: string;
  distance?: number; // Distance in miles from subject hotel
  address?: string;
  city?: string;
  state?: string;
}

export interface SearchRanking {
  keyword: string;
  position: number | 'unranked';
  topCompetitor: string;
}

export interface ScanResult {
  hotel: Hotel;
  score: HotelScore;
  issues: Issue[];
  competitors: Competitor[];
  rankings: SearchRanking[];
  photos: string[];
  reviews: Review[];
}

export interface Review {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  text: string;
}

export interface SocialPlatformMetrics {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin';
  hotelMetrics: {
    followers: number;
    posts: number;
    engagement: number; // Engagement rate percentage
    lastPostDate: string;
    contentTypes: string[];
  };
  competitorAverage: {
    followers: number;
    posts: number;
    engagement: number;
  };
  rank: number; // 1 = best among competitors
  totalCompetitors: number;
  status: 'leading' | 'competitive' | 'behind' | 'inactive';
  recommendation: string;
  dataSource?: 'scraped' | 'searched' | 'estimated';
  noDedicatedAccount?: boolean;
}

export interface OTAReviewPlatformMetrics {
  platform: 'tripadvisor' | 'google_reviews' | 'yelp' | 'expedia' | 'booking' | 'agoda';
  platformType: 'review' | 'ota';
  hotelMetrics: {
    rating: number | null;
    reviewCount: number | null;
    responseRate: number | null; // Percentage of reviews responded to
    averageResponseTime: string; // e.g., "Within 24 hours"
    recentReviewSentiment: 'positive' | 'mixed' | 'negative';
    listingCompleteness: number | null; // Percentage 0-100
    lastReviewDate: string;
    bookingRank?: number | null; // For OTAs, position in search results
  };
  competitorAverage: {
    rating: number | null;
    reviewCount: number | null;
    responseRate: number | null;
    listingCompleteness: number | null;
  };
  rank: number; // 1 = best among competitors
  totalCompetitors: number;
  status: 'leading' | 'competitive' | 'behind' | 'not_listed';
  recommendation: string;
}
