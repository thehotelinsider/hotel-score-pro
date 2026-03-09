import { Loader2, Maximize2, Hash, Share2, RefreshCw } from 'lucide-react';
import { mockHotelPhotos } from '@/data/mockData';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PhotoScanningProps {
  onComplete: () => void;
  hotelName?: string;
  hotelImage?: string;
  hotelPhotos?: string[]; // Array of hotel photos
  hotelCity?: string;
  hotelState?: string;
  hotelCountry?: string;
}

const PhotoScanning = ({ onComplete, hotelName, hotelImage, hotelPhotos, hotelCity, hotelState, hotelCountry }: PhotoScanningProps) => {
  const [progress, setProgress] = useState(0);
  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch real photos from Google Places API
  const fetchRealPhotos = useCallback(async () => {
    if (!hotelName || isFetching) return;

    setIsFetching(true);
    console.log('Fetching real photos from Google Places for:', hotelName);

    try {
      // Build search query with location context
      const searchQuery = [hotelName, hotelCity, hotelState, hotelCountry]
        .filter(Boolean)
        .join(', ');

      const { data, error } = await supabase.functions.invoke('google-places', {
        body: {
          query: searchQuery,
          type: 'hotel',
          maxPhotos: 12,
        },
      });

      if (error) {
        console.error('Error fetching photos from Google Places:', error);
        // Fall back to Perplexity/Firecrawl method
        return await fetchFallbackPhotos();
      }

      if (data?.success && data.photos?.length > 0) {
        console.log('Fetched photos from Google Places:', data.photos.length);
        setFetchedPhotos(data.photos);
      } else {
        console.log('No photos from Google Places, trying fallback...');
        await fetchFallbackPhotos();
      }
    } catch (err) {
      console.error('Failed to fetch real photos:', err);
      await fetchFallbackPhotos();
    } finally {
      setIsFetching(false);
    }
  }, [hotelName, hotelCity, hotelState, hotelCountry, isFetching]);

  // Fallback to Perplexity/Firecrawl method
  const fetchFallbackPhotos = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-hotel-photos', {
        body: {
          hotelName,
          hotelCity,
          hotelState,
          hotelCountry,
        },
      });

      if (!error && data?.success && data.photos?.length > 0) {
        console.log('Fetched fallback photos:', data.photos.length);
        setFetchedPhotos(data.photos);
      }
    } catch (err) {
      console.error('Fallback photo fetch failed:', err);
    }
  };

  // Start fetching photos on mount
  useEffect(() => {
    fetchRealPhotos();
  }, []);

  // Use fetched photos, then hotel photos array, then single image, then mock photos
  const photos = useMemo(() => {
    // Priority 1: Use fetched real photos from GBP
    if (fetchedPhotos.length > 0) {
      return fetchedPhotos;
    }
    // Priority 2: Use the photos array from the hotel data
    if (hotelPhotos && hotelPhotos.length > 0) {
      return hotelPhotos;
    }
    // Priority 3: Use single hotel image repeated
    if (hotelImage) {
      return [hotelImage, hotelImage, hotelImage, hotelImage, hotelImage];
    }
    // Priority 4: Fall back to mock photos
    return mockHotelPhotos;
  }, [hotelImage, hotelPhotos, fetchedPhotos]);

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
                className="relative mx-auto bg-white p-2 sm:p-3 pb-8 sm:pb-12 rounded-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] transform"
                style={{
                  transform: `rotate(${index % 2 === 0 ? 3 : -3}deg) scale(${0.95 + (index % 3) * 0.02})`,
                  width: 'fit-content',
                }}
              >
                <div className="w-56 sm:w-72 h-40 sm:h-48 overflow-hidden">
                  <img
                    src={photo}
                    alt="Hotel"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Polaroid bottom area with subtle texture */}
                <div className="absolute bottom-0 left-0 right-0 h-6 sm:h-10 bg-gradient-to-b from-white to-gray-50" />
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


        </div>
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto">

          {/* Background shape fitted tightly behind status text */}
          <div className="relative bg-card/90 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 border border-border shadow-lg mb-3 sm:mb-4 inline-flex items-center gap-2 sm:gap-3 w-full">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-accent flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base text-foreground">
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
