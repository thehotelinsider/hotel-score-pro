import React, { useState } from 'react';
import { Mail, Phone, User, Send, CheckCircle, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface ContactSectionProps {
  currentScore?: number;
  shareButton?: React.ReactNode;
}

const ContactSection: React.FC<ContactSectionProps> = ({ currentScore = 0, shareButton }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !phone.trim() || !hotelName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Create mailto link with pre-filled content
    const subject = encodeURIComponent(`Hotel Score Card Consultation Request`);
    const body = encodeURIComponent(
      `Hello THE HOTEL INSIDER,\n\n` +
      `I would like to request a consultation to improve my Hotel Online Score Card to a 95.\n\n` +
      `My Details:\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `Hotel Name: ${hotelName}\n` +
      `Current Score: ${currentScore}\n\n` +
      `Please contact me at your earliest convenience.\n\n` +
      `Best regards,\n${name}`
    );

    const mailtoLink = `mailto:info@thehotelinsider.co?subject=${subject}&body=${body}`;

    // Use a temporary hidden anchor to trigger mailto without navigating away from the page
    const anchor = document.createElement('a');
    anchor.href = mailtoLink;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      toast({
        title: "Request Ready to Send",
        description: "Your email client has opened with your details. Click Send to deliver your request to THE HOTEL INSIDER.",
      });
    }, 500);
  };

  if (isSubmitted) {
    return (
      <div className="bg-gradient-to-br from-success/10 via-background to-success/5 rounded-2xl p-8 border border-success/30 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Request Sent!</h3>
          <p className="text-muted-foreground mb-4">
            Your email client should have opened with your consultation request.
            THE HOTEL INSIDER team will contact you soon.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setIsSubmitted(false);
              setName('');
              setEmail('');
              setPhone('');
              setHotelName('');
            }}
          >
            Send Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-primary/20 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent mb-3 sm:mb-4">
          <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">
          Improve Your Hotel's Online Presence
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto">
          Contact <span className="font-semibold text-foreground">THE HOTEL INSIDER</span> for a consultation
          to get your Hotel Online Score Card to a <span className="font-bold text-success">95</span>
        </p>
      </div>

      {/* Score improvement visualization */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-muted/50 rounded-lg sm:rounded-xl">
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold text-warning">{currentScore}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Current Score</div>
        </div>
        <div className="flex items-center">
          <div className="w-10 sm:w-16 h-0.5 bg-gradient-to-r from-warning to-success" />
          <div className="w-0 h-0 border-t-[5px] sm:border-t-4 border-b-[5px] sm:border-b-4 border-l-[6px] sm:border-l-8 border-transparent border-l-success" />
        </div>
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold text-success">95</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Target Score</div>
        </div>
      </div>

      {/* Contact Form */}
      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="name" className="text-xs sm:text-sm font-medium text-foreground">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-foreground">
            Email Address <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="phone" className="text-xs sm:text-sm font-medium text-foreground">
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10 text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="hotelName" className="text-xs sm:text-sm font-medium text-foreground">
            Hotel Name <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="hotelName"
              type="text"
              placeholder="Enter your hotel name"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="pl-10 text-sm"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-5 sm:py-6 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
              Opening Email...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Contact THE HOTEL INSIDER
            </>
          )}
        </Button>

        <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
          By submitting, you'll be directed to email{' '}
          <a href="mailto:info@thehotelinsider.co" className="text-primary hover:underline">
            info@thehotelinsider.co
          </a>
        </p>
      </form>
    </div>
  );
};

export default ContactSection;
