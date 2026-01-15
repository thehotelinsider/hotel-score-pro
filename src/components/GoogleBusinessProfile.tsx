import { CheckCircle2, XCircle, AlertCircle, MapPin, Star, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileItem {
  name: string;
  status: 'complete' | 'incomplete' | 'needs_improvement';
  value?: string;
  action?: string;
}

interface GoogleBusinessProfileProps {
  hotelName: string;
  rating?: number;
  reviewCount?: number;
  profileItems?: ProfileItem[];
}

const defaultProfileItems: ProfileItem[] = [
  { 
    name: "First-party website", 
    status: "complete", 
    value: "Connected",
    action: "Ensure your website URL is up to date"
  },
  { 
    name: "Business description", 
    status: "needs_improvement", 
    value: "Missing keywords",
    action: "Add relevant keywords like 'boutique hotel', 'luxury accommodation' to your description"
  },
  { 
    name: "Business hours", 
    status: "complete", 
    value: "24/7 Front Desk",
    action: "Keep hours updated for holidays and special events"
  },
  { 
    name: "Phone number", 
    status: "complete", 
    value: "Verified",
    action: "Ensure phone number is always answered"
  },
  { 
    name: "Price range", 
    status: "incomplete", 
    value: "Not set",
    action: "Add your price range to help guests understand your positioning"
  },
  { 
    name: "Amenities", 
    status: "needs_improvement", 
    value: "8 of 15 added",
    action: "Add all amenities like WiFi, parking, pool, gym to attract more guests"
  },
  { 
    name: "Photos", 
    status: "needs_improvement", 
    value: "12 photos",
    action: "Add at least 25+ high-quality photos of rooms, lobby, amenities, and exterior"
  },
  { 
    name: "Google Posts", 
    status: "incomplete", 
    value: "No recent posts",
    action: "Post weekly updates about events, promotions, or seasonal offerings"
  },
  { 
    name: "Q&A section", 
    status: "needs_improvement", 
    value: "3 unanswered",
    action: "Answer all questions promptly and add common FAQs proactively"
  },
  { 
    name: "Review responses", 
    status: "needs_improvement", 
    value: "65% responded",
    action: "Respond to all reviews within 24-48 hours, especially negative ones"
  },
];

const getStatusIcon = (status: ProfileItem['status']) => {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'incomplete':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'needs_improvement':
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
  }
};

const getStatusBg = (status: ProfileItem['status']) => {
  switch (status) {
    case 'complete':
      return 'bg-green-500/10';
    case 'incomplete':
      return 'bg-red-500/10';
    case 'needs_improvement':
      return 'bg-amber-500/10';
  }
};

export const GoogleBusinessProfile = ({ 
  hotelName, 
  rating = 4.2, 
  reviewCount = 856,
  profileItems = defaultProfileItems 
}: GoogleBusinessProfileProps) => {
  const completeCount = profileItems.filter(item => item.status === 'complete').length;
  const totalCount = profileItems.length;
  const score = Math.round((completeCount / totalCount) * 20);
  
  const incompleteItems = profileItems.filter(item => item.status !== 'complete');
  
  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-border">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{hotelName}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{rating}</span>
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-muted-foreground">{reviewCount.toLocaleString()} reviews</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{score}/20</div>
          <p className="text-xs text-muted-foreground">Profile Score</p>
        </div>
      </div>

      {/* Profile Items Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground px-1">Profile Content</h4>
        <div className="space-y-2">
          {profileItems.map((item, index) => (
            <div 
              key={index}
              className={`flex items-start gap-3 p-3 rounded-xl ${getStatusBg(item.status)}`}
            >
              <div className="mt-0.5">
                {getStatusIcon(item.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{item.name}</span>
                  {item.value && (
                    <span className="text-xs text-muted-foreground truncate">{item.value}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items */}
      {incompleteItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">Recommended Actions</h4>
          <div className="space-y-2">
            {incompleteItems.slice(0, 5).map((item, index) => (
              <div 
                key={index}
                className="p-3 bg-muted/30 rounded-xl border border-border"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Action
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="pt-2">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => window.open('https://business.google.com', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Manage Google Business Profile
        </Button>
      </div>
    </div>
  );
};
