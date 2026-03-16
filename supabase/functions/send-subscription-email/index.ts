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

    const messageId = `subscription-${crypto.randomUUID()}`;

    // Enqueue email via the queue system for reliable delivery with retries
    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        run_id: crypto.randomUUID(),
        to: 'info@thehotelinsider.co',
        subject: `New Subscription – ${fullName} (${hotelName})`,
        html: emailHtml,
        from: 'Hotel Score Card <noreply@notify.go1.thehotelinsider.co>',
        sender_domain: 'notify.go1.thehotelinsider.co',
        purpose: 'transactional',
        message_id: messageId,
        label: 'subscription-notification',
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error('Enqueue error:', enqueueError);
    }

    // Log the pending email
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'subscription-notification',
      recipient_email: 'info@thehotelinsider.co',
      status: 'pending',
      metadata: { fullName, email, hotelName },
    });

    console.log('Subscription saved and email enqueued:', { fullName, email, hotelName, messageId });

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
