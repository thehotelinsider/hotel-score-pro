import { useState, useCallback } from 'react';
import { FileDown, Share2, Loader2, Mail, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ShareScoreCardProps {
    hotelName: string;
    scoreCardElementId: string;
}

const ShareScoreCard = ({ hotelName, scoreCardElementId }: ShareScoreCardProps) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState('');
    const { toast } = useToast();

    const safeName = hotelName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const fileName = `Hotel_Score_Card_${safeName}.pdf`;

    const buildPdfBlob = useCallback(async (): Promise<Blob> => {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const container = document.getElementById(scoreCardElementId);
        if (!container) throw new Error('Score card element not found');

        await document.fonts.ready;

        const SCALE = 3;
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 10;
        const USABLE_W = PAGE_W - MARGIN * 2;
        const HEADER_H = 14;
        const FOOTER_H = 8;
        const CONTENT_H = PAGE_H - HEADER_H - FOOTER_H;

        const sections = (Array.from(container.children) as HTMLElement[]).filter((el) => {
            if (el.hasAttribute('data-pdf-hide')) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        if (!sections.length) {
            throw new Error('No visible report sections found for export');
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const addHeader = (doc: typeof pdf, page: number, total: number) => {
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Hotel Online Score Card', MARGIN, 9);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(hotelName, PAGE_W / 2, 9, { align: 'center' });
            doc.text(`Page ${page} of ${total}  |  thehotelinsider.co`, PAGE_W - MARGIN, 9, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        };

        const waitForSectionAssets = async (section: HTMLElement) => {
            const images = Array.from(section.querySelectorAll('img'));
            await Promise.all(
                images.map(
                    (img) =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise<void>((resolve) => {
                                const done = () => resolve();
                                img.addEventListener('load', done, { once: true });
                                img.addEventListener('error', done, { once: true });
                            })
                )
            );
        };

        const canvases: HTMLCanvasElement[] = [];
        for (const section of sections) {
            await waitForSectionAssets(section);

            const canvas = await html2canvas(section, {
                scale: SCALE,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8fafc',
                logging: false,
                onclone: (doc) => {
                    doc.querySelectorAll('[data-pdf-hide]').forEach((el) => {
                        (el as HTMLElement).style.display = 'none';
                    });
                },
            });

            if (canvas.width > 1 && canvas.height > 1) {
                canvases.push(canvas);
            }
        }

        if (!canvases.length) {
            throw new Error('Failed to capture report sections');
        }

        type Slice = { canvas: HTMLCanvasElement; srcY: number; srcH: number };
        const pages: Slice[][] = [];

        for (const canvas of canvases) {
            const wPx = Math.floor(canvas.width);
            const hPx = Math.floor(canvas.height);
            if (wPx < 2 || hPx < 2) continue;

            const ratio = USABLE_W / (wPx / SCALE);
            if (!Number.isFinite(ratio) || ratio <= 0) continue;

            const pixelsPerPage = Math.max(1, Math.floor((CONTENT_H / ratio) * SCALE));

            if (hPx <= pixelsPerPage) {
                pages.push([{ canvas, srcY: 0, srcH: hPx }]);
                continue;
            }

            let offset = 0;
            while (offset < hPx) {
                const remaining = hPx - offset;
                const sliceH = Math.min(pixelsPerPage, remaining);
                if (sliceH <= 0) break;

                pages.push([{ canvas, srcY: offset, srcH: sliceH }]);
                offset += sliceH;
            }
        }

        if (!pages.length) {
            throw new Error('Failed to build PDF pages');
        }

        const totalPages = pages.length;

        for (let p = 0; p < totalPages; p++) {
            if (p > 0) pdf.addPage();
            addHeader(pdf, p + 1, totalPages);

            let y = HEADER_H + 2;
            for (const { canvas, srcY, srcH } of pages[p]) {
                const wPx = Math.floor(canvas.width);
                const ratio = USABLE_W / (wPx / SCALE);

                const sourceY = Math.max(0, Math.floor(srcY));
                const maxSourceH = Math.max(0, canvas.height - sourceY);
                const sourceH = Math.max(0, Math.min(Math.floor(srcH), maxSourceH));

                if (wPx < 2 || sourceH < 1 || !Number.isFinite(ratio) || ratio <= 0) continue;

                const slice = document.createElement('canvas');
                slice.width = wPx;
                slice.height = sourceH;
                const ctx = slice.getContext('2d');
                if (!ctx) continue;

                ctx.drawImage(canvas, 0, sourceY, wPx, sourceH, 0, 0, wPx, sourceH);

                const sliceMm = (sourceH / SCALE) * ratio;
                pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN, y, USABLE_W, sliceMm);
                y += sliceMm + 2;
            }
        }

        pdf.setPage(totalPages);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        pdf.text(
            `Generated on ${date} by The Hotel Insider · info@thehotelinsider.co · thehotelinsider.co`,
            PAGE_W / 2,
            PAGE_H - 4,
            { align: 'center' }
        );

        return pdf.output('blob');
    }, [hotelName, scoreCardElementId]);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            toast({ title: 'Generating PDF…', description: 'Capturing all sections at high quality.' });
            const blob = await buildPdfBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'PDF downloaded!', description: `${fileName} saved to your Downloads folder.` });
        } catch (err) {
            console.error('PDF generation error:', err);
            toast({ title: 'Export failed', description: 'Could not generate the PDF.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShareViaEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!recipientEmail.trim() || !emailRegex.test(recipientEmail.trim())) {
            toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        setIsSharing(true);
        try {
            toast({ title: 'Preparing report…', description: 'Generating PDF for sharing.' });
            const blob = await buildPdfBlob();
            const file = new File([blob], fileName, { type: 'application/pdf' });

            // Try Web Share API with file attachment (supported on modern browsers)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Hotel Online Score Card – ${hotelName}`,
                    text: `Here is the Hotel Online Score Card report for ${hotelName}, generated by The Hotel Insider.`,
                    files: [file],
                });
                toast({ title: 'Report shared!', description: 'The PDF was shared successfully.' });
            } else {
                // Fallback: download PDF then open mailto
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);

                const subject = encodeURIComponent(`Hotel Online Score Card – ${hotelName}`);
                const body = encodeURIComponent(
                    `Hi,\n\nPlease find attached the Hotel Online Score Card report for ${hotelName}.\n\nThis report was generated by The Hotel Insider (thehotelinsider.co) and includes scores for SEO, website quality, reviews, OTA performance, and social media presence.\n\nBest regards`
                );
                window.open(`mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${subject}&body=${body}`, '_self');

                toast({
                    title: 'PDF downloaded & email opened!',
                    description: 'Please attach the downloaded PDF to the email in your mail client.',
                });
            }

            setShowEmailDialog(false);
            setRecipientEmail('');
        } catch (err) {
            // User may have cancelled the share dialog – not a real error
            if ((err as Error)?.name !== 'AbortError') {
                console.error('Share error:', err);
                toast({ title: 'Share failed', description: 'Could not share the report.', variant: 'destructive' });
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div
            data-pdf-hide
            className="bg-background rounded-2xl border border-border shadow-sm p-6 space-y-4"
        >
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Share2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground text-sm">Share This Report</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Export a clean PDF containing all score card results for&nbsp;
                            <span className="font-medium text-foreground">{hotelName}</span>.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        onClick={() => setShowEmailDialog((prev) => !prev)}
                        variant="outline"
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
                    >
                        <Mail className="w-4 h-4" />
                        Share via Email
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating…
                            </>
                        ) : (
                            <>
                                <FileDown className="w-4 h-4" />
                                Download PDF
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {showEmailDialog && (
                <div className="flex items-center gap-2 pt-2 border-t border-border animate-fade-in">
                    <Input
                        type="email"
                        placeholder="Enter recipient email address"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleShareViaEmail()}
                        className="flex-1 rounded-xl text-sm"
                        autoFocus
                    />
                    <Button
                        onClick={handleShareViaEmail}
                        disabled={isSharing}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
                    >
                        {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send
                    </Button>
                    <Button
                        onClick={() => { setShowEmailDialog(false); setRecipientEmail(''); }}
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ShareScoreCard;
