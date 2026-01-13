import { MapPin, Star, Loader2 } from 'lucide-react';
import { Hotel } from '@/types/hotel';
import { useEffect, useState } from 'react';

interface LocationConfirmationProps {
  hotel: Hotel;
  onContinue: () => void;
}

const LocationConfirmation = ({ hotel, onContinue }: LocationConfirmationProps) => {
  const [progress, setProgress] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    const secondsTimer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 0) {
          clearInterval(secondsTimer);
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(progressTimer);
      clearInterval(secondsTimer);
    };
  }, [onContinue]);

  return (
    <div className="min-h-screen pt-20 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Hotel card with map */}
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* Map placeholder */}
          <div className="relative h-48 bg-gradient-to-br from-green-100 to-blue-100">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Simplified map with streets */}
              <svg className="w-full h-full" viewBox="0 0 400 200">
                <rect fill="#e8f5e9" width="400" height="200" />
                {/* Streets */}
                <line x1="0" y1="100" x2="400" y2="100" stroke="#fff" strokeWidth="8" />
                <line x1="200" y1="0" x2="200" y2="200" stroke="#fff" strokeWidth="6" />
                <line x1="100" y1="0" x2="100" y2="200" stroke="#fff" strokeWidth="4" />
                <line x1="300" y1="0" x2="300" y2="200" stroke="#fff" strokeWidth="4" />
                <line x1="0" y1="50" x2="400" y2="50" stroke="#fff" strokeWidth="3" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#fff" strokeWidth="3" />
                {/* Buildings */}
                <rect x="110" y="60" width="30" height="30" fill="#c8e6c9" rx="2" />
                <rect x="220" y="110" width="40" height="35" fill="#c8e6c9" rx="2" />
                <rect x="50" y="120" width="35" height="25" fill="#c8e6c9" rx="2" />
                <rect x="320" y="55" width="25" height="40" fill="#c8e6c9" rx="2" />
              </svg>
              
              {/* Location pin */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full">
                <div className="relative">
                  <div className="absolute inset-0 bg-danger/30 rounded-full animate-pulse-ring" />
                  <MapPin className="w-10 h-10 text-danger fill-danger drop-shadow-lg" />
                </div>
              </div>
            </div>
          </div>

          {/* Hotel info */}
          <div className="p-5">
            <h2 className="text-xl font-display font-bold text-foreground">{hotel.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(hotel.rating)
                        ? 'fill-warning text-warning'
                        : 'text-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{hotel.rating}</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">{hotel.priceLevel}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{hotel.description}</p>
          </div>
        </div>

        {/* Loading status */}
        <div className="mt-8 bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3 text-foreground mb-3">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span className="font-medium">Scanning Google Business Profile</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {secondsRemaining} seconds remaining
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-200 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationConfirmation;
