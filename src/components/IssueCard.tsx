import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Issue } from '@/types/hotel';

interface IssueCardProps {
  issue: Issue;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    bgColor: 'bg-danger/10',
    iconColor: 'text-danger',
    borderColor: 'border-danger/20',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-warning/10',
    iconColor: 'text-warning',
    borderColor: 'border-warning/20',
  },
  info: {
    icon: Info,
    bgColor: 'bg-accent/10',
    iconColor: 'text-accent',
    borderColor: 'border-accent/20',
  },
};

const IssueCard = ({ issue }: IssueCardProps) => {
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-xl border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 flex-shrink-0 ${config.iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{issue.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
          {issue.potentialLoss && (
            <p className="text-sm font-medium text-danger mt-2">
              Potential loss: ~${issue.potentialLoss}/month
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IssueCard;
