import { useMemo } from 'react';
import { 
  Target, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Trophy
} from 'lucide-react';

interface AiRecommendationsProps {
  recommendations: string;
}

interface Section {
  title: string;
  content: string[];
  icon: React.ReactNode;
  colorClass: string;
}

const AiRecommendations = ({ recommendations }: AiRecommendationsProps) => {
  const parsedSections = useMemo(() => {
    const sections: Section[] = [];
    const lines = recommendations.split('\n');
    
    let currentSection: Section | null = null;
    let currentContent: string[] = [];

    const getSectionConfig = (title: string): { icon: React.ReactNode; colorClass: string } => {
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('executive') || lowerTitle.includes('summary')) {
        return { 
          icon: <AlertCircle className="w-5 h-5" />, 
          colorClass: 'from-primary/10 to-primary/5 border-primary/20' 
        };
      }
      if (lowerTitle.includes('priority') || lowerTitle.includes('top')) {
        return { 
          icon: <Target className="w-5 h-5" />, 
          colorClass: 'from-danger/10 to-danger/5 border-danger/20' 
        };
      }
      if (lowerTitle.includes('quick') || lowerTitle.includes('win')) {
        return { 
          icon: <Zap className="w-5 h-5" />, 
          colorClass: 'from-success/10 to-success/5 border-success/20' 
        };
      }
      if (lowerTitle.includes('competitive') || lowerTitle.includes('strategy')) {
        return { 
          icon: <Trophy className="w-5 h-5" />, 
          colorClass: 'from-accent/10 to-accent/5 border-accent/20' 
        };
      }
      if (lowerTitle.includes('revenue') || lowerTitle.includes('impact') || lowerTitle.includes('estimate')) {
        return { 
          icon: <DollarSign className="w-5 h-5" />, 
          colorClass: 'from-warning/10 to-warning/5 border-warning/20' 
        };
      }
      
      return { 
        icon: <Lightbulb className="w-5 h-5" />, 
        colorClass: 'from-muted to-muted/50 border-border' 
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

      if (isNumberedItem || isSubItem) {
        return (
          <li key={index} className="flex items-start gap-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
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
    <div className="space-y-4">
      {parsedSections.map((section, index) => (
        <div 
          key={index}
          className={`bg-gradient-to-br ${section.colorClass} rounded-xl p-5 border animate-fade-in`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm">
              {section.icon}
            </div>
            <h4 className="font-semibold text-foreground">{section.title}</h4>
          </div>
          
          <ul className="space-y-1 pl-1">
            {formatContent(section.content)}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default AiRecommendations;
