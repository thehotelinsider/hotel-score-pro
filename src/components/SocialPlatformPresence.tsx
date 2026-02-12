import { useState } from 'react';
import { Facebook, Instagram, Youtube, Linkedin, Loader2, Users, FileText, TrendingUp, Trophy, ChevronDown, RefreshCw } from 'lucide-react';
import { SocialPlatformMetrics } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// TikTok icon component since lucide-react doesn't have it
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

interface SocialPlatformPresenceProps {
  platforms: SocialPlatformMetrics[];
  isLoading: boolean;
  onRefresh: () => void;
  hotelName: string;
}

const platformConfig = {
  facebook: { 
    icon: Facebook, 
    label: 'Facebook', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  instagram: { 
    icon: Instagram, 
    label: 'Instagram', 
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200'
  },
  tiktok: { 
    icon: TikTokIcon, 
    label: 'TikTok', 
    color: 'text-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border'
  },
  youtube: { 
    icon: Youtube, 
    label: 'YouTube', 
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  linkedin: { 
    icon: Linkedin, 
    label: 'LinkedIn', 
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'leading': return 'text-success bg-success/10 border-success/20';
    case 'competitive': return 'text-warning bg-warning/10 border-warning/20';
    case 'behind': return 'text-danger bg-danger/10 border-danger/20';
    case 'inactive': return 'text-muted-foreground bg-muted border-border';
    default: return 'text-muted-foreground bg-muted border-border';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'leading': return 'Leading';
    case 'competitive': return 'Competitive';
    case 'behind': return 'Behind';
    case 'inactive': return 'Inactive';
    default: return status;
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const SocialPlatformItem = ({ platform }: { platform: SocialPlatformMetrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = platformConfig[platform.platform];
  const Icon = config.icon;

  const followerDiff = platform.hotelMetrics.followers - platform.competitorAverage.followers;
  const engagementDiff = platform.hotelMetrics.engagement - platform.competitorAverage.engagement;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center justify-between p-4 rounded-xl border ${config.bgColor} ${config.borderColor} hover:shadow-sm transition-all cursor-pointer`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-background`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">{config.label}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {formatNumber(platform.hotelMetrics.followers)} followers
                </p>
                {platform.dataSource && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    platform.dataSource === 'scraped' 
                      ? 'bg-success/10 text-success border border-success/20' 
                      : platform.dataSource === 'searched'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {platform.dataSource === 'scraped' ? 'Verified' : platform.dataSource === 'searched' ? 'Searched' : 'Est.'}
                  </span>
                )}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Followers</span>
              </div>
              <p className="font-semibold text-foreground">{formatNumber(platform.hotelMetrics.followers)}</p>
              <p className={`text-xs ${followerDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                {followerDiff >= 0 ? '+' : ''}{formatNumber(followerDiff)} vs avg
              </p>
            </div>
            
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Posts/mo</span>
              </div>
              <p className="font-semibold text-foreground">{platform.hotelMetrics.posts}</p>
              <p className="text-xs text-muted-foreground">
                Avg: {platform.competitorAverage.posts}
              </p>
            </div>
            
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Engagement</span>
              </div>
              <p className="font-semibold text-foreground">{platform.hotelMetrics.engagement}%</p>
              <p className={`text-xs ${engagementDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                {engagementDiff >= 0 ? '+' : ''}{engagementDiff.toFixed(1)}% vs avg
              </p>
            </div>
          </div>

          {/* Content Types */}
          {platform.hotelMetrics.contentTypes && platform.hotelMetrics.contentTypes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Content Types:</p>
              <div className="flex flex-wrap gap-1.5">
                {platform.hotelMetrics.contentTypes.map((type, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-background rounded-full text-foreground capitalize">
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Recommendation */}
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-xs font-medium text-primary mb-1">Action:</p>
            <p className="text-sm text-foreground">{platform.recommendation}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SocialPlatformPresence = ({ platforms, isLoading, onRefresh, hotelName }: SocialPlatformPresenceProps) => {
  // Calculate overall social score
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
          <h2 className="text-lg font-semibold text-foreground">Social Platform Presence</h2>
          <p className="text-sm text-muted-foreground">
            How {hotelName} compares to competitors on social media
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
          <p className="text-muted-foreground mt-4 font-medium">Analyzing social presence...</p>
          <p className="text-xs text-muted-foreground mt-1">Scanning Facebook, Instagram, TikTok, YouTube & LinkedIn</p>
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No social platform data available yet.</p>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Analyze Social Presence
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {platforms.map((platform, index) => (
              <SocialPlatformItem key={platform.platform || index} platform={platform} />
            ))}
          </div>
          
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

export default SocialPlatformPresence;
