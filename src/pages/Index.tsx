import { useState } from 'react';
import { Search, Boxes, Trophy } from 'lucide-react';
import Header from '@/components/Header';
import SearchInput from '@/components/SearchInput';
import QuestionBadge from '@/components/QuestionBadge';
import LocationConfirmation from '@/components/LocationConfirmation';
import PhotoScanning from '@/components/PhotoScanning';
import ReviewScanning from '@/components/ReviewScanning';
import ScoreCard from '@/components/ScoreCard';
import { Hotel, ScanResult, Competitor, SearchRanking } from '@/types/hotel';
import { generateMockScanResult } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';

type ScanStage = 'search' | 'location' | 'photos' | 'reviews' | 'results';

const Index = () => {
  const [stage, setStage] = useState<ScanStage>('search');
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [rankings, setRankings] = useState<SearchRanking[]>([]);

  const handleSearch = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setStage('location');
  };

  const handleLocationComplete = async () => {
    // Start fetching competitors and rankings in parallel when location is confirmed
    if (selectedHotel) {
      // Fetch competitors first (rankings will use them)
      try {
        const { data: competitorData, error: competitorError } = await supabase.functions.invoke('generate-competitors', {
          body: { hotel: selectedHotel },
        });
        
        if (!competitorError && competitorData?.competitors) {
          setCompetitors(competitorData.competitors);
          console.log('Generated competitors:', competitorData.competitors);
          
          // Now fetch rankings with the competitors context
          try {
            const { data: rankingData, error: rankingError } = await supabase.functions.invoke('generate-rankings', {
              body: { 
                hotel: selectedHotel,
                competitors: competitorData.competitors 
              },
            });
            
            if (!rankingError && rankingData?.rankings) {
              setRankings(rankingData.rankings);
              console.log('Generated rankings:', rankingData.rankings);
            }
          } catch (rankErr) {
            console.error('Failed to fetch rankings:', rankErr);
          }
        }
      } catch (err) {
        console.error('Failed to fetch competitors:', err);
      }
    }
    setStage('photos');
  };

  const handlePhotosComplete = () => {
    setStage('reviews');
  };

  const handleReviewsComplete = () => {
    if (selectedHotel) {
      const result = generateMockScanResult(selectedHotel);
      // Use AI-generated competitors if available, otherwise use mock data
      if (competitors.length > 0) {
        result.competitors = competitors;
      }
      // Use AI-generated rankings if available, otherwise use mock data
      if (rankings.length > 0) {
        result.rankings = rankings;
      }
      setScanResult(result);
    }
    setStage('results');
  };

  // Search page
  if (stage === 'search') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
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
            <div className="relative z-[100] mb-12 animate-fade-in" style={{ animationDelay: '200ms' }}>
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
        <Header />
        <LocationConfirmation 
          hotel={selectedHotel} 
          onContinue={handleLocationComplete}
        />
      </div>
    );
  }

  // Photo scanning page
  if (stage === 'photos' && selectedHotel) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <PhotoScanning 
          onComplete={handlePhotosComplete} 
          hotelName={selectedHotel.name}
          hotelImage={selectedHotel.imageUrl}
          hotelPhotos={selectedHotel.photos}
        />
      </div>
    );
  }

  // Review scanning page
  if (stage === 'reviews') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <ReviewScanning onComplete={handleReviewsComplete} />
      </div>
    );
  }

  // Results page
  if (stage === 'results' && scanResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <ScoreCard result={scanResult} />
      </div>
    );
  }

  return null;
};

export default Index;
