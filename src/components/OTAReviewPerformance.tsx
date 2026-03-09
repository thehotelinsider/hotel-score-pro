import { useState } from 'react';
import { Star, MessageSquare, Clock, TrendingUp, Trophy, ChevronDown, RefreshCw, Loader2, CheckCircle, AlertCircle, XCircle, Building2 } from 'lucide-react';
import { OTAReviewPlatformMetrics } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OTAReviewPerformanceProps {
  platforms: OTAReviewPlatformMetrics[];
  isLoading: boolean;
  onRefresh: () => void;
  hotelName: string;
  googleRating?: number | null;       // real rating from Google Business Profile
  googleReviewCount?: number | null;  // real review count from Google Business Profile
}

// Platform configurations
const platformConfig = {
  tripadvisor: {
    label: 'TripAdvisor',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: '🦉',
  },
  google_reviews: {
    label: 'Google Reviews',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '🔍',
  },
  yelp: {
    label: 'Yelp',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '⭐',
  },
  expedia: {
    label: 'Expedia',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '✈️',
  },
  booking: {
    label: 'Booking.com',
    color: 'text-blue-800',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '🏨',
  },
  agoda: {
    label: 'Agoda',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🌏',
  },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'leading': return 'text-success bg-success/10 border-success/20';
    case 'competitive': return 'text-warning bg-warning/10 border-warning/20';
    case 'behind': return 'text-danger bg-danger/10 border-danger/20';
    case 'not_listed': return 'text-muted-foreground bg-muted border-border';
    default: return 'text-muted-foreground bg-muted border-border';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'leading': return 'Leading';
    case 'competitive': return 'Competitive';
    case 'behind': return 'Behind';
    case 'not_listed': return 'Not Listed';
    default: return status;
  }
};

const getSentimentIcon = (sentiment: string) => {
  switch (sentiment) {
    case 'positive': return <CheckCircle className="w-4 h-4 text-success" />;
    case 'mixed': return <AlertCircle className="w-4 h-4 text-warning" />;
    case 'negative': return <XCircle className="w-4 h-4 text-danger" />;
    default: return null;
  }
};

const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatRating = (rating: number | null | undefined): string => {
  if (rating == null) return 'N/A';
  return rating.toFixed(1);
};

const PlatformItem = ({ platform }: { platform: OTAReviewPlatformMetrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = platformConfig[platform.platform];

  // Safely get numeric values with defaults
  const hotelRating = platform.hotelMetrics?.rating ?? 0;
  const competitorRating = platform.competitorAverage?.rating ?? 0;
  const hotelReviewCount = platform.hotelMetrics?.reviewCount ?? 0;
  const competitorReviewCount = platform.competitorAverage?.reviewCount ?? 0;
  const hotelResponseRate = platform.hotelMetrics?.responseRate ?? 0;
  const competitorResponseRate = platform.competitorAverage?.responseRate ?? 0;

  const ratingDiff = hotelRating - competitorRating;
  const reviewCountDiff = hotelReviewCount - competitorReviewCount;
  const responseRateDiff = hotelResponseRate - competitorResponseRate;
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center justify-between p-4 rounded-xl border ${config.bgColor} ${config.borderColor} hover:shadow-sm transition-all cursor-pointer`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background text-2xl">
              {config.icon}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{config.label}</p>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                  {platform.platformType}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Star className="w-3 h-3 fill-warning text-warning" />
                <span>
                  {platform.hotelMetrics?.originalRating != null && platform.hotelMetrics?.ratingScale
                    ? `${platform.hotelMetrics.originalRating}/${platform.hotelMetrics.ratingScale}`
                    : formatRating(platform.hotelMetrics?.rating)}
                </span>
                <span>•</span>
                <span>{formatNumber(platform.hotelMetrics?.reviewCount)} reviews</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  #{platform.rank} of {platform.totalCompetitors}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(platform.status)}`}>
                {getStatusLabel(platform.status)}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 p-4 bg-muted/50 rounded-xl space-y-4">
          {/* Metrics Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">Rating</span>
              </div>
              <p className="font-semibold text-foreground">
                {platform.hotelMetrics?.originalRating != null && platform.hotelMetrics?.ratingScale
                  ? `${platform.hotelMetrics.originalRating} / ${platform.hotelMetrics.ratingScale}`
                  : `${formatRating(platform.hotelMetrics?.rating)} / 5`}
              </p>
              <p className={`text-xs ${ratingDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                {ratingDiff >= 0 ? '+' : ''}{ratingDiff.toFixed(1)} vs avg
              </p>
            </div>

            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Reviews</span>
              </div>
              <p className="font-semibold text-foreground">{formatNumber(platform.hotelMetrics?.reviewCount)}</p>
              <p className={`text-xs ${reviewCountDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                {reviewCountDiff >= 0 ? '+' : ''}{formatNumber(reviewCountDiff)} vs avg
              </p>
            </div>

            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Response Rate</span>
              </div>
              <p className="font-semibold text-foreground">{platform.hotelMetrics?.responseRate ?? 0}%</p>
              <p className={`text-xs ${responseRateDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                {responseRateDiff >= 0 ? '+' : ''}{responseRateDiff}% vs avg
              </p>
            </div>

            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Listing Complete</span>
              </div>
              <p className="font-semibold text-foreground">{platform.hotelMetrics?.listingCompleteness ?? 0}%</p>
              <p className="text-xs text-muted-foreground">
                Avg: {platform.competitorAverage?.listingCompleteness ?? 0}%
              </p>
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
              <span className="text-xs text-muted-foreground">Response Time:</span>
              <span className="text-xs font-medium text-foreground">{platform.hotelMetrics?.averageResponseTime ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
              <span className="text-xs text-muted-foreground">Recent Sentiment:</span>
              <div className="flex items-center gap-1">
                {getSentimentIcon(platform.hotelMetrics?.recentReviewSentiment ?? '')}
                <span className="text-xs font-medium text-foreground capitalize">{platform.hotelMetrics?.recentReviewSentiment ?? 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Booking Rank for OTAs */}
          {platform.platformType === 'ota' && platform.hotelMetrics.bookingRank && (
            <div className="flex items-center gap-2 p-2 bg-accent/10 rounded-lg border border-accent/20">
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-sm text-foreground">
                Booking Search Position: <span className="font-semibold">#{platform.hotelMetrics.bookingRank}</span>
              </span>
            </div>
          )}

          {/* Action Recommendation */}
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-xs font-medium text-primary mb-1">Recommended Action:</p>
            <p className="text-sm text-foreground">{platform.recommendation}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const OTAReviewPerformance = ({ platforms, isLoading, onRefresh, hotelName, googleRating, googleReviewCount }: OTAReviewPerformanceProps) => {
  // Override google_reviews entry with authoritative data from Google Business Profile
  const mergedPlatforms = platforms.map(p => {
    if (p.platform === 'google_reviews') {
      return {
        ...p,
        hotelMetrics: {
          ...p.hotelMetrics,
          ...(googleRating != null ? { rating: googleRating, originalRating: googleRating, ratingScale: 5 } : {}),
          ...(googleReviewCount != null ? { reviewCount: googleReviewCount } : {}),
        },
      };
    }
    return p;
  });

  // Separate by type
  const reviewPlatforms = mergedPlatforms.filter(p => p.platformType === 'review');
  const otaPlatforms = mergedPlatforms.filter(p => p.platformType === 'ota');

  // Calculate overall status
  const getOverallStatus = () => {
    if (!platforms.length) return null;
    const avgRank = platforms.reduce((sum, p) => sum + p.rank, 0) / platforms.length;
    const totalCompetitors = platforms[0]?.totalCompetitors || 5;

    if (avgRank <= 2) return { label: 'Strong', color: 'text-success' };
    if (avgRank <= Math.ceil(totalCompetitors / 2)) return { label: 'Moderate', color: 'text-warning' };
    return { label: 'Needs Work', color: 'text-danger' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">OTA and Review Website Performance</h2>
          <p className="text-sm text-muted-foreground">
            How {hotelName} ranks on review and booking platforms vs competitors
          </p>
        </div>
        {overallStatus && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Overall</p>
            <p className={`font-semibold ${overallStatus.color}`}>{overallStatus.label}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
          </div>
          <p className="text-muted-foreground mt-4 font-medium">Analyzing OTA & review platforms...</p>
          <p className="text-xs text-muted-foreground mt-1">Scanning TripAdvisor, Google, Yelp, Booking.com & more</p>
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No OTA or review platform data available yet.</p>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Analyze Platform Performance
          </Button>
        </div>
      ) : (
        <>
          {/* Review Platforms Section */}
          {reviewPlatforms.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Review Platforms
              </h3>
              <div className="space-y-3">
                {reviewPlatforms.map((platform, index) => (
                  <PlatformItem key={platform.platform || index} platform={platform} />
                ))}
              </div>
            </div>
          )}

          {/* OTA Platforms Section */}
          {otaPlatforms.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                OTA Platforms
              </h3>
              <div className="space-y-3">
                {otaPlatforms.map((platform, index) => (
                  <PlatformItem key={platform.platform || index} platform={platform} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default OTAReviewPerformance;
