import { Hotel, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer min-w-0 flex-shrink" 
          onClick={() => navigate('/')}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <Hotel className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-foreground" />
          </div>
          <span className="font-display font-semibold text-sm sm:text-lg truncate">Hotel Online Score Card</span>
        </div>
        
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="rounded-full px-2 sm:px-4 gap-1 sm:gap-2"
              >
                <User className="w-4 h-4" />
                <span className="max-w-20 sm:max-w-32 truncate text-xs sm:text-sm hidden xs:inline">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-muted-foreground text-xs">
                {user.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => navigate('/auth')}
            className="rounded-full px-4 sm:px-6 text-sm"
          >
            Log in
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
