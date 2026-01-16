import { Loader2 } from 'lucide-react';
import { mockReviews } from '@/data/mockData';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ReviewScanningProps {
  onComplete: () => void;
}

const ReviewScanning = ({ onComplete }: ReviewScanningProps) => {
  const [progress, setProgress] = useState(0);
  const [visibleReviews, setVisibleReviews] = useState(0);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    const reviewTimer = setInterval(() => {
      setVisibleReviews(prev => 
        prev < mockReviews.length ? prev + 1 : prev
      );
    }, 800);

    return () => {
      clearInterval(progressTimer);
      clearInterval(reviewTimer);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen pt-16 sm:pt-20 px-3 sm:px-4 pb-28 sm:pb-32">
      <div className="max-w-lg mx-auto space-y-3 sm:space-y-4">
        {mockReviews.slice(0, visibleReviews).map((review, index) => (
          <div
            key={review.id}
            className="p-4 sm:p-5 bg-card rounded-lg sm:rounded-xl border border-border shadow-sm animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {review.avatar ? (
                  <img src={review.avatar} alt={review.author} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-semibold text-sm sm:text-base text-muted-foreground">
                    {review.author.charAt(0)}
                  </span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm sm:text-base text-foreground truncate">{review.author}</p>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          i < review.rating
                            ? 'fill-warning text-warning'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{review.date}</p>
                <p className="text-xs sm:text-sm text-foreground mt-2 sm:mt-3 leading-relaxed">
                  {review.text}
                  {review.text.length > 150 && (
                    <button className="text-accent font-medium ml-1">More</button>
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed bottom status */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 text-foreground mb-2 sm:mb-3">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-accent" />
            <span className="font-medium text-sm sm:text-base">Scanning Google Reviews</span>
          </div>
          <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
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

export default ReviewScanning;
