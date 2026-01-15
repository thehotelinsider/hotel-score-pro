import { useState } from 'react';
import { ChevronDown, Trophy, Lightbulb } from 'lucide-react';
import { SearchRanking } from '@/types/hotel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SearchRankingItemProps {
  ranking: SearchRanking;
  hotelName?: string;
}

const SearchRankingItem = ({ ranking, hotelName = 'your hotel' }: SearchRankingItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isUnranked = ranking.position === 'unranked';
  
  const getActionRecommendation = (): string => {
    if (isUnranked) {
      return `To start ranking for "${ranking.keyword}", optimize your website's meta title and description to include this keyword. Create dedicated landing page content targeting this search term, and ensure your Google Business Profile mentions relevant amenities and services that match this query.`;
    }
    
    const position = ranking.position as number;
    if (position <= 3) {
      return `Great position! To maintain or improve your #${position} ranking for "${ranking.keyword}", continue updating your content regularly, encourage more guest reviews mentioning this term, and ensure your website loads quickly and is mobile-friendly.`;
    }
    
    if (position <= 10) {
      return `To climb from #${position} to the top 3 for "${ranking.keyword}", enhance your page content with more detailed information about this topic, add high-quality images, build local backlinks, and increase review volume on Google.`;
    }
    
    return `To improve from #${position} for "${ranking.keyword}", focus on creating comprehensive, keyword-rich content, optimize your Google Business Profile, and actively solicit reviews that mention relevant services and amenities.`;
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors -mx-2 px-2 rounded-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-muted-foreground">G</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{ranking.keyword}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isUnranked 
                    ? 'bg-danger/10 text-danger' 
                    : 'bg-success/10 text-success'
                }`}>
                  {isUnranked ? 'Unranked' : `${ranking.position}${getOrdinalSuffix(ranking.position as number)}`}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  #1: {ranking.topCompetitor}
                </span>
              </div>
            </div>
          </div>
          
          <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="pb-4 pt-2 pl-11">
          <div className="bg-accent/10 rounded-lg p-4 border border-accent/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent mb-1">Action:</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getActionRecommendation()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

function getOrdinalSuffix(n: number): string {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || 'th';
}

export default SearchRankingItem;
