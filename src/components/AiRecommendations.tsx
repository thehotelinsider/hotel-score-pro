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

    const getSectionConfig = (title: string): { icon: React.ReactNode; colorClass: string; iconBgClass: string } => {
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('executive') || lowerTitle.includes('summary')) {
        return { 
          icon: <AlertCircle className="w-4 h-4 text-primary-foreground" />, 
          colorClass: 'from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40',
          iconBgClass: 'bg-primary'
        };
      }
      if (lowerTitle.includes('priority') || lowerTitle.includes('top')) {
        return { 
          icon: <Target className="w-4 h-4 text-white" />, 
          colorClass: 'from-danger/10 to-danger/5 border-danger/20 hover:border-danger/40',
          iconBgClass: 'bg-danger'
        };
      }
      if (lowerTitle.includes('quick') || lowerTitle.includes('win')) {
        return { 
          icon: <Zap className="w-4 h-4 text-white" />, 
          colorClass: 'from-success/10 to-success/5 border-success/20 hover:border-success/40',
          iconBgClass: 'bg-success'
        };
      }
      if (lowerTitle.includes('competitive') || lowerTitle.includes('strategy')) {
        return { 
          icon: <Trophy className="w-4 h-4 text-white" />, 
          colorClass: 'from-accent/10 to-accent/5 border-accent/20 hover:border-accent/40',
          iconBgClass: 'bg-accent'
        };
      }
      if (lowerTitle.includes('revenue') || lowerTitle.includes('impact') || lowerTitle.includes('estimate')) {
        return { 
          icon: <DollarSign className="w-4 h-4 text-white" />, 
          colorClass: 'from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40',
          iconBgClass: 'bg-warning'
        };
      }
      
      return { 
        icon: <Lightbulb className="w-4 h-4 text-foreground" />, 
        colorClass: 'from-muted to-muted/50 border-border hover:border-foreground/20',
        iconBgClass: 'bg-muted-foreground/20'
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
    
    return sections;
  }, [recommendations]);

  // Extract and report revenue estimate when recommendations change
  useEffect(() => {
    if (recommendations && onRevenueEstimateExtracted) {
      const estimate = extractRevenueEstimate(recommendations);
      onRevenueEstimateExtracted(estimate);
    }
  }, [recommendations, onRevenueEstimateExtracted]);

  const getIconConfig = (text: string): { icon: 'check' | 'x'; colorClass: string } => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('the issue') || lowerText.includes('issue:')) {
      return { icon: 'x', colorClass: 'text-danger' };
    }
    if (lowerText.includes('fix')) {
      return { icon: 'check', colorClass: 'text-danger' };
    }
    if (lowerText.includes('action')) {
      return { icon: 'check', colorClass: 'text-warning' };
    }
    if (lowerText.includes('why')) {
      return { icon: 'check', colorClass: 'text-success' };
    }
    return { icon: 'check', colorClass: 'text-success' };
  };

  const formatContent = (content: string[]) => {
    return content.map((line, index) => {
      // Remove markdown formatting but preserve structure
      let cleanLine = line
        .replace(/^\s*[-*]\s*/, '') // Remove list bullets
        .replace(/^\s*\d+\.\s*/, '') // Remove numbered list
        .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold markers
        .replace(/\*(.+?)\*/g, '$1') // Remove italic markers
        .trim();

      if (!cleanLine) return null;

      // Check if it's a sub-item (indented or starts with specific patterns)
      const isSubItem = line.match(/^\s{2,}/) || line.match(/^\s*[-*]\s/);
      const isNumberedItem = line.match(/^\s*\d+\.\s/);
      
      // Extract any bold text for emphasis
      const boldMatch = line.match(/\*\*(.+?)\*\*/);
      const emphasisText = boldMatch ? boldMatch[1] : null;

      // Determine icon and color based on content
      const iconConfig = getIconConfig(cleanLine);
      const IconComponent = iconConfig.icon === 'x' ? XCircle : CheckCircle2;

      if (isNumberedItem || isSubItem) {
        return (
          <li key={index} className="flex items-start gap-3 py-2">
            <IconComponent className={`w-4 h-4 ${iconConfig.colorClass} mt-0.5 flex-shrink-0`} />
            <span className="text-sm text-foreground leading-relaxed">
              {emphasisText ? (
                <>
                  <span className="font-semibold text-foreground">{emphasisText}: </span>
                  {cleanLine.replace(emphasisText + ':', '').replace(emphasisText, '').trim()}
                </>
              ) : (
                cleanLine
              )}
            </span>
          </li>
        );
      }

      return (
        <p key={index} className="text-sm text-muted-foreground leading-relaxed py-1">
          {cleanLine}
        </p>
      );
    });
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
                <div className="pl-11">
                  <ul className="space-y-1">
                    {formatContent(section.content)}
                  </ul>
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
