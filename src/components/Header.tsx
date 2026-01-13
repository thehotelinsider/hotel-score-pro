import { Hotel } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  showLogin?: boolean;
  onLoginClick?: () => void;
}

const Header = ({ showLogin = true, onLoginClick }: HeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <Hotel className="w-4 h-4 text-accent-foreground" />
          </div>
          <span className="font-display font-semibold text-lg">Hotel Score Card</span>
        </div>
        
        {showLogin && (
          <Button 
            variant="outline" 
            onClick={onLoginClick}
            className="rounded-full px-6"
          >
            Log in
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
