import { useState, useEffect } from 'react';
import { ScanResult, Competitor, SocialPlatformMetrics, OTAReviewPlatformMetrics } from '@/types/hotel';
import ScoreCircle from './ScoreCircle';
import IssueCard from './IssueCard';
import CompetitorList from './CompetitorList';
import SearchRankingItem from './SearchRankingItem';
import AiRecommendations from './AiRecommendations';
import WebsiteScanResults from './WebsiteScanResults';
import SocialPlatformPresence from './SocialPlatformPresence';
import GoogleMapRankings, { MapRanking } from './GoogleMapRankings';
import OTAReviewPerformance from './OTAReviewPerformance';
import { Button } from '@/components/ui/button';
import { List, Map, Sparkles, ExternalLink, Loader2, Brain, RefreshCw, TrendingDown, Globe, Search, Trophy, ScanLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WebsiteIssue {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'content' | 'mobile' | 'security';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

interface WebsiteScanData {
  totalItemsScanned: number;
  itemsNeedingAttention: number;
  issues: WebsiteIssue[];
  scannedCategories: string[];
}

interface ScoreCardProps {
  result: ScanResult;
  onCompetitorsRegenerated?: (competitors: Competitor[]) => void;
}

const ScoreCard = ({ result, onCompetitorsRegenerated }: ScoreCardProps) => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>(result.competitors);
  const [isRegeneratingCompetitors, setIsRegeneratingCompetitors] = useState(false);
  const [revenueEstimate, setRevenueEstimate] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [websiteScanData, setWebsiteScanData] = useState<WebsiteScanData | null>(null);
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatformMetrics[]>([]);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [mapRankings, setMapRankings] = useState<MapRanking[]>([]);
  const [isLoadingMapRankings, setIsLoadingMapRankings] = useState(false);
  const [otaReviewPlatforms, setOtaReviewPlatforms] = useState<OTAReviewPlatformMetrics[]>([]);
  const [isLoadingOtaReviews, setIsLoadingOtaReviews] = useState(false);

  const scanWebsite = async () => {
    setIsScanning(true);
    setWebsiteScanData(null);
    
    try {
      // Generate a website URL from the hotel name
      const websiteUrl = `${result.hotel.name.toLowerCase().replace(/\s+/g, '')}.com`;
      
      const { data, error } = await supabase.functions.invoke('scan-website', {
        body: { 
          websiteUrl,
          hotelName: result.hotel.name
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      if (data?.success) {
        setWebsiteScanData({
          totalItemsScanned: data.totalItemsScanned,
          itemsNeedingAttention: data.itemsNeedingAttention,
          issues: data.issues,
          scannedCategories: data.scannedCategories,
        });
        
        toast({
          title: "Website scan complete",
          description: `Found ${data.itemsNeedingAttention} items that need attention.`,
        });
      }
    } catch (error) {
      console.error('Error scanning website:', error);
      toast({
        title: "Failed to scan website",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const fetchSocialPresence = async () => {
    setIsLoadingSocial(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-social-presence', {
        body: { 
          hotel: result.hotel,
          competitors: competitors.slice(0, 5)
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      if (data?.success && data.platforms) {
        setSocialPlatforms(data.platforms);
        toast({
          title: "Social analysis complete",
          description: `Analyzed ${data.platforms.length} social platforms.`,
        });
      }
    } catch (error) {
      console.error('Error analyzing social presence:', error);
      toast({
        title: "Failed to analyze social presence",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSocial(false);
    }
  };

  const fetchMapRankings = async () => {
    setIsLoadingMapRankings(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-map-rankings', {
        body: { 
          hotel: result.hotel,
          competitors: competitors.slice(0, 10)
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      if (data?.success && data.rankings) {
        setMapRankings(data.rankings);
        toast({
          title: "Map rankings loaded",
          description: `Found your position among ${data.rankings.length} nearby hotels.`,
        });
      }
    } catch (error) {
      console.error('Error fetching map rankings:', error);
      toast({
        title: "Failed to load map rankings",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMapRankings(false);
    }
  };

  const fetchOtaReviews = async () => {
    setIsLoadingOtaReviews(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-ota-reviews', {
        body: { 
          hotel: result.hotel,
          competitors: competitors.slice(0, 5)
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      if (data?.success && data.platforms) {
        setOtaReviewPlatforms(data.platforms);
        toast({
          title: "OTA & Review analysis complete",
          description: `Analyzed ${data.platforms.length} platforms.`,
        });
      }
    } catch (error) {
      console.error('Error analyzing OTA and review platforms:', error);
      toast({
        title: "Failed to analyze OTA & review platforms",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOtaReviews(false);
    }
  };

  // Auto-fetch social presence when component mounts
  useEffect(() => {
    if (competitors.length > 0 && socialPlatforms.length === 0 && !isLoadingSocial) {
      fetchSocialPresence();
    }
  }, [competitors]);

  // Auto-fetch map rankings when component mounts
  useEffect(() => {
    if (competitors.length > 0 && mapRankings.length === 0 && !isLoadingMapRankings) {
      fetchMapRankings();
    }
  }, [competitors]);

  // Auto-fetch OTA and review platforms when component mounts
  useEffect(() => {
    if (competitors.length > 0 && otaReviewPlatforms.length === 0 && !isLoadingOtaReviews) {
      fetchOtaReviews();
    }
  }, [competitors]);

  const regenerateCompetitors = async () => {
    setIsRegeneratingCompetitors(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-competitors', {
        body: { hotel: result.hotel },
      });

      if (error) {
        throw error;
      }

      if (data?.competitors) {
        // Merge new competitors with existing ones, avoiding duplicates by name
        setCompetitors(prevCompetitors => {
          const existingNames = new Set(prevCompetitors.map(c => c.name.toLowerCase()));
          const newCompetitors = data.competitors.filter(
            (c: Competitor) => !existingNames.has(c.name.toLowerCase())
          );
          const merged = [...prevCompetitors, ...newCompetitors];
          // Re-rank all competitors by their rating (higher rating = better rank)
          const ranked = merged
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .map((c, index) => ({ ...c, rank: index + 1 }));
          return ranked;
        });
        
        const existingNames = new Set(competitors.map(c => c.name.toLowerCase()));
        const addedCount = data.competitors.filter(
          (c: Competitor) => !existingNames.has(c.name.toLowerCase())
        ).length;
        
        onCompetitorsRegenerated?.(data.competitors);
        toast({
          title: "Competitors updated",
          description: addedCount > 0 
            ? `Added ${addedCount} new competitors near ${result.hotel.city || 'your location'}.`
            : `No new competitors found. Try again for different results.`,
        });
      }
    } catch (error) {
      console.error('Error regenerating competitors:', error);
      toast({
        title: "Failed to regenerate competitors",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingCompetitors(false);
    }
  };

  const fetchAiRecommendations = async () => {
    setIsLoadingAi(true);
    try {
      const hotelData = {
        name: result.hotel.name,
        address: result.hotel.address,
        city: result.hotel.city,
        state: result.hotel.state,
        rating: result.hotel.rating,
        reviewCount: result.hotel.reviewCount,
        score: result.score,
        issues: result.issues,
        competitors: result.competitors,
        rankings: result.rankings,
      };

      const { data, error } = await supabase.functions.invoke('analyze-hotel', {
        body: { hotelData },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else if (data.error.includes('credits')) {
          toast({
            title: "AI credits exhausted",
            description: "Please add credits to continue using AI features.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setAiRecommendations(data.recommendations);
      setShowRecommendations(true);
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      toast({
        title: "Failed to get AI recommendations",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const totalPotentialLoss = result.issues
    .filter(i => i.potentialLoss)
    .reduce((sum, i) => sum + (i.potentialLoss || 0), 0);

  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  
  // Calculate monthly loss estimate based on Overall Online Health Score tiers
  const getScoreBasedMonthlyLoss = (score: number): { min: number; max: number } => {
    if (score >= 90) {
      // Excellent (0–0.5%): $200–$1,463 / month
      return { min: 200, max: 1463 };
    } else if (score >= 70) {
      // Good (0–2%): $1,000–$5,850 / month
      return { min: 1000, max: 5850 };
    } else if (score >= 50) {
      // Fair (2–6%): $5,850–$17,550 / month
      return { min: 5850, max: 17550 };
    } else {
      // Low (6–12%): $17,550–$35,100 / month
      return { min: 17550, max: 35100 };
    }
  };
  
  const lossRange = getScoreBasedMonthlyLoss(result.score.overall);
  // Use midpoint of range for display, or weighted based on how far into the tier they are
  const monthlyLoss = Math.round((lossRange.min + lossRange.max) / 2);
  const monthlyLossRange = lossRange;

  // Get SEO health status
  const seoScore = result.score.seo;
  const getSeoHealthStatus = () => {
    if (seoScore >= 80) return { label: 'Good', color: 'text-success' };
    if (seoScore >= 60) return { label: 'Needs work', color: 'text-warning' };
    return { label: 'Poor', color: 'text-danger' };
  };
  const seoHealth = getSeoHealthStatus();

  // Get website issues
  const websiteIssues = result.issues.filter(i => i.category === 'website' || i.category === 'seo');
  
  // Get search ranking health
  const rankedKeywords = result.rankings.filter(r => typeof r.position === 'number').length;
  const totalKeywords = result.rankings.length;
  const searchHealthPercent = totalKeywords > 0 ? Math.round((rankedKeywords / totalKeywords) * 100) : 0;

  // Get strongest competitor (rank 1 or highest rated)
  const strongestCompetitor = competitors.length > 0 
    ? competitors.reduce((best, current) => 
        (current.rating || 0) > (best.rating || 0) ? current : best
      )
    : null;

  return (
    <div className="min-h-screen pt-20 pb-24 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hotel header card */}
        <div className="bg-gradient-to-br from-warning/5 to-accent/5 rounded-2xl p-6 border border-warning/20 animate-fade-in">
          <div className="flex items-start gap-4">
            {/* Hotel image placeholder */}
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-accent to-warning overflow-hidden flex-shrink-0">
              {result.photos[0] ? (
                <img 
                  src={result.photos[0]} 
                  alt={result.hotel.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                  {result.hotel.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-display font-bold text-foreground truncate">
                {result.hotel.name}
              </h1>
              <a 
                href="#" 
                className="text-sm text-accent hover:underline flex items-center gap-1"
              >
                {result.hotel.name.toLowerCase().replace(/\s+/g, '')}.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ScoreCircle score={result.score.overall} size="md" />
          </div>

          {/* Potential loss warning - Enhanced Summary */}
          <div className="mt-6 p-4 bg-warning/10 rounded-xl border border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-warning" />
              <p className="text-lg font-semibold text-foreground">
                You could be losing ~${monthlyLossRange.min.toLocaleString()}–${monthlyLossRange.max.toLocaleString()}/month
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* SEO Health */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">SEO Health</p>
                  <p className={`text-sm font-medium ${seoHealth.color}`}>
                    {seoHealth.label} ({seoScore}/100)
                  </p>
                </div>
              </div>
              
              {/* Website Issues */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Website</p>
                  <p className={`text-sm font-medium ${websiteIssues.length > 3 ? 'text-danger' : websiteIssues.length > 0 ? 'text-warning' : 'text-success'}`}>
                    {websiteIssues.length} {websiteIssues.length === 1 ? 'issue' : 'issues'} found
                  </p>
                </div>
              </div>
              
              {/* Search Results */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Search Visibility</p>
                  <p className={`text-sm font-medium ${searchHealthPercent >= 70 ? 'text-success' : searchHealthPercent >= 40 ? 'text-warning' : 'text-danger'}`}>
                    {rankedKeywords}/{totalKeywords} keywords ranked
                  </p>
                </div>
              </div>
              
              {/* Top Competitor */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Top Competitor</p>
                  <p className="text-sm font-medium text-foreground truncate" title={strongestCompetitor?.name}>
                    {strongestCompetitor ? `${strongestCompetitor.name.length > 15 ? strongestCompetitor.name.slice(0, 15) + '...' : strongestCompetitor.name} (${strongestCompetitor.rating}★)` : 'None found'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What is SEO and GEO? */}
        <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">What is SEO and GEO?</h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">SEO (Search Engine Optimization)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                SEO is the practice of optimizing your website and online presence to rank higher in search engine results like Google. It helps potential guests find your hotel when searching for accommodations in your area.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-medium text-foreground">GEO (Generative Engine Optimization)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                GEO is the emerging practice of optimizing your content to appear in AI-powered search results and chatbots like ChatGPT, Perplexity, and Google AI Overviews. As more travelers use AI assistants to plan trips, GEO ensures your hotel gets recommended.
              </p>
            </div>
          </div>
        </div>

        {/* Competitor ranking */}
        <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              You're ranking below {competitors.filter(c => c.rank < 4).length} competitors
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateCompetitors}
              disabled={isRegeneratingCompetitors}
              className="flex items-center gap-2"
            >
              {isRegeneratingCompetitors ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isRegeneratingCompetitors ? 'Generating...' : 'Generate new competitors'}
            </Button>
          </div>
          <CompetitorList 
            competitors={competitors.slice(0, 6)} 
            currentHotelName={result.hotel.name}
            currentHotelRank={4}
          />
        </div>

        {/* AI Recommendations Section */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 rounded-2xl p-6 border border-primary/20 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">AI-Powered Recommendations</h3>
              <p className="text-xs text-muted-foreground">Personalized insights to boost your online presence</p>
            </div>
          </div>
          
          {!aiRecommendations && !isLoadingAi && (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h4 className="font-medium text-foreground mb-2">Unlock AI Insights</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Our AI will analyze your hotel's data and provide actionable recommendations to improve rankings and revenue
              </p>
              <Button 
                onClick={fetchAiRecommendations}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Recommendations
              </Button>
            </div>
          )}

          {isLoadingAi && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
              </div>
              <p className="text-muted-foreground mt-4 font-medium">Analyzing your hotel data...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a few moments</p>
            </div>
          )}

          {showRecommendations && aiRecommendations && (
            <div className="mt-2">
              <AiRecommendations 
                recommendations={aiRecommendations} 
                onRevenueEstimateExtracted={setRevenueEstimate}
              />
              <div className="mt-4 pt-4 border-t border-border flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchAiRecommendations}
                  disabled={isLoadingAi}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingAi ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* AI Fix CTA */}
        <div className="bg-gradient-to-r from-muted to-secondary rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent">
              <ScanLine className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">AI Website Optimization</h3>
              <p className="text-xs text-muted-foreground">See what's wrong and how to improve</p>
            </div>
          </div>
          
          {!websiteScanData && !isScanning && (
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Fix your website in seconds using AI
              </h3>
              <Button 
                onClick={scanWebsite}
                disabled={isScanning}
                className="mt-4 bg-primary text-primary-foreground px-8 py-6 text-lg rounded-xl"
              >
                <ScanLine className="w-5 h-5 mr-2" />
                Get started
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                We'll scan your website and identify items that need attention.
              </p>
            </div>
          )}

          {isScanning && (
            <div className="text-center py-8">
              <div className="relative inline-block">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <div className="absolute -inset-2 rounded-2xl bg-primary/10 animate-pulse" />
              </div>
              <p className="text-foreground mt-4 font-medium">Scanning your website...</p>
              <p className="text-xs text-muted-foreground mt-1">Analyzing SEO, performance, accessibility, and more</p>
            </div>
          )}

          {websiteScanData && (
            <div className="mt-4">
              <WebsiteScanResults 
                totalItemsScanned={websiteScanData.totalItemsScanned}
                itemsNeedingAttention={websiteScanData.itemsNeedingAttention}
                issues={websiteScanData.issues}
                scannedCategories={websiteScanData.scannedCategories}
              />
              <div className="mt-4 pt-4 border-t border-border flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={scanWebsite}
                  disabled={isScanning}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                  Scan Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Search rankings */}
        <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Online Customer Search Inquiries
              </h2>
              <p className="text-sm text-muted-foreground">
                Where your hotel is showing up in customer search inquires, next to your competitors
              </p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-card shadow-sm' : ''
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'map' ? 'bg-card shadow-sm' : ''
                }`}
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border">
            {result.rankings.map((ranking, index) => (
              <SearchRankingItem key={index} ranking={ranking} />
            ))}
          </div>
        </div>

        {/* OTA and Review Website Performance */}
        <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
          <OTAReviewPerformance
            platforms={otaReviewPlatforms}
            isLoading={isLoadingOtaReviews}
            onRefresh={fetchOtaReviews}
            hotelName={result.hotel.name}
          />
        </div>

        {/* Social Platform Presence */}
        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <SocialPlatformPresence
            platforms={socialPlatforms}
            isLoading={isLoadingSocial}
            onRefresh={fetchSocialPresence}
            hotelName={result.hotel.name}
          />
        </div>

        {/* Google Map Results */}
        <div className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <GoogleMapRankings
            rankings={mapRankings}
            isLoading={isLoadingMapRankings}
            onRefresh={fetchMapRankings}
            hotelName={result.hotel.name}
          />
        </div>

      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-2xl mx-auto">
          <Button className="w-full bg-primary text-primary-foreground py-6 rounded-xl flex items-center justify-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-accent border-2 border-primary" />
              <div className="w-6 h-6 rounded-full bg-warning border-2 border-primary" />
              <div className="w-6 h-6 rounded-full bg-success border-2 border-primary" />
            </div>
            <span className="font-medium">Book a consult</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;
