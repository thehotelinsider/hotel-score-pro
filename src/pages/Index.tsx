import { useState } from 'react';
import { Search, Boxes, Trophy } from 'lucide-react';
import Header from '@/components/Header';
import SearchInput from '@/components/SearchInput';
import QuestionBadge from '@/components/QuestionBadge';
import LocationConfirmation from '@/components/LocationConfirmation';
import PhotoScanning from '@/components/PhotoScanning';
import ReviewScanning from '@/components/ReviewScanning';
import ScoreCard from '@/components/ScoreCard';
import { Hotel, ScanResult } from '@/types/hotel';
import { generateMockScanResult } from '@/data/mockData';

type ScanStage = 'search' | 'location' | 'photos' | 'reviews' | 'results';

const Index = () => {
  const [stage, setStage] = useState<ScanStage>('search');
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleSearch = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setStage('location');
  };

  const handleLocationComplete = () => {
    setStage('photos');
  };

  const handlePhotosComplete = () => {
    setStage('reviews');
  };

  const handleReviewsComplete = () => {
    if (selectedHotel) {
      const result = generateMockScanResult(selectedHotel);
      setScanResult(result);
    }
    setStage('results');
  };

  const handleLogin = () => {
    // TODO: Implement login modal
    console.log('Login clicked');
  };

  // Search page
  if (stage === 'search') {
    return (
      <div className="min-h-screen bg-background">
        <Header onLoginClick={handleLogin} />
        
        <main className="pt-32 px-4 pb-12">
          <div className="max-w-2xl mx-auto text-center">
            {/* Main headline */}
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4 animate-fade-in">
              Enter your hotel name and receive your Hotel Online Score Card
            </h1>
            
            <p className="text-lg text-muted-foreground mb-12 animate-fade-in" style={{ animationDelay: '100ms' }}>
              Scan your site in seconds and make sure your hotel is beating its competitors.
            </p>

            {/* Search input */}
            <div className="mb-12 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <SearchInput onSearch={handleSearch} />
            </div>

            {/* Question badges */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <QuestionBadge 
                icon={Search} 
                text="How's my Google SEO?" 
                variant="seo" 
              />
              <QuestionBadge 
                icon={Boxes} 
                text="What's broken on my site?" 
                variant="site" 
              />
              <QuestionBadge 
                icon={Trophy} 
                text="Who is beating me and how?" 
                variant="competitor" 
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Location confirmation page
  if (stage === 'location' && selectedHotel) {
    return (
      <div className="min-h-screen bg-background">
        <Header showLogin={false} />
        <LocationConfirmation 
          hotel={selectedHotel} 
          onContinue={handleLocationComplete}
        />
      </div>
    );
  }

  // Photo scanning page
  if (stage === 'photos') {
    return (
      <div className="min-h-screen bg-background">
        <Header showLogin={false} />
        <PhotoScanning onComplete={handlePhotosComplete} />
      </div>
    );
  }

  // Review scanning page
  if (stage === 'reviews') {
    return (
      <div className="min-h-screen bg-background">
        <Header showLogin={false} />
        <ReviewScanning onComplete={handleReviewsComplete} />
      </div>
    );
  }

  // Results page
  if (stage === 'results' && scanResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header onLoginClick={handleLogin} />
        <ScoreCard result={scanResult} />
      </div>
    );
  }

  return null;
};

export default Index;
