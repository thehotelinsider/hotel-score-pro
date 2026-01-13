import { useState, useEffect, useRef } from 'react';
import { ArrowUp, Search } from 'lucide-react';
import { mockHotels } from '@/data/mockData';
import { Hotel } from '@/types/hotel';

interface SearchInputProps {
  onSearch: (hotel: Hotel) => void;
}

const SearchInput = ({ onSearch }: SearchInputProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Hotel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      const filtered = mockHotels.filter(hotel =>
        hotel.name.toLowerCase().includes(query.toLowerCase()) ||
        hotel.city.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedIndex(-1);
  }, [query]);

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
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative bg-muted rounded-2xl shadow-sm border border-border overflow-hidden transition-shadow focus-within:shadow-lg focus-within:border-accent/50">
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find your hotel"
          rows={2}
          className="w-full px-6 py-5 pr-16 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-lg"
        />
        <button
          onClick={handleSubmit}
          disabled={suggestions.length === 0}
          className="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-xl overflow-hidden z-50 animate-fade-in">
          {suggestions.map((hotel, index) => (
            <button
              key={hotel.id}
              onClick={() => handleSelectHotel(hotel)}
              className={`w-full px-5 py-4 text-left flex items-start gap-3 transition-colors ${
                index === selectedIndex 
                  ? 'bg-muted' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <Search className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{hotel.name}</p>
                <p className="text-sm text-muted-foreground">
                  {hotel.address}, {hotel.city}, {hotel.state}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchInput;
