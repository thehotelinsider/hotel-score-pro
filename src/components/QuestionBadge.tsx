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
    <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-card border border-border shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${variantStyles[variant]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium text-foreground">{text}</span>
    </div>
  );
};

export default QuestionBadge;
