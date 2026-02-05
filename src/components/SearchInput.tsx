import { useState, useEffect, useRef } from 'react';
import { ArrowUp, Search, Loader2 } from 'lucide-react';
import { Hotel } from '@/types/hotel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchInputProps {
  onSearch: (hotel: Hotel) => void;
}

const SearchInput = ({ onSearch }: SearchInputProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Hotel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cleanup debounce on unmount
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const { data, error } = await supabase.functions.invoke('search-hotels', {
            body: { query }
          });

          if (error) {
            console.error('Search error:', error);
            toast({
              variant: 'destructive',
              title: 'Search failed',
              description: error.message || 'Failed to search for hotels'
            });
            setSuggestions([]);
          } else if (data?.error) {
            console.error('Search error:', data.error);
            toast({
              variant: 'destructive',
              title: 'Search failed',
              description: data.error
            });
            setSuggestions([]);
          } else {
            setSuggestions(data?.hotels || []);
            setShowSuggestions(true);
          }
        } catch (err) {
          console.error('Search error:', err);
          toast({
            variant: 'destructive',
            title: 'Search failed',
            description: 'An unexpected error occurred'
          });
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, 500); // 500ms debounce
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedIndex(-1);
  }, [query, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectHotel(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelectHotel(suggestions[0]);
      }
    }
  };

  const handleSelectHotel = (hotel: Hotel) => {
    // Check if hotel is outside the designated area
    if (hotel.outsideArea) {
      toast({
        title: "Outside Designated Area",
        description: `"${hotel.name}" is located outside the 100-mile radius of Knoxville, TN. Results may be limited for hotels in this area.`,
        variant: "default",
      });
    }
    setQuery(hotel.name);
    setShowSuggestions(false);
    onSearch(hotel);
  };

  const handleSubmit = () => {
    if (suggestions.length > 0) {
      handleSelectHotel(suggestions[0]);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto px-1 sm:px-0">
      <div className="relative bg-muted rounded-xl sm:rounded-2xl shadow-sm border border-border overflow-hidden transition-shadow focus-within:shadow-lg focus-within:border-accent/50">
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find your hotel (e.g., 'Residence Inn Knoxville')"
          rows={2}
          className="w-full px-4 sm:px-6 py-4 sm:py-5 pr-14 sm:pr-16 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base sm:text-lg"
        />
        <button
          onClick={handleSubmit}
          disabled={suggestions.length === 0 || isSearching}
          className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
      </div>

      {/* Loading indicator */}
      {isSearching && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg sm:rounded-xl border border-border shadow-xl overflow-hidden z-50 animate-fade-in">
          <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            <span className="text-sm sm:text-base">Searching for hotels...</span>
          </div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {!isSearching && showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg sm:rounded-xl border border-border shadow-xl overflow-hidden z-[100] animate-fade-in max-h-64 sm:max-h-80 overflow-y-auto">
          {suggestions.map((hotel, index) => (
            <button
              key={hotel.id}
              onClick={() => handleSelectHotel(hotel)}
              className={`w-full px-4 sm:px-5 py-3 sm:py-4 text-left flex items-start gap-2 sm:gap-3 transition-colors ${
                index === selectedIndex 
                  ? 'bg-muted' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className="font-medium text-sm sm:text-base text-foreground break-words">{hotel.name}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    ★ {hotel.rating?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {hotel.address}, {hotel.city}, {hotel.state}
                </p>
                {hotel.priceLevel && (
                  <p className="text-xs text-accent mt-1">{hotel.priceLevel}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {!isSearching && showSuggestions && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg sm:rounded-xl border border-border shadow-xl overflow-hidden z-50 animate-fade-in">
          <div className="px-4 sm:px-5 py-3 sm:py-4 text-center text-sm sm:text-base text-muted-foreground">
            No hotels found. Try a different search term.
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
