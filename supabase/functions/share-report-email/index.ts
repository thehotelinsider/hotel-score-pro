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
    const { recipientEmail, hotelName } = await req.json();

    if (!recipientEmail || !hotelName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const brevoApiKey = Deno.env.get('BREVO_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background-color: #1e293b; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Hotel Online Score Card</h1>
          <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">by The Hotel Insider</p>
        </div>
        <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi,</p>
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">
            Please find attached the <strong>Hotel Online Score Card</strong> report for <strong>${hotelName}</strong>.
          </p>
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">
            This report includes scores and detailed analysis for:
          </p>
          <ul style="color: #475569; font-size: 15px; line-height: 1.8;">
            <li>SEO &amp; Search Rankings</li>
            <li>Website Quality</li>
            <li>Guest Reviews</li>
            <li>OTA Performance</li>
            <li>Social Media Presence</li>
          </ul>
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">
            To view the full interactive report, visit <a href="https://online-hotel-scorecard.lovable.app" style="color: #3b82f6; text-decoration: underline;">The Hotel Insider</a>.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 13px; text-align: center;">
            Sent by The Hotel Insider · <a href="https://thehotelinsider.co" style="color: #94a3b8;">thehotelinsider.co</a> · info@thehotelinsider.co
          </p>
        </div>
      </div>
    `;

    const plainText = `Hotel Online Score Card Report for ${hotelName}\n\nThis report includes scores for SEO, Website Quality, Reviews, OTA Performance, and Social Media Presence.\n\nVisit https://online-hotel-scorecard.lovable.app for the full interactive report.\n\nSent by The Hotel Insider · thehotelinsider.co · info@thehotelinsider.co`;

    const messageId = `share-report-${crypto.randomUUID()}`;

    // Send email via Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'The Hotel Insider', email: 'info@thehotelinsider.co' },
        to: [{ email: recipientEmail }],
        subject: `Hotel Online Score Card – ${hotelName}`,
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

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'share-report',
      recipient_email: recipientEmail,
      status: 'sent',
      metadata: { hotelName },
    });

    console.log('Report share email sent via Brevo:', { recipientEmail, hotelName, messageId });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Share report email error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
