import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ScoreCircle from '@/components/ScoreCircle';
import { Loader2, ArrowLeft, Globe, Search, Trophy, TrendingDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SharedReportData {
  id: string;
  hotel_name: string;
  hotel_address: string | null;
  hotel_city: string | null;
  hotel_state: string | null;
  hotel_country: string | null;
  hotel_rating: number | null;
  hotel_review_count: number | null;
  hotel_image_url: string | null;
  score_overall: number | null;
  score_seo: number | null;
  score_website: number | null;
  score_reviews: number | null;
  score_social_media: number | null;
  score_ota: number | null;
  competitors: any[] | null;
  rankings: any[] | null;
  issues: any[] | null;
  created_at: string;
}

const SharedReport = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) {
        setError('Invalid report link');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('shared_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (fetchError || !data) {
        setError('Report not found or has expired');
        setLoading(false);
        return;
      }

      setReport(data as SharedReportData);
      setLoading(false);
    };

    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Report Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || 'This report could not be loaded.'}</p>
          <Link to="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Scan Your Hotel
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const scoreOverall = report.score_overall ?? 0;
  const competitors = (report.competitors ?? []) as any[];
  const rankings = (report.rankings ?? []) as any[];
  const issues = (report.issues ?? []) as any[];

  const criticalIssues = issues.filter((i: any) => i.severity === 'critical');
  const warningIssues = issues.filter((i: any) => i.severity === 'warning');

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-danger';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 83) return 'Excellent';
    if (score >= 76) return 'Great';
    if (score >= 56) return 'Good';
    if (score >= 46) return 'Fair';
    if (score >= 21) return 'Bad';
    return 'Very Bad';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-bold text-foreground">Hotel Online Score Card</h1>
          <Link to="/">
            <Button variant="outline" size="sm">
              Scan Your Hotel
            </Button>
          </Link>
        </div>
      </header>

      <main className="pt-20 pb-12 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Hotel Header */}
          <div className="bg-gradient-to-br from-warning/5 to-accent/5 rounded-2xl p-6 border border-warning/20 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-accent to-warning overflow-hidden flex-shrink-0">
                {report.hotel_image_url ? (
                  <img src={report.hotel_image_url} alt={report.hotel_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                    {report.hotel_name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{report.hotel_name}</h2>
                {report.hotel_city && (
                  <p className="text-sm text-muted-foreground">
                    {report.hotel_city}{report.hotel_state ? `, ${report.hotel_state}` : ''}{report.hotel_country ? `, ${report.hotel_country}` : ''}
                  </p>
                )}
                {report.hotel_rating && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ⭐ {report.hotel_rating} ({report.hotel_review_count ?? 0} reviews)
                  </p>
                )}
              </div>
              <ScoreCircle score={scoreOverall} size="md" />
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Score Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'SEO', score: report.score_seo, icon: Globe },
                { label: 'Website', score: report.score_website, icon: ExternalLink },
                { label: 'Reviews', score: report.score_reviews, icon: Search },
                { label: 'Social Media', score: report.score_social_media, icon: Trophy },
                { label: 'OTA', score: report.score_ota, icon: TrendingDown },
              ].map(({ label, score, icon: Icon }) => (
                <div key={label} className="p-3 bg-muted/50 rounded-xl text-center">
                  <Icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-xl font-bold ${getScoreColor(score ?? 0)}`}>{score ?? '–'}</p>
                </div>
              ))}
              <div className="p-3 bg-primary/5 rounded-xl text-center border border-primary/20">
                <div className="w-5 h-5 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Overall</p>
                <p className={`text-xl font-bold ${getScoreColor(scoreOverall)}`}>{scoreOverall}</p>
                <p className={`text-[10px] font-medium ${getScoreColor(scoreOverall)}`}>{getScoreLabel(scoreOverall)}</p>
              </div>
            </div>
          </div>

          {/* Issues Summary */}
          {issues.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '200ms' }}>
              <h3 className="text-lg font-semibold text-foreground mb-4">Issues Found</h3>
              <div className="flex gap-3 mb-4">
                {criticalIssues.length > 0 && (
                  <div className="px-3 py-1.5 bg-danger/10 rounded-lg text-sm font-medium text-danger">
                    {criticalIssues.length} Critical
                  </div>
                )}
                {warningIssues.length > 0 && (
                  <div className="px-3 py-1.5 bg-warning/10 rounded-lg text-sm font-medium text-warning">
                    {warningIssues.length} Warnings
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {issues.slice(0, 8).map((issue: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                      issue.severity === 'critical' ? 'bg-danger' : issue.severity === 'warning' ? 'bg-warning' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{issue.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitors */}
          {competitors.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '300ms' }}>
              <h3 className="text-lg font-semibold text-foreground mb-4">Competitor Comparison</h3>
              <div className="space-y-3">
                {competitors.slice(0, 5).map((comp: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-6">#{comp.rank || idx + 1}</span>
                      <span className="text-sm font-medium text-foreground">{comp.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">⭐ {comp.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rankings */}
          {rankings.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border animate-fade-in" style={{ animationDelay: '400ms' }}>
              <h3 className="text-lg font-semibold text-foreground mb-4">Search Rankings</h3>
              <div className="space-y-3">
                {rankings.map((ranking: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-foreground">{ranking.keyword}</span>
                    <span className={`text-sm font-bold ${
                      typeof ranking.position === 'number' && ranking.position <= 3 ? 'text-success' :
                      typeof ranking.position === 'number' && ranking.position <= 10 ? 'text-warning' : 'text-danger'
                    }`}>
                      {typeof ranking.position === 'number' ? `#${ranking.position}` : 'Unranked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20 text-center animate-fade-in" style={{ animationDelay: '500ms' }}>
            <h3 className="text-lg font-semibold text-foreground mb-2">Want to improve your score?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get a personalized consultation from THE HOTEL INSIDER to boost your hotel's online presence.
            </p>
            <a href="mailto:info@thehotelinsider.co?subject=Hotel Score Card Consultation">
              <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                Contact THE HOTEL INSIDER
              </Button>
            </a>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Report generated on {new Date(report.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </main>
    </div>
  );
};

export default SharedReport;
