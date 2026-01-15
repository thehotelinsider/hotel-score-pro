import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProfileItem {
  name: string;
  status: 'complete' | 'incomplete' | 'needs_improvement';
  value: string;
  action: string;
}

interface GoogleBusinessData {
  rating: number;
  reviewCount: number;
  score: number;
  profileItems: ProfileItem[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName, hotelCity, hotelState, hotelCountry, hotelRating, hotelReviewCount } = await req.json();
    
    console.log('Analyzing Google Business Profile for:', hotelName);
    console.log('Location:', hotelCity, hotelState, hotelCountry);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a Google Business Profile expert analyzer for hotels and hospitality businesses. 
Your task is to analyze and generate realistic Google Business Profile data for a hotel based on its information.

You must return structured data using the provided function tool. Generate realistic but slightly varied data that represents what a real hotel's Google Business Profile might look like.

Consider factors like:
- Hotel location and market (city, state, country)
- The hotel's existing rating and review count
- Common GBP optimization issues hotels face
- Realistic completion statuses based on typical hotel profiles

Generate a mix of complete, incomplete, and needs_improvement items to create a realistic profile assessment.`;

    const userPrompt = `Analyze the Google Business Profile for this hotel:

Hotel Name: ${hotelName}
Location: ${hotelCity || 'Unknown'}, ${hotelState || ''} ${hotelCountry || 'USA'}
Current Rating: ${hotelRating || 'Not available'}
Review Count: ${hotelReviewCount || 'Unknown'}

Generate a realistic Google Business Profile analysis with profile items covering:
1. First-party website
2. Business description
3. Business hours
4. Phone number
5. Price range
6. Amenities
7. Photos
8. Google Posts
9. Q&A section
10. Review responses

For each item, provide a realistic status (complete, incomplete, or needs_improvement), a current value, and an actionable recommendation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_google_business_data",
              description: "Return the analyzed Google Business Profile data",
              parameters: {
                type: "object",
                properties: {
                  rating: { 
                    type: "number", 
                    description: "The hotel's Google rating (1-5 scale)" 
                  },
                  reviewCount: { 
                    type: "number", 
                    description: "Total number of Google reviews" 
                  },
                  score: { 
                    type: "number", 
                    description: "Profile completeness score out of 20" 
                  },
                  profileItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the profile element" },
                        status: { 
                          type: "string", 
                          enum: ["complete", "incomplete", "needs_improvement"],
                          description: "Current status of this profile element" 
                        },
                        value: { type: "string", description: "Current value or status description" },
                        action: { type: "string", description: "Recommended action to improve this element" }
                      },
                      required: ["name", "status", "value", "action"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["rating", "reviewCount", "score", "profileItems"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_google_business_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "Payment required, please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response received");

    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "return_google_business_data") {
      console.error("No valid tool call in response");
      throw new Error("Failed to get structured response from AI");
    }

    const googleBusinessData: GoogleBusinessData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed Google Business data:", googleBusinessData);

    // Use existing hotel data if available
    if (hotelRating && !isNaN(hotelRating)) {
      googleBusinessData.rating = hotelRating;
    }
    if (hotelReviewCount && !isNaN(hotelReviewCount)) {
      googleBusinessData.reviewCount = hotelReviewCount;
    }

    return new Response(JSON.stringify(googleBusinessData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-google-business:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
