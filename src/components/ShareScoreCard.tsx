import { useState } from 'react';
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

    const captureAndBuildPDF = async () => {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const element = document.getElementById(scoreCardElementId);
        if (!element) throw new Error('Score card element not found');

        const canvas = await html2canvas(element, {
            scale: 2,
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

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pdfWidth = 210;
        const pdfHeight = 297;
        const margin = 10;
        const usableWidth = pdfWidth - margin * 2;
        const ratio = usableWidth / (imgWidth / 2);
        const scaledImgHeightMm = (imgHeight / 2) * ratio;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const addPageHeader = (doc: typeof pdf, pageNum: number, totalPages: number) => {
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pdfWidth, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Hotel Online Score Card', margin, 9);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`${hotelName}`, pdfWidth / 2, 9, { align: 'center' });
            doc.text(`Page ${pageNum} of ${totalPages}  |  thehotelinsider.co`, pdfWidth - margin, 9, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        };

        const contentAreaHeight = pdfHeight - 14 - 8;
        const totalPages = Math.ceil(scaledImgHeightMm / contentAreaHeight);

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) pdf.addPage();
            addPageHeader(pdf, page + 1, totalPages);

            const srcY = (page * contentAreaHeight) / ratio;
            const srcHeight = contentAreaHeight / ratio;
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = Math.min(srcHeight * 2, imgHeight - srcY * 2);
            const ctx = sliceCanvas.getContext('2d')!;
            ctx.drawImage(canvas, 0, srcY * 2, imgWidth, sliceCanvas.height, 0, 0, imgWidth, sliceCanvas.height);

            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            const sliceHeightMm = (sliceCanvas.height / 2) * ratio;
            pdf.addImage(sliceData, 'JPEG', margin, 14, usableWidth, sliceHeightMm);
        }

        pdf.setPage(totalPages);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        pdf.text(
            `Generated on ${date} by The Hotel Insider · info@thehotelinsider.co · thehotelinsider.co`,
            pdfWidth / 2,
            pdfHeight - 4,
            { align: 'center' }
        );

        return pdf;
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            toast({
                title: 'Generating PDF…',
                description: 'This may take a few seconds while we capture all sections.',
            });

            const pdf = await captureAndBuildPDF();
            const safeName = hotelName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
            pdf.save(`Hotel_Score_Card_${safeName}.pdf`);

            toast({
                title: 'PDF downloaded!',
                description: `Hotel_Score_Card_${safeName}.pdf has been saved to your Downloads folder.`,
            });
        } catch (err) {
            console.error('PDF generation error:', err);
            toast({
                title: 'Export failed',
                description: 'Could not generate the PDF. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShareViaEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!recipientEmail.trim() || !emailRegex.test(recipientEmail.trim())) {
            toast({
                title: 'Invalid email',
                description: 'Please enter a valid email address.',
                variant: 'destructive',
            });
            return;
        }

        setIsSharing(true);
        try {
            toast({
                title: 'Preparing report…',
                description: 'Generating PDF and opening your email client.',
            });

            // Generate and download the PDF first
            const pdf = await captureAndBuildPDF();
            const safeName = hotelName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
            pdf.save(`Hotel_Score_Card_${safeName}.pdf`);

            // Open mailto with pre-filled content
            const subject = encodeURIComponent(`Hotel Online Score Card – ${hotelName}`);
            const body = encodeURIComponent(
                `Hi,\n\nPlease find attached the Hotel Online Score Card report for ${hotelName}.\n\nThis report was generated by The Hotel Insider (thehotelinsider.co) and includes scores for SEO, website quality, reviews, OTA performance, and social media presence.\n\nBest regards`
            );
            window.open(`mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${subject}&body=${body}`, '_self');

            toast({
                title: 'PDF downloaded & email opened!',
                description: 'Attach the downloaded PDF to the email in your mail client.',
            });

            setShowEmailDialog(false);
            setRecipientEmail('');
        } catch (err) {
            console.error('Share error:', err);
            toast({
                title: 'Share failed',
                description: 'Could not prepare the report. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div
            data-pdf-hide
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                {/* Left — description */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Share2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-slate-800 text-sm">Share This Report</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Export a clean PDF containing all score card results for&nbsp;
                            <span className="font-medium text-slate-700">{hotelName}</span>.
                        </p>
                    </div>
                </div>

                {/* Right — action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        onClick={() => setShowEmailDialog((prev) => !prev)}
                        variant="outline"
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
                    >
                        <Mail className="w-4 h-4" />
                        Share via Email
                    </Button>
                    <Button
                        onClick={generatePDF}
                        disabled={isGenerating}
                        className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all"
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

            {/* Email share dialog */}
            {showEmailDialog && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 animate-fade-in">
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
                        className="bg-accent hover:bg-accent/90 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all"
                    >
                        {isSharing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send
                    </Button>
                    <Button
                        onClick={() => { setShowEmailDialog(false); setRecipientEmail(''); }}
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ShareScoreCard;
