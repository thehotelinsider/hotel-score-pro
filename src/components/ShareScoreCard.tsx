import { useState } from 'react';
import { FileDown, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ShareScoreCardProps {
    hotelName: string;
    scoreCardElementId: string;
}

const ShareScoreCard = ({ hotelName, scoreCardElementId }: ShareScoreCardProps) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            // Dynamically import to keep initial bundle small
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const element = document.getElementById(scoreCardElementId);
            if (!element) throw new Error('Score card element not found');

            toast({
                title: 'Generating PDF…',
                description: 'This may take a few seconds while we capture all sections.',
            });

            // Capture the element at 2× scale for crisp output
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8fafc',
                logging: false,
                // Hide controls / buttons during export
                onclone: (doc) => {
                    // Hide Refresh buttons, share section itself, contact section CTA during export
                    doc.querySelectorAll('[data-pdf-hide]').forEach((el) => {
                        (el as HTMLElement).style.display = 'none';
                    });
                },
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            // A4 page dimensions in mm
            const pdfWidth = 210;
            const pdfHeight = 297;
            const margin = 10;
            const usableWidth = pdfWidth - margin * 2;

            // Scale image to fit page width
            const ratio = usableWidth / (imgWidth / 2); // div 2 because scale=2
            const scaledImgHeightMm = (imgHeight / 2) * ratio;

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            // Header on every page
            const addPageHeader = (doc: typeof pdf, pageNum: number, totalPages: number) => {
                doc.setFillColor(30, 41, 59); // slate-800
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

            const contentAreaHeight = pdfHeight - 14 - 8; // subtract header and bottom margin
            const totalPages = Math.ceil(scaledImgHeightMm / contentAreaHeight);

            for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage();
                addPageHeader(pdf, page + 1, totalPages);

                // Clip the canvas slice for this page
                const srcY = (page * contentAreaHeight) / ratio; // in original px (scale=1)
                const srcHeight = contentAreaHeight / ratio;

                // Create a temporary canvas slice
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = imgWidth;
                sliceCanvas.height = Math.min(srcHeight * 2, imgHeight - srcY * 2);
                const ctx = sliceCanvas.getContext('2d')!;
                ctx.drawImage(canvas, 0, srcY * 2, imgWidth, sliceCanvas.height, 0, 0, imgWidth, sliceCanvas.height);

                const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
                const sliceHeightMm = (sliceCanvas.height / 2) * ratio;
                pdf.addImage(sliceData, 'JPEG', margin, 14, usableWidth, sliceHeightMm);
            }

            // Footer on last page
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

            // Safe filename
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

    return (
        <div
            data-pdf-hide
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-4 justify-between"
        >
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
                        No app links — just the data.
                    </p>
                </div>
            </div>

            {/* Right — action button */}
            <Button
                onClick={generatePDF}
                disabled={isGenerating}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-all"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating PDF…
                    </>
                ) : (
                    <>
                        <FileDown className="w-4 h-4" />
                        Download PDF Report
                    </>
                )}
            </Button>
        </div>
    );
};

export default ShareScoreCard;
