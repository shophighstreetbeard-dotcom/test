import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface PriceUpdate {
  product_id: string;
  new_price: number;
  reason?: string;
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
    const takealotApiKey = Deno.env.get('TAKEALOT_API_KEY');

    if (!takealotApiKey) {
      throw new Error('TAKEALOT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { updates, user_id } = await req.json() as { updates: PriceUpdate[]; user_id: string };

    if (!user_id) {
      throw new Error('user_id is required');
    }

    if (!updates || !Array.isArray(updates)) {
      throw new Error('Invalid request: updates array required');
    }

    console.log(`Processing ${updates.length} price updates for user: ${user_id}`);

    const results: { product_id: string; success: boolean; error?: string; old_price?: number; new_price?: number }[] = [];

    for (const update of updates) {
      try {
        // Get product details - verify ownership
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', update.product_id)
          .eq('user_id', user_id)
          .single();

        if (productError || !product) {
          results.push({ product_id: update.product_id, success: false, error: 'Product not found or access denied' });
          continue;
        }

        // Update price on Takealot if offer_id exists
        if (product.takealot_offer_id) {
          console.log(`Updating Takealot price for offer ${product.takealot_offer_id} to ${update.new_price}`);
          
          const takealotResponse = await fetch(
            `https://seller-api.takealot.com/v2/offers/offer/${product.takealot_offer_id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Key ${takealotApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                selling_price: update.new_price,
              }),
            }
          );

          if (!takealotResponse.ok) {
            const errorText = await takealotResponse.text();
            console.error(`Takealot API error for ${product.takealot_offer_id}:`, errorText);
            results.push({ 
              product_id: update.product_id, 
              success: false, 
              error: `Takealot API error: ${takealotResponse.status}` 
            });
            continue;
          }

          console.log(`Successfully updated Takealot price for ${product.takealot_offer_id}`);
        }

        // Log price change
        await supabase.from('price_history').insert({
          product_id: update.product_id,
          old_price: product.current_price,
          new_price: update.new_price,
          reason: update.reason || 'Manual update',
        });

        // Update local product price
        await supabase
          .from('products')
          .update({
            current_price: update.new_price,
            last_repriced_at: new Date().toISOString(),
          })
          .eq('id', update.product_id);

        results.push({ 
          product_id: update.product_id, 
          success: true,
          old_price: product.current_price,
          new_price: update.new_price
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error updating product ${update.product_id}:`, errorMessage);
        results.push({ product_id: update.product_id, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Price update complete: ${successCount}/${updates.length} successful`);

    return new Response(
      JSON.stringify({ success: true, results, succeeded: successCount, failed: updates.length - successCount }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating prices:', error);
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
