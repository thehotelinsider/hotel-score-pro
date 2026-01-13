import { Star } from 'lucide-react';
import { Review } from '@/types/hotel';

interface ReviewCardProps {
  review: Review;
}

const ReviewCard = ({ review }: ReviewCardProps) => {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <span className="font-medium text-muted-foreground">
            {review.author.charAt(0)}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">{review.author}</p>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < review.rating
                      ? 'fill-warning text-warning'
                      : 'text-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{review.date}</p>
          <p className="text-sm text-foreground mt-2 line-clamp-3">{review.text}</p>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
