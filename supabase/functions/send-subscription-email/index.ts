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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save subscription to database
    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert({ full_name: fullName, email, hotel_name: hotelName });

    if (dbError) {
      console.error('Database insert error:', dbError);
    }

    // Build notification email HTML
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

    const plainText = `New Subscription - ${fullName} (${email}) - Hotel: ${hotelName}`;
    const messageId = `subscription-${crypto.randomUUID()}`;

    // Send email via Brevo API
    try {
      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Hotel Score Card', email: 'info@thehotelinsider.co' },
          to: [{ email: 'info@thehotelinsider.co' }],
          subject: `New Subscription – ${fullName} (${hotelName})`,
          htmlContent: emailHtml,
          textContent: plainText,
          headers: { 'X-Message-Id': messageId },
        }),
      });

      if (!brevoResponse.ok) {
        const errorData = await brevoResponse.text();
        throw new Error(`Brevo API error [${brevoResponse.status}]: ${errorData}`);
      }

      await brevoResponse.json();

      // Log success
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'subscription-notification',
        recipient_email: 'info@thehotelinsider.co',
        status: 'sent',
        metadata: { fullName, email, hotelName },
      });

      console.log('Subscription saved and email sent via Brevo:', { fullName, email, hotelName, messageId });
    } catch (sendError) {
      console.error('Email send error:', sendError);

      // Log failure
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'subscription-notification',
        recipient_email: 'info@thehotelinsider.co',
        status: 'failed',
        error_message: sendError instanceof Error ? sendError.message : String(sendError),
        metadata: { fullName, email, hotelName },
      });
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
