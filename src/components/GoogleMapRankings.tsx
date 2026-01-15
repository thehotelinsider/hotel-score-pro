import { useState } from 'react';
import { MapPin, Star, Users, Navigation, Loader2, RefreshCw, ChevronDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface MapRanking {
  hotelName: string;
  rank: number;
  rating: number;
  reviewCount: number;
  distance: string;
  isSubjectHotel: boolean;
}

interface GoogleMapRankingsProps {
  rankings: MapRanking[];
  isLoading: boolean;
  onRefresh: () => void;
  hotelName: string;
}

const GoogleMapRankings = ({ rankings, isLoading, onRefresh, hotelName }: GoogleMapRankingsProps) => {
  const [expandedRank, setExpandedRank] = useState<number | null>(null);

  const subjectHotelRank = rankings.find(r => r.isSubjectHotel)?.rank;
  const hotelsAbove = subjectHotelRank ? subjectHotelRank - 1 : 0;

  const getActionRecommendation = (ranking: MapRanking): string => {
    if (ranking.isSubjectHotel) {
      if (ranking.rank <= 3) {
        return "Excellent position! Maintain this by consistently responding to reviews and keeping your Google Business Profile updated with fresh photos and accurate information.";
      } else if (ranking.rank <= 5) {
        return "Good position but room to improve. Focus on getting more 5-star reviews by asking satisfied guests to leave feedback. Update your Google Business Profile weekly with new photos and posts.";
      } else {
        return "Your map visibility needs attention. Prioritize: 1) Respond to ALL reviews within 24 hours, 2) Add 10+ new high-quality photos monthly, 3) Post weekly updates on Google Business Profile, 4) Ensure NAP (Name, Address, Phone) consistency across all platforms.";
      }
    } else {
      // Competitor analysis
      if (ranking.rank < (subjectHotelRank || 10)) {
        const reviewDiff = ranking.reviewCount - (rankings.find(r => r.isSubjectHotel)?.reviewCount || 0);
        if (reviewDiff > 500) {
          return `This competitor has ${reviewDiff.toLocaleString()} more reviews than you. Launch a review generation campaign targeting recent guests via email and in-room QR codes.`;
        } else if (ranking.rating > (rankings.find(r => r.isSubjectHotel)?.rating || 0)) {
          return `Their higher rating (${ranking.rating}★) is boosting their visibility. Focus on service improvements and addressing common complaints in your reviews.`;
        }
        return `Analyze what makes ${ranking.hotelName} rank higher - check their Google Business Profile for posting frequency, photo quality, and response patterns.`;
      }
      return `You're outranking this competitor. Monitor their activity to maintain your advantage and continue your current strategies.`;
    }
  };

  const getRankBadgeColor = (rank: number, isSubject: boolean): string => {
    if (isSubject) {
      if (rank <= 3) return 'bg-success/20 text-success border-success/30';
      if (rank <= 5) return 'bg-warning/20 text-warning border-warning/30';
      return 'bg-danger/20 text-danger border-danger/30';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Google Map Results</h2>
            <p className="text-sm text-muted-foreground">
              Your ranking in "Hotels near me" searches
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading && rankings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
          </div>
          <p className="text-muted-foreground mt-4 font-medium">Analyzing Google Maps rankings...</p>
          <p className="text-xs text-muted-foreground mt-1">Comparing your position against competitors</p>
        </div>
      )}

      {!isLoading && rankings.length === 0 && (
        <div className="text-center py-8">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No map ranking data available</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4">
            Load Rankings
          </Button>
        </div>
      )}

      {rankings.length > 0 && (
        <>
          {/* Summary */}
          {subjectHotelRank && (
            <div className={`mb-4 p-4 rounded-xl border ${
              subjectHotelRank <= 3 
                ? 'bg-success/10 border-success/20' 
                : subjectHotelRank <= 5 
                  ? 'bg-warning/10 border-warning/20'
                  : 'bg-danger/10 border-danger/20'
            }`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-5 h-5 ${
                  subjectHotelRank <= 3 ? 'text-success' : subjectHotelRank <= 5 ? 'text-warning' : 'text-danger'
                }`} />
                <p className="font-medium text-foreground">
                  You're ranking #{subjectHotelRank} out of {rankings.length} hotels
                  {hotelsAbove > 0 && ` (${hotelsAbove} competitor${hotelsAbove > 1 ? 's' : ''} above you)`}
                </p>
              </div>
            </div>
          )}

          {/* Rankings List */}
          <div className="space-y-0 divide-y divide-border">
            {rankings.map((ranking) => (
              <Collapsible
                key={ranking.rank}
                open={expandedRank === ranking.rank}
                onOpenChange={(open) => setExpandedRank(open ? ranking.rank : null)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
                    ranking.isSubjectHotel ? 'bg-primary/5' : ''
                  }`}>
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm ${
                      getRankBadgeColor(ranking.rank, ranking.isSubjectHotel)
                    }`}>
                      {ranking.rank}
                    </div>

                    {/* Hotel Info */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${
                          ranking.isSubjectHotel ? 'text-primary' : 'text-foreground'
                        }`}>
                          {ranking.hotelName}
                          {ranking.isSubjectHotel && (
                            <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                              Your Hotel
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-warning text-warning" />
                          {ranking.rating}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ranking.reviewCount.toLocaleString()} reviews
                        </span>
                        <span className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {ranking.distance}
                        </span>
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${
                      expandedRank === ranking.rank ? 'rotate-180' : ''
                    }`} />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className={`px-3 pb-3 pt-1 ml-11 ${
                    ranking.isSubjectHotel ? 'bg-primary/5' : ''
                  }`}>
                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs font-medium text-primary mb-1">Action:</p>
                      <p className="text-sm text-muted-foreground">
                        {getActionRecommendation(ranking)}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GoogleMapRankings;
