import { ChevronDown, Trophy } from 'lucide-react';
import { SearchRanking } from '@/types/hotel';

interface SearchRankingItemProps {
  ranking: SearchRanking;
}

const SearchRankingItem = ({ ranking }: SearchRankingItemProps) => {
  const isUnranked = ranking.position === 'unranked';
  
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
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
      
      <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </div>
  );
};

function getOrdinalSuffix(n: number): string {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || 'th';
}

export default SearchRankingItem;
