import { AlertTriangle, CheckCircle, Info, Globe, Zap, Eye, FileText, Smartphone, Shield } from 'lucide-react';

interface WebsiteIssue {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'content' | 'mobile' | 'security';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

interface WebsiteScanResultsProps {
  totalItemsScanned: number;
  itemsNeedingAttention: number;
  issues: WebsiteIssue[];
  scannedCategories: string[];
}

const categoryIcons: Record<string, React.ElementType> = {
  seo: Globe,
  performance: Zap,
  accessibility: Eye,
  content: FileText,
  mobile: Smartphone,
  security: Shield,
};

const categoryLabels: Record<string, string> = {
  seo: 'SEO',
  performance: 'Performance',
  accessibility: 'Accessibility',
  content: 'Content',
  mobile: 'Mobile',
  security: 'Security',
};

const WebsiteScanResults = ({ 
  totalItemsScanned, 
  itemsNeedingAttention, 
  issues,
  scannedCategories 
}: WebsiteScanResultsProps) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-danger" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'info':
        return <Info className="w-4 h-4 text-accent" />;
      default:
        return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-danger/10 border-danger/20';
      case 'warning':
        return 'bg-warning/10 border-warning/20';
      case 'info':
        return 'bg-accent/10 border-accent/20';
      default:
        return 'bg-success/10 border-success/20';
    }
  };

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">Items Scanned</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalItemsScanned}</p>
        </div>
        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm text-muted-foreground">Need Attention</span>
          </div>
          <p className="text-2xl font-bold text-warning">{itemsNeedingAttention}</p>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="flex items-center gap-3 text-sm">
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-danger">
            <AlertTriangle className="w-3 h-3" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3 h-3" />
            {warningCount} warnings
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <Info className="w-3 h-3" />
            {infoCount} suggestions
          </span>
        )}
      </div>

      {/* Categories Scanned */}
      <div className="flex flex-wrap gap-2">
        {scannedCategories.map((category) => {
          const Icon = categoryIcons[category] || Globe;
          const categoryIssues = issues.filter(i => i.category === category);
          const hasIssues = categoryIssues.length > 0;
          
          return (
            <div 
              key={category}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                hasIssues 
                  ? 'bg-warning/10 text-warning border border-warning/20' 
                  : 'bg-success/10 text-success border border-success/20'
              }`}
            >
              <Icon className="w-3 h-3" />
              {categoryLabels[category] || category}
              {hasIssues && <span>({categoryIssues.length})</span>}
            </div>
          );
        })}
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Issues Found:</h4>
          {issues.map((issue) => {
            const CategoryIcon = categoryIcons[issue.category] || Globe;
            
            return (
              <div 
                key={issue.id}
                className={`p-3 rounded-lg border ${getSeverityBg(issue.severity)}`}
              >
                <div className="flex items-start gap-2">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium text-foreground">{issue.title}</h5>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CategoryIcon className="w-3 h-3" />
                        {categoryLabels[issue.category]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {issues.length === 0 && (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No issues found! Your website looks great.</p>
        </div>
      )}
    </div>
  );
};

export default WebsiteScanResults;
