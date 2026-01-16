import { useMemo, useState, useEffect } from 'react';
import { 
  Target, 
  Zap, 
  DollarSign, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  Trophy,
  ChevronDown
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AiRecommendationsProps {
  recommendations: string;
  onRevenueEstimateExtracted?: (estimate: number | null) => void;
}

interface Section {
  title: string;
  content: string[];
  icon: React.ReactNode;
  colorClass: string;
  iconBgClass: string;
  isRevenueSection?: boolean;
}

// Helper function to extract revenue estimate from recommendations text
export const extractRevenueEstimate = (recommendations: string): number | null => {
  // Look for patterns like "$50,000", "$50K", "50,000/year", etc. in revenue/impact sections
  const lines = recommendations.split('\n');
  let inRevenueSection = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check if we're entering a revenue section
    if (lowerLine.includes('revenue') || lowerLine.includes('impact') || lowerLine.includes('estimate')) {
      if (line.match(/^#{1,3}/) || line.match(/^\*\*/)) {
        inRevenueSection = true;
      }
    }
    
    // Look for dollar amounts
    if (inRevenueSection || lowerLine.includes('revenue') || lowerLine.includes('annual')) {
      // Match patterns like $50,000, $50K, $50k, $50,000/year, etc.
      const dollarMatch = line.match(/\$[\d,]+(?:\.\d+)?(?:K|k|M|m)?/g);
      if (dollarMatch) {
        for (const match of dollarMatch) {
          let value = match.replace('$', '').replace(/,/g, '');
          let multiplier = 1;
          
          if (value.toLowerCase().endsWith('k')) {
            multiplier = 1000;
            value = value.slice(0, -1);
          } else if (value.toLowerCase().endsWith('m')) {
            multiplier = 1000000;
            value = value.slice(0, -1);
          }
          
          const numValue = parseFloat(value) * multiplier;
          if (!isNaN(numValue) && numValue > 0) {
            return numValue;
          }
        }
      }
    }
  }
  
  return null;
};

const AiRecommendations = ({ recommendations, onRevenueEstimateExtracted }: AiRecommendationsProps) => {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0])); // First section open by default

  const toggleSection = (index: number) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(parsedSections.map((_, i) => i)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  const parsedSections = useMemo(() => {
    const sections: Section[] = [];
    const lines = recommendations.split('\n');
    
    let currentSection: Section | null = null;
    let currentContent: string[] = [];

    const getSectionConfig = (title: string): { icon: React.ReactNode; colorClass: string; iconBgClass: string; isRevenueSection?: boolean } => {
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('executive') || lowerTitle.includes('summary')) {
        return { 
          icon: <AlertCircle className="w-4 h-4 text-primary-foreground" />, 
          colorClass: 'from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40',
          iconBgClass: 'bg-primary',
          isRevenueSection: false
        };
      }
      if (lowerTitle.includes('priority') || lowerTitle.includes('top')) {
        return { 
          icon: <Target className="w-4 h-4 text-white" />, 
          colorClass: 'from-danger/10 to-danger/5 border-danger/20 hover:border-danger/40',
          iconBgClass: 'bg-danger',
          isRevenueSection: false
        };
      }
      if (lowerTitle.includes('quick') || lowerTitle.includes('win')) {
        return { 
          icon: <Zap className="w-4 h-4 text-white" />, 
          colorClass: 'from-success/10 to-success/5 border-success/20 hover:border-success/40',
          iconBgClass: 'bg-success',
          isRevenueSection: false
        };
      }
      if (lowerTitle.includes('competitive') || lowerTitle.includes('strategy')) {
        return { 
          icon: <Trophy className="w-4 h-4 text-white" />, 
          colorClass: 'from-accent/10 to-accent/5 border-accent/20 hover:border-accent/40',
          iconBgClass: 'bg-accent',
          isRevenueSection: false
        };
      }
      if (lowerTitle.includes('revenue') || lowerTitle.includes('impact') || lowerTitle.includes('estimate')) {
        return { 
          icon: <DollarSign className="w-4 h-4 text-white" />, 
          colorClass: 'from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40',
          iconBgClass: 'bg-warning',
          isRevenueSection: true
        };
      }
      
      return { 
        icon: <Lightbulb className="w-4 h-4 text-foreground" />, 
        colorClass: 'from-muted to-muted/50 border-border hover:border-foreground/20',
        iconBgClass: 'bg-muted-foreground/20',
        isRevenueSection: false
      };
    };

    const saveCurrentSection = () => {
      if (currentSection && currentContent.length > 0) {
        currentSection.content = currentContent.filter(line => line.trim());
        sections.push(currentSection);
      }
      currentContent = [];
    };

    for (const line of lines) {
      // Check for section headers (## or ** at start and end)
      const headerMatch = line.match(/^#{1,3}\s*\**\d*\.?\s*(.+?)\**\s*$/);
      const boldHeaderMatch = line.match(/^\*\*\d*\.?\s*(.+?)\*\*\s*$/);
      
      if (headerMatch || boldHeaderMatch) {
        saveCurrentSection();
        const title = (headerMatch?.[1] || boldHeaderMatch?.[1] || '').replace(/\*+/g, '').trim();
        const config = getSectionConfig(title);
        currentSection = {
          title,
          content: [],
          ...config
        };
      } else if (line.trim()) {
        currentContent.push(line);
      }
    }
    
    saveCurrentSection();
    
    // Filter out Revenue Impact Estimate section
    return sections.filter(section => {
      const lowerTitle = section.title.toLowerCase();
      return !(lowerTitle.includes('revenue') && (lowerTitle.includes('impact') || lowerTitle.includes('estimate')));
    });
  }, [recommendations]);

  // Extract and report revenue estimate when recommendations change
  useEffect(() => {
    if (recommendations && onRevenueEstimateExtracted) {
      const estimate = extractRevenueEstimate(recommendations);
      onRevenueEstimateExtracted(estimate);
    }
  }, [recommendations, onRevenueEstimateExtracted]);

  // Extract revenue data from section content for special display
  const extractRevenueData = (content: string[]): { label: string; value: string; period?: string }[] => {
    const revenueItems: { label: string; value: string; period?: string }[] = [];
    
    for (const line of content) {
      const dollarMatch = line.match(/\$[\d,]+(?:\.\d+)?(?:K|k|M|m)?/);
      if (dollarMatch) {
        const cleanLine = line
          .replace(/^\s*[-*]\s*/, '')
          .replace(/^\s*\d+\.\s*/, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .trim();
        
        // Extract the label (text before the dollar amount)
        const labelMatch = cleanLine.match(/^(.+?):\s*\$/) || cleanLine.match(/^(.+?)\s+\$/);
        const label = labelMatch ? labelMatch[1].trim() : 'Estimated Revenue';
        
        // Extract period if mentioned
        let period = '';
        if (cleanLine.toLowerCase().includes('/year') || cleanLine.toLowerCase().includes('annual')) {
          period = 'per year';
        } else if (cleanLine.toLowerCase().includes('/month') || cleanLine.toLowerCase().includes('monthly')) {
          period = 'per month';
        }
        
        revenueItems.push({
          label,
          value: dollarMatch[0],
          period
        });
      }
    }
    
    return revenueItems;
  };

  // Format revenue section with prominent display
  const formatRevenueSection = (content: string[]) => {
    const revenueData = extractRevenueData(content);
    const nonRevenueLines = content.filter(line => !line.match(/\$[\d,]+(?:\.\d+)?(?:K|k|M|m)?/));
    
    return (
      <div className="space-y-4">
        {/* Revenue cards grid */}
        {revenueData.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {revenueData.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-card rounded-xl p-4 border border-warning/30 shadow-sm"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {item.label}
                </p>
                <p className="text-2xl font-display font-bold text-warning">
                  {item.value}
                  {item.period && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {item.period}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
        
        {/* Additional context/notes */}
        {nonRevenueLines.length > 0 && (
          <ul className="space-y-1">
            {nonRevenueLines.map((line, index) => {
              const cleanLine = line
                .replace(/^\s*[-*]\s*/, '')
                .replace(/^\s*\d+\.\s*/, '')
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .trim();
              
              if (!cleanLine) return null;
              
              return (
                <li key={index} className="flex items-start gap-3 py-1">
                  <CheckCircle2 className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground leading-relaxed">{cleanLine}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  // Parse content into structured format with Issue, Action, Why
  const parseStructuredContent = (content: string[]): { issue: string; action: string; why: string }[] => {
    const items: { issue: string; action: string; why: string }[] = [];
    let currentItem: { issue: string; action: string; why: string } = { issue: '', action: '', why: '' };
    let currentField: 'issue' | 'action' | 'why' | null = null;
    
    for (const line of content) {
      const cleanLine = line
        .replace(/^\s*[-*]\s*/, '')
        .replace(/^\s*\d+\.\s*/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .trim();
      
      if (!cleanLine) continue;
      
      const lowerLine = cleanLine.toLowerCase();
      
      // Check for field markers
      if (lowerLine.startsWith('the issue:') || lowerLine.startsWith('issue:')) {
        // Save previous item if it has content
        if (currentItem.issue || currentItem.action || currentItem.why) {
          items.push({ ...currentItem });
          currentItem = { issue: '', action: '', why: '' };
        }
        currentField = 'issue';
        currentItem.issue = cleanLine.replace(/^(the )?issue:\s*/i, '').trim();
      } else if (lowerLine.startsWith('action:')) {
        currentField = 'action';
        currentItem.action = cleanLine.replace(/^action:\s*/i, '').trim();
      } else if (lowerLine.startsWith('why:')) {
        currentField = 'why';
        currentItem.why = cleanLine.replace(/^why:\s*/i, '').trim();
      } else if (currentField) {
        // Append to current field
        currentItem[currentField] += ' ' + cleanLine;
      } else {
        // No field set yet, treat as new issue
        if (currentItem.issue || currentItem.action || currentItem.why) {
          items.push({ ...currentItem });
        }
        currentItem = { issue: cleanLine, action: '', why: '' };
        currentField = 'issue';
      }
    }
    
    // Don't forget the last item
    if (currentItem.issue || currentItem.action || currentItem.why) {
      items.push(currentItem);
    }
    
    return items;
  };

  const formatContent = (content: string[], isExecutiveSummary: boolean = false) => {
    const structuredItems = parseStructuredContent(content);
    
    if (structuredItems.length === 0) {
      return content.map((line, index) => {
        const cleanLine = line
          .replace(/^\s*[-*]\s*/, '')
          .replace(/^\s*\d+\.\s*/, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .trim();
        
        if (!cleanLine) return null;
        
        return (
          <p key={index} className="text-sm text-muted-foreground leading-relaxed py-1">
            {cleanLine}
          </p>
        );
      });
    }

    return structuredItems.map((item, index) => (
      <div 
        key={index} 
        className="bg-card/50 rounded-lg p-4 border border-border/50 space-y-3"
      >
        {/* The Issue - hide label for Executive Summary */}
        {item.issue && (
          <div className="flex items-start gap-3">
            {!isExecutiveSummary && (
              <div className="flex-shrink-0 mt-0.5">
                <XCircle className="w-4 h-4 text-danger" />
              </div>
            )}
            <div>
              {!isExecutiveSummary && (
                <span className="text-xs font-semibold uppercase tracking-wide text-danger">
                  The Issue
                </span>
              )}
              <p className={`text-sm text-foreground ${isExecutiveSummary ? '' : 'mt-1'}`}>{item.issue.trim()}</p>
            </div>
          </div>
        )}
        
        {/* Action */}
        {item.action && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-warning">
                Action
              </span>
              <p className="text-sm text-foreground mt-1">{item.action.trim()}</p>
            </div>
          </div>
        )}
        
        {/* Why */}
        {item.why && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-success">
                Why
              </span>
              <p className="text-sm text-foreground mt-1">{item.why.trim()}</p>
            </div>
          </div>
        )}
      </div>
    ));
  };

  if (parsedSections.length === 0) {
    // Fallback for unstructured content
    return (
      <div className="bg-card rounded-xl p-5 border border-border">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {recommendations}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Expand/Collapse controls */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <button 
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Expand all
        </button>
        <span className="text-muted-foreground">|</span>
        <button 
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Collapse all
        </button>
      </div>

      {parsedSections.map((section, index) => (
        <Collapsible
          key={index}
          open={openSections.has(index)}
          onOpenChange={() => toggleSection(index)}
        >
          <div 
            className={`bg-gradient-to-br ${section.colorClass} rounded-xl border transition-all duration-200 animate-fade-in overflow-hidden`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${section.iconBgClass}`}>
                    {section.icon}
                  </div>
                  <h4 className="font-semibold text-foreground text-left">{section.title}</h4>
                </div>
                <ChevronDown 
                  className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                    openSections.has(index) ? 'rotate-180' : ''
                  }`} 
                />
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-0">
                <div className={section.isRevenueSection ? '' : 'pl-11'}>
                  {section.isRevenueSection ? (
                    formatRevenueSection(section.content)
                  ) : (
                    <ul className="space-y-1">
                      {formatContent(section.content, section.title.toLowerCase().includes('executive') || section.title.toLowerCase().includes('summary'))}
                    </ul>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
};

export default AiRecommendations;
