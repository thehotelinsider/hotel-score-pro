import { Loader2, Maximize2, Hash, Share2, RefreshCw } from 'lucide-react';
import { mockHotelPhotos } from '@/data/mockData';
import { useEffect, useState, useMemo } from 'react';

interface PhotoScanningProps {
  onComplete: () => void;
  hotelName?: string;
  hotelImage?: string;
  hotelPhotos?: string[]; // Array of hotel photos
}

const PhotoScanning = ({ onComplete, hotelName, hotelImage, hotelPhotos }: PhotoScanningProps) => {
  const [progress, setProgress] = useState(0);

  // Use hotel photos array if provided, otherwise fall back to single image or mock photos
  const photos = useMemo(() => {
    // Priority 1: Use the photos array from the hotel data
    if (hotelPhotos && hotelPhotos.length > 0) {
      return hotelPhotos;
    }
    // Priority 2: Use single hotel image repeated
    if (hotelImage) {
      return [hotelImage, hotelImage, hotelImage, hotelImage, hotelImage];
    }
    // Priority 3: Fall back to mock photos
    return mockHotelPhotos;
  }, [hotelImage, hotelPhotos]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 1.5;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Scrolling photos container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-sm sm:max-w-md h-[500px] sm:h-[600px] overflow-hidden">
          {/* Photos stack */}
          <div className="absolute inset-0 flex flex-col gap-4 sm:gap-6 animate-slide-photos">
            {[...photos, ...photos].map((photo, index) => (
              <div
                key={index}
                className="relative mx-auto w-64 sm:w-80 h-44 sm:h-56 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transform"
                style={{
                  transform: `rotate(${index % 2 === 0 ? 3 : -3}deg) scale(${0.95 + (index % 3) * 0.02})`,
                }}
              >
                <img
                  src={photo}
                  alt="Hotel"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-white/20 rounded-xl sm:rounded-2xl" />
              </div>
            ))}
          </div>

          {/* Scan line effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent shadow-lg animate-scan"
              style={{ boxShadow: '0 0 20px 5px hsl(var(--accent) / 0.5)' }}
            />
          </div>

          {/* Reviews preview overlay */}
          <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-4 bg-card/90 backdrop-blur-sm rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-border shadow-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1">
                <div className="h-2 w-16 sm:w-20 bg-muted rounded animate-pulse" />
                <div className="h-2 w-24 sm:w-32 bg-muted rounded mt-1 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto">
          {/* Status */}
          <div className="flex items-center gap-2 sm:gap-3 text-foreground mb-3 sm:mb-4">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-accent" />
            <span className="font-medium text-sm sm:text-base">
              {hotelName ? `Scanning photos for ${hotelName}` : 'Scanning photos'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden mb-4 sm:mb-6">
            <div 
              className="h-full bg-accent transition-all duration-200 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {[
              { icon: RefreshCw, label: 'Sync' },
              { icon: Maximize2, label: 'Expand' },
              { icon: Hash, label: 'Tags' },
              { icon: Share2, label: 'Share' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent/20 hover:text-accent transition-colors"
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoScanning;
