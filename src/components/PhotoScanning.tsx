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
      {/* Full-screen scrolling photos container */}
      <div className="absolute inset-0">
        {/* Photos stack - full width */}
        <div className="absolute inset-0 flex flex-col animate-slide-photos">
          {[...photos, ...photos].map((photo, index) => (
            <div
              key={index}
              className="relative w-full h-[50vh] sm:h-[60vh] flex-shrink-0"
            >
              <img
                src={photo}
                alt="Hotel"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
              
              {/* Photo number indicator */}
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-medium">
                {(index % photos.length) + 1} / {photos.length}
              </div>
            </div>
          ))}
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div 
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-lg animate-scan"
            style={{ boxShadow: '0 0 30px 8px hsl(var(--accent) / 0.6)' }}
          />
        </div>

        {/* Photo info overlay */}
        <div className="absolute bottom-24 sm:bottom-32 left-4 right-4 sm:left-6 sm:right-6">
          <div className="bg-card/90 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-border shadow-xl max-w-lg mx-auto">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground text-base sm:text-lg">Analyzing hotel imagery</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Checking quality, composition & appeal</div>
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
