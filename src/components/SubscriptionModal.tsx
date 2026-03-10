import React, { useState } from 'react';
import { X, Mail, User, Building2, Send, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [hotelName, setHotelName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { toast } = useToast();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName.trim() || !email.trim() || !hotelName.trim()) {
            toast({
                title: 'Missing Information',
                description: 'Please fill in all fields to subscribe.',
                variant: 'destructive',
            });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast({
                title: 'Invalid Email',
                description: 'Please enter a valid email address.',
                variant: 'destructive',
            });
            return;
        }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-subscription-email', {
        body: { fullName, email, hotelName },
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Subscribed!',
        description: 'Your subscription has been sent to THE HOTEL INSIDER.',
      });
    } catch (err) {
      console.error('Subscription error:', err);
      toast({
        title: 'Submission Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
    };

    const handleClose = () => {
        setFullName('');
        setEmail('');
        setHotelName('');
        setIsSubmitted(false);
        onClose();
    };

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            {/* Modal card */}
            <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl animate-fade-in overflow-hidden">

                {/* Gradient header bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-6 sm:p-8">
                    {isSubmitted ? (
                        /* Success state */
                        <div className="text-center py-4">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-success/20 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-success" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">You're Subscribed!</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Thank you, <span className="font-medium text-foreground">{fullName}</span>. Your subscription request has been sent to THE HOTEL INSIDER. We'll be in touch shortly.
                            </p>
                            <Button onClick={handleClose} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                                Continue Exploring
                            </Button>
                        </div>
                    ) : (
                        /* Form state */
                        <>
                            {/* Icon + heading */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                                    <Sparkles className="w-7 h-7 text-primary-foreground" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                                    Subscribe to Hotel Online Score Card
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    by <span className="font-semibold text-foreground">THE HOTEL INSIDER</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                                    Get ongoing insights and recommendations to keep your hotel's online score at its peak.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Full Name */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="sub-fullname" className="text-sm font-medium text-foreground">
                                        Full Name <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="sub-fullname"
                                            type="text"
                                            placeholder="Enter your full name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="pl-10"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="sub-email" className="text-sm font-medium text-foreground">
                                        Email Address <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="sub-email"
                                            type="email"
                                            placeholder="Enter your email address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Hotel Name */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="sub-hotel" className="text-sm font-medium text-foreground">
                                        Hotel Name <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="sub-hotel"
                                            type="text"
                                            placeholder="Enter your hotel name"
                                            value={hotelName}
                                            onChange={(e) => setHotelName(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-5 rounded-xl font-medium hover:opacity-90 transition-opacity mt-2"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    {isSubmitting ? 'Sending...' : 'Subscribe Now'}
                                </Button>

                                <p className="text-[10px] text-center text-muted-foreground">
                                    Your info is sent directly to{' '}
                                    <a href="mailto:info@thehotelinsider.co" className="text-primary hover:underline">
                                        info@thehotelinsider.co
                                    </a>
                                </p>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;
