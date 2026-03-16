import { useState } from 'react';
import { Share2, Mail, Loader2, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScanResult } from '@/types/hotel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShareReportButtonProps {
  result: ScanResult;
}

const ShareReportButton = ({ result }: ShareReportButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [reportLink, setReportLink] = useState<string | null>(null);
  const { toast } = useToast();

  const handleShare = async () => {
    if (!email.trim()) {
      toast({ title: 'Please enter an email address', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('share-report', {
        body: {
          recipientEmail: email,
          reportData: {
            hotelName: result.hotel.name,
            hotelAddress: result.hotel.address,
            hotelCity: result.hotel.city,
            hotelState: result.hotel.state,
            hotelCountry: result.hotel.country,
            hotelRating: result.hotel.rating,
            hotelReviewCount: result.hotel.reviewCount,
            hotelImageUrl: result.hotel.imageUrl || result.hotel.photos?.[0] || result.photos?.[0],
            scoreOverall: result.score.overall,
            scoreSeo: result.score.seo,
            scoreWebsite: result.score.website,
            scoreReviews: result.score.reviews,
            scoreSocialMedia: result.score.socialMedia,
            scoreOta: result.score.ota,
            competitors: result.competitors,
            rankings: result.rankings,
            issues: result.issues,
          },
        },
      });

      if (error) throw error;

      if (data?.reportLink) {
        setReportLink(data.reportLink);
      }

      setIsSent(true);
      toast({ title: 'Report sent!', description: `The report link has been emailed to ${email}` });
    } catch (err) {
      console.error('Error sharing report:', err);
      toast({ title: 'Failed to send report', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const copyLink = async () => {
    if (reportLink) {
      await navigator.clipboard.writeText(reportLink);
      toast({ title: 'Link copied to clipboard!' });
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setEmail('');
      setIsSent(false);
      setReportLink(null);
    }, 300);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full border-primary/30 text-primary hover:bg-primary/5"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share This Report
      </Button>

      <Dialog open={isOpen} onOpenChange={resetAndClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription>
              Send the Hotel Online Score Card for {result.hotel.name} via email.
            </DialogDescription>
          </DialogHeader>

          {isSent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-success" />
              </div>
              <p className="text-foreground font-medium mb-1">Report Sent!</p>
              <p className="text-sm text-muted-foreground mb-4">
                An email with the report link has been sent to {email}
              </p>
              {reportLink && (
                <Button variant="outline" size="sm" onClick={copyLink} className="mb-3">
                  <LinkIcon className="w-3 h-3 mr-2" />
                  Copy Report Link
                </Button>
              )}
              <div>
                <Button variant="ghost" size="sm" onClick={resetAndClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter recipient's email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                    className="pl-10"
                    disabled={isSending}
                  />
                </div>
              </div>
              <Button
                onClick={handleShare}
                disabled={isSending}
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Report Link
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                A shareable link to the report will be emailed to the recipient.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareReportButton;
