import { LucideIcon } from 'lucide-react';

interface QuestionBadgeProps {
  icon: LucideIcon;
  text: string;
  variant: 'seo' | 'site' | 'competitor';
}

const variantStyles = {
  seo: 'bg-badge-seo text-success',
  site: 'bg-badge-site text-warning',
  competitor: 'bg-badge-competitor text-accent',
};

const QuestionBadge = ({ icon: Icon, text, variant }: QuestionBadgeProps) => {
  return (
    <div className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-full bg-card border border-border shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${variantStyles[variant]}`}>
        <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-foreground">{text}</span>
    </div>
  );
};

export default QuestionBadge;
