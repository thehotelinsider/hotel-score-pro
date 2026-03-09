import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, MapPin, Star, ExternalLink, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProfileItem {
  name: string;
  status: 'complete' | 'incomplete' | 'needs_improvement';
  value?: string;
  action?: string;
}

interface GoogleBusinessProfileProps {
  hotelName: string;
  hotelCity?: string;
  hotelState?: string;
  hotelCountry?: string;
  rating?: number;
  reviewCount?: number;
  onScoreLoaded?: (score: number) => void;
  onDataLoaded?: (data: { rating: number; reviewCount: number }) => void;
}

const getStatusIcon = (status: ProfileItem['status']) => {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'incomplete':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'needs_improvement':
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
  }
};

const getStatusBg = (status: ProfileItem['status']) => {
  switch (status) {
    case 'complete':
      return 'bg-green-500/10 hover:bg-green-500/15';
    case 'incomplete':
      return 'bg-red-500/10 hover:bg-red-500/15';
    case 'needs_improvement':
      return 'bg-amber-500/10 hover:bg-amber-500/15';
  }
};

export const GoogleBusinessProfile = ({
  hotelName,
  hotelCity,
  hotelState,
  hotelCountry,
  rating: initialRating = 4.2,
  reviewCount: initialReviewCount = 856,
  onScoreLoaded,
  onDataLoaded,
}: GoogleBusinessProfileProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [profileItems, setProfileItems] = useState<ProfileItem[]>([]);
  const [rating, setRating] = useState(initialRating);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [score, setScore] = useState(0);

  const fetchGoogleBusinessData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-google-business', {
        body: {
          hotelName,
          hotelCity,
          hotelState,
          hotelCountry,
          hotelRating: initialRating,
          hotelReviewCount: initialReviewCount,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      setProfileItems(data.profileItems || []);
      const finalRating = data.rating || initialRating;
      const finalReviewCount = data.reviewCount || initialReviewCount;
      setRating(finalRating);
      setReviewCount(finalReviewCount);
      const finalScore = data.score || 0;
      setScore(finalScore);
      setHasLoaded(true);
      onScoreLoaded?.(finalScore);
      onDataLoaded?.({ rating: finalRating, reviewCount: finalReviewCount });

    } catch (error) {
      console.error("Error fetching Google Business data:", error);
      toast({
        title: "Analysis failed",
        description: "Could not analyze Google Business Profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (!hasLoaded && hotelName) {
      fetchGoogleBusinessData();
    }
  }, [hotelName]);

  if (!hasLoaded && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Button onClick={fetchGoogleBusinessData} disabled={isLoading}>
          <MapPin className="w-4 h-4 mr-2" />
          Analyze Google Business Profile
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Click to analyze your Google Business Profile
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
        </div>
        <p className="text-muted-foreground mt-4 font-medium">Analyzing Google Business Profile...</p>
        <p className="text-xs text-muted-foreground mt-1">Using AI to gather insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg sm:rounded-xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shadow-sm border border-border flex-shrink-0">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{hotelName}</h3>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <span className="font-medium text-foreground">{rating?.toFixed(1)}</span>
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
              <span className="text-muted-foreground">{reviewCount?.toLocaleString()} reviews</span>
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl font-bold text-foreground">{score}/20</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Profile Score</p>
        </div>
      </div>

      {/* Profile Items Checklist with Collapsible Actions */}
      <div className="space-y-2">
        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground px-1">Profile Content</h4>
        <div className="space-y-1.5 sm:space-y-2">
          {profileItems.map((item, index) => (
            <Collapsible key={index}>
              <CollapsibleTrigger asChild>
                <div
                  className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-colors ${getStatusBg(item.status)}`}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm sm:text-base text-foreground">{item.name}</span>
                      {item.value && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-20 sm:max-w-none">{item.value}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 sm:ml-8 mt-1 p-2.5 sm:p-3 bg-muted/30 rounded-lg border-l-2 border-primary/30">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] sm:text-xs font-semibold text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">
                      Action
                    </span>
                    <p className="text-xs sm:text-sm text-muted-foreground">{item.action}</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
};
