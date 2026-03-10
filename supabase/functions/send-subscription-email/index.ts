import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Store subscription in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert({ full_name: fullName, email, hotel_name: hotelName });

    if (dbError) {
      console.error('Database insert error:', dbError);
    }

    // Send notification email
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
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
          subject: `New Subscription – ${fullName} (${hotelName})`,
          html: emailHtml,
          purpose: 'transactional',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Email API error:', errorData);
        console.log('Subscription saved to database:', { fullName, email, hotelName });
      } else {
        console.log('Email sent successfully for:', { fullName, email, hotelName });
      }
    } else {
      console.warn('LOVABLE_API_KEY not configured, subscription saved to database only');
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
