import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { mockHotelPhotos } from '@/data/mockData';

interface ScanningAnimationProps {
  stage: 'location' | 'photos' | 'reviews' | 'analysis';
  hotelName: string;
  onComplete?: () => void;
}

const stageMessages = {
  location: 'Scanning Google Business Profile',
  photos: 'Scanning photos',
  reviews: 'Scanning Google Reviews',
  analysis: 'Analyzing online presence',
};

const ScanningAnimation = ({ stage, hotelName, onComplete }: ScanningAnimationProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          onComplete?.();
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onComplete]);

  if (stage === 'photos') {
    return (
      <div className="relative h-screen overflow-hidden">
        {/* Scrolling photos */}
        <div className="absolute inset-0 flex flex-col gap-4 animate-slide-photos">
          {[...mockHotelPhotos, ...mockHotelPhotos].map((photo, index) => (
            <div
              key={index}
              className="relative mx-auto w-80 h-64 rounded-2xl overflow-hidden shadow-xl transform rotate-2 even:-rotate-2"
            >
              <img
                src={photo}
                alt="Hotel"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          ))}
        </div>

        {/* Scan line */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-scan" />
        </div>

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 text-muted-foreground mb-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{stageMessages[stage]}</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'reviews') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          {/* Mock review cards sliding in */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 bg-card rounded-xl border border-border animate-fade-in"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="w-3 h-3 bg-warning/30 rounded" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-4/5 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="mt-8 max-w-md w-full">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{stageMessages[stage]}</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-muted-foreground">{stageMessages[stage]}</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          {Math.floor((100 - progress) / 10)} seconds remaining
        </p>
      </div>
    </div>
  );
};

export default ScanningAnimation;
