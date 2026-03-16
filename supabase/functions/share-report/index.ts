import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, reportData } = await req.json();

    if (!recipientEmail || !reportData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save report to database
    const { data: report, error: dbError } = await supabase
      .from('shared_reports')
      .insert({
        hotel_name: reportData.hotelName,
        hotel_address: reportData.hotelAddress,
        hotel_city: reportData.hotelCity,
        hotel_state: reportData.hotelState,
        hotel_country: reportData.hotelCountry,
        hotel_rating: reportData.hotelRating,
        hotel_review_count: reportData.hotelReviewCount,
        hotel_image_url: reportData.hotelImageUrl,
        score_overall: reportData.scoreOverall,
        score_seo: reportData.scoreSeo,
        score_website: reportData.scoreWebsite,
        score_reviews: reportData.scoreReviews,
        score_social_media: reportData.scoreSocialMedia,
        score_ota: reportData.scoreOta,
        competitors: reportData.competitors,
        rankings: reportData.rankings,
        issues: reportData.issues,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw new Error('Failed to save report');
    }

    // Build the report link
    const publishedUrl = Deno.env.get('SITE_URL') || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}`;
    // Use the origin from the request referer if available
    const referer = req.headers.get('referer') || req.headers.get('origin') || '';
    const baseUrl = referer ? new URL(referer).origin : 'https://online-hotel-scorecard.lovable.app';
    const reportLink = `${baseUrl}/report/${report.id}`;

    // Send email with report link
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 22px; font-weight: 700;">Hotel Online Score Card</h1>
          <p style="color: #a0aec0; margin: 0; font-size: 14px;">Report for ${reportData.hotelName}</p>
        </div>
        
        <div style="background: #ffffff; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 80px; height: 80px; line-height: 80px; border-radius: 50%; background: ${reportData.scoreOverall >= 70 ? '#48bb78' : reportData.scoreOverall >= 50 ? '#ecc94b' : '#f56565'}; color: white; font-size: 28px; font-weight: 700;">
              ${reportData.scoreOverall}
            </div>
            <p style="color: #718096; margin: 8px 0 0 0; font-size: 13px;">Overall Score</p>
          </div>

          <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            A Hotel Online Score Card has been shared with you for <strong>${reportData.hotelName}</strong>. Click the button below to view the full report with detailed insights and recommendations.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${reportLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600;">
              View Full Report
            </a>
          </div>
        </div>

        <div style="padding: 20px 24px; text-align: center; border-radius: 0 0 12px 12px; background: #f1f5f9;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Powered by <strong>THE HOTEL INSIDER</strong> · Hotel Online Score Card
          </p>
        </div>
      </div>
    `;

    const messageId = `share-report-${crypto.randomUUID()}`;

    try {
      await sendLovableEmail(
        {
          to: recipientEmail,
          from: 'Hotel Score Card <noreply@notify.go1.thehotelinsider.co>',
          sender_domain: 'notify.go1.thehotelinsider.co',
          subject: `Hotel Online Score Card – ${reportData.hotelName}`,
          html: emailHtml,
          text: `View the Hotel Online Score Card report for ${reportData.hotelName}: ${reportLink}`,
          purpose: 'transactional',
          label: 'share-report',
          message_id: messageId,
        },
        { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
      );

      // Log success
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'share-report',
        recipient_email: recipientEmail,
        status: 'sent',
        metadata: { hotelName: reportData.hotelName, reportId: report.id },
      });

      // Also log in report_shares
      await supabase.from('report_shares').insert({
        hotel_name: reportData.hotelName,
        recipient_email: recipientEmail,
      });

    } catch (sendError) {
      console.error('Email send error:', sendError);
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'share-report',
        recipient_email: recipientEmail,
        status: 'failed',
        error_message: sendError instanceof Error ? sendError.message : String(sendError),
        metadata: { hotelName: reportData.hotelName, reportId: report.id },
      });
    }

    return new Response(JSON.stringify({ success: true, reportId: report.id, reportLink }), {
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
