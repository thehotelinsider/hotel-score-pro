import { Star, Utensils, MapPin } from 'lucide-react';
import { Competitor } from '@/types/hotel';

interface CompetitorListProps {
  competitors: Competitor[];
  currentHotelName: string;
  currentHotelRank: number;
}

const CompetitorList = ({ competitors, currentHotelName, currentHotelRank }: CompetitorListProps) => {
  const allEntries = [
    ...competitors.filter(c => c.rank < currentHotelRank),
    { id: 'current', name: currentHotelName, rating: 4.2, rank: currentHotelRank, isCurrent: true },
    ...competitors.filter(c => c.rank > currentHotelRank),
  ].sort((a, b) => a.rank - b.rank);

  const getRankLabel = (rank: number) => {
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    const suffix = suffixes[rank] || 'th';
    return `${rank}${suffix}`;
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-2">
        Top 5 competitors within 10 miles
      </p>
      {allEntries.map((entry) => {
        const isCurrent = 'isCurrent' in entry && entry.isCurrent;
        const distance = 'distance' in entry ? entry.distance : undefined;
        
        return (
          <div
            key={entry.id}
            className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
              isCurrent 
                ? 'bg-accent/10 border-2 border-accent' 
                : 'bg-card border border-border'
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Utensils className="w-5 h-5 text-muted-foreground" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${isCurrent ? 'text-accent-foreground' : 'text-foreground'}`}>
                {entry.name}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">{entry.rating}</span>
                  <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                </div>
                {distance !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{distance.toFixed(1)} mi</span>
                  </div>
                )}
              </div>
            </div>

            <div className={`text-sm font-medium ${
              isCurrent ? 'text-accent' : 'text-muted-foreground'
            }`}>
              {getRankLabel(entry.rank)}
            </div>

            {isCurrent && (
              <div className="h-6 w-0.5 bg-accent absolute -left-2" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CompetitorList;
