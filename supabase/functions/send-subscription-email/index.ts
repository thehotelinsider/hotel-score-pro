import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, hotelName } = await req.json();

    if (!fullName || !email || !hotelName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">New Subscription – Hotel Online Score Card</h2>
        <p>Hello THE HOTEL INSIDER,</p>
        <p>A new user has subscribed to the Hotel Online Score Card.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Full Name</td><td style="padding: 8px; border: 1px solid #ddd;">${fullName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${email}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Hotel Name</td><td style="padding: 8px; border: 1px solid #ddd;">${hotelName}</td></tr>
        </table>
        <p>Please add them to the subscription list and follow up at your earliest convenience.</p>
        <p>Best regards,<br/>Hotel Online Score Card System</p>
      </div>
    `;

    const response = await fetch('https://api.lovable.dev/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'info@thehotelinsider.co',
        subject: 'New Subscription – Hotel Online Score Card',
        html: emailHtml,
        purpose: 'transactional',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Email API error:', errorData);
      // Fallback: log the subscription details
      console.log('Subscription received:', { fullName, email, hotelName });
      // Still return success to user - we captured the data
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
