import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface Product {
  id: string;
  sku: string;
  title: string;
  current_price: number;
  cost_price: number | null;
  min_price: number | null;
  max_price: number | null;
  buy_box_status: string | null;
  competitor_count: number | null;
  stock_quantity: number | null;
  takealot_offer_id: string | null;
}

interface RepricingRule {
  id: string;
  name: string;
  rule_type: string;
  price_adjustment: number | null;
  adjustment_type: string | null;
  min_margin: number | null;
  priority: number | null;
  is_active: boolean | null;
}

interface Competitor {
  product_id: string;
  competitor_price: number;
  has_buy_box: boolean | null;
}

// Verify API key authentication
function verifyApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = Deno.env.get('EDGE_FUNCTION_API_KEY');
  
  if (!expectedKey) {
    console.warn('EDGE_FUNCTION_API_KEY not configured - authentication disabled');
    return true; // Allow if not configured (for backward compatibility during setup)
  }
  
  return apiKey === expectedKey;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify API key
  if (!verifyApiKey(req)) {
    console.error('Unauthorized: Invalid or missing API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from request body
    let userId: string;
    try {
      const body = await req.json();
      userId = body.user_id;
    } catch {
      throw new Error('Invalid request body');
    }

    if (!userId) {
      throw new Error('user_id is required');
    }

    console.log(`Starting AI-powered repricing analysis for user: ${userId}`);

    // Fetch all products for this user
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    // Fetch all active repricing rules for this user
    const { data: rules, error: rulesError } = await supabase
      .from('repricing_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (rulesError) {
      throw new Error(`Error fetching rules: ${rulesError.message}`);
    }

    // Fetch all competitors for this user
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select('*')
      .eq('user_id', userId);

    if (competitorsError) {
      throw new Error(`Error fetching competitors: ${competitorsError.message}`);
    }

    console.log(`Analyzing ${products?.length || 0} products with ${rules?.length || 0} rules`);

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No products to reprice', analyzed: 0, recommendations: 0, applied: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group competitors by product
    const competitorsByProduct: Record<string, Competitor[]> = {};
    for (const comp of competitors || []) {
      if (!competitorsByProduct[comp.product_id]) {
        competitorsByProduct[comp.product_id] = [];
      }
      competitorsByProduct[comp.product_id].push(comp);
    }

    // Prepare data for AI analysis
    const analysisData = products.map(product => ({
      id: product.id,
      sku: product.sku,
      title: product.title,
      current_price: product.current_price,
      cost_price: product.cost_price,
      min_price: product.min_price,
      max_price: product.max_price,
      buy_box_status: product.buy_box_status,
      stock_quantity: product.stock_quantity,
      competitors: competitorsByProduct[product.id] || [],
      lowest_competitor_price: competitorsByProduct[product.id]?.length 
        ? Math.min(...competitorsByProduct[product.id].map(c => c.competitor_price))
        : null,
    }));

    // Call Gemini AI for intelligent repricing recommendations
    const prompt = `You are an AI pricing strategist for e-commerce on Takealot marketplace.

Analyze these products and provide optimal pricing recommendations:

PRODUCTS DATA:
${JSON.stringify(analysisData, null, 2)}

ACTIVE REPRICING RULES:
${JSON.stringify(rules, null, 2)}

INSTRUCTIONS:
1. For each product, recommend an optimal price considering:
   - Current price vs competitor prices
   - Cost price and minimum margin requirements
   - Buy box status (if lost, may need to lower price)
   - Stock levels (low stock might allow higher pricing)
   - Min/max price constraints if set

2. Apply the repricing rules in priority order:
   - beat_lowest: Beat the lowest competitor by the adjustment amount
   - match_lowest: Match the lowest competitor price
   - maintain_margin: Ensure minimum profit margin is maintained
   - stay_competitive: Stay within a competitive range

3. Return ONLY a valid JSON array with recommendations:
[
  {
    "product_id": "uuid",
    "current_price": number,
    "recommended_price": number,
    "reason": "explanation",
    "confidence": "high|medium|low"
  }
]

Only include products that need price changes. Return empty array if no changes needed.`;

    console.log('Calling Gemini AI for analysis...');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    console.log('AI Response:', aiResponse);

    // Parse AI recommendations
    let recommendations: any[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      recommendations = [];
    }

    console.log(`AI recommended ${recommendations.length} price changes`);

    // Apply recommendations
    const applied: any[] = [];
    const takealotApiKey = Deno.env.get('TAKEALOT_API_KEY');

    for (const rec of recommendations) {
      if (!rec.product_id || !rec.recommended_price) continue;

      const product = products.find(p => p.id === rec.product_id);
      if (!product) continue;

      // Validate price is within bounds
      let finalPrice = rec.recommended_price;
      if (product.min_price && finalPrice < product.min_price) {
        finalPrice = product.min_price;
      }
      if (product.max_price && finalPrice > product.max_price) {
        finalPrice = product.max_price;
      }

      // Skip if price hasn't changed significantly
      if (Math.abs(finalPrice - product.current_price) < 0.01) continue;

      // Update price on Takealot if available
      if (product.takealot_offer_id && takealotApiKey) {
        try {
          const takealotResponse = await fetch(
            `https://seller-api.takealot.com/v2/offers/offer/${product.takealot_offer_id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Key ${takealotApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ selling_price: finalPrice }),
            }
          );

          if (!takealotResponse.ok) {
            console.error(`Failed to update Takealot price for ${product.sku}`);
          } else {
            console.log(`Updated Takealot price for ${product.sku} to ${finalPrice}`);
          }
        } catch (err) {
          console.error(`Takealot update error for ${product.sku}:`, err);
        }
      }

      // Log price change
      await supabase.from('price_history').insert({
        product_id: rec.product_id,
        old_price: product.current_price,
        new_price: finalPrice,
        reason: `AI Repricer: ${rec.reason}`,
      });

      // Update local price
      await supabase
        .from('products')
        .update({
          current_price: finalPrice,
          last_repriced_at: new Date().toISOString(),
        })
        .eq('id', rec.product_id);

      applied.push({
        ...rec,
        applied_price: finalPrice,
        original_price: product.current_price,
      });
    }

    console.log(`Applied ${applied.length} price changes`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: products.length,
        recommendations: recommendations.length,
        applied: applied.length,
        details: applied,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AI Repricer error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
