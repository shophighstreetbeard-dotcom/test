import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface LeadtimeStock {
  merchant_warehouse: { warehouse_id: number; name: string | null };
  quantity_available: number;
}

interface TakealotProduct {
  offer_id: number;
  sku: string;
  title: string;
  selling_price: number;
  leadtime_stock?: LeadtimeStock[];
  warehouse_stock?: number;
  image_url?: string;
  buy_box_winner?: boolean;
  cost_price?: number;
  rrp?: number;
  status?: string;
}

// Helper to calculate total stock from leadtime_stock array
function calculateStock(leadtimeStock: LeadtimeStock[] | undefined): number {
  if (!leadtimeStock || !Array.isArray(leadtimeStock)) return 0;
  return leadtimeStock.reduce((total, item) => total + (item.quantity_available || 0), 0);
}

// Helper: fetch with retries and exponential backoff for transient errors
async function fetchWithRetries(input: RequestInfo, init?: RequestInit, retries = 3, backoffMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok) return res;
      // Retry on transient server errors or rate limiting
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        const wait = backoffMs * Math.pow(2, attempt);
        console.warn(`Transient error ${res.status} from ${input}; retrying in ${wait}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        const wait = backoffMs * Math.pow(2, attempt);
        console.warn(`Network error when fetching ${input}: ${err}. Retrying in ${wait}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Exceeded fetch retries');
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
    // Accept either the legacy SUPABASE_SERVICE_ROLE_KEY or the non-prefixed SERVICE_ROLE_KEY
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) throw new Error('Service role key not configured (SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY)');
    const takealotApiKey = Deno.env.get('TAKEALOT_API_KEY');

    if (!takealotApiKey) {
      throw new Error('TAKEALOT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user from the request body or use service context
    let userId: string;
    try {
      const body = await req.json();
      userId = body.user_id;
    } catch {
      // No body or invalid JSON - this is fine for GET-like operations
      userId = '';
    }

    if (!userId) {
      throw new Error('user_id is required in request body');
    }

    console.log(`Syncing products for user: ${userId}`);

    // Fetch the first page of products to avoid function timeout
    console.log('Fetching first page of products from Takealot (page_size=100)');
    const takealotResponse = await fetchWithRetries(`https://seller-api.takealot.com/v2/offers?page_number=1&page_size=100`, {
        headers: {
          'Authorization': `Key ${takealotApiKey}`,
          'Content-Type': 'application/json',
        },
      }, 3, 700);

    console.log(`Takealot API page 1 response status: ${takealotResponse.status}`);

    if (!takealotResponse.ok) {
      const errorText = await takealotResponse.text();
      console.error('Takealot API error response:', errorText);
      throw new Error(`Takealot API error: ${takealotResponse.status} - ${errorText.substring(0, 200)}`);
    }

    const takealotData = await takealotResponse.json();
    const allProducts: TakealotProduct[] = takealotData.offers || [];

    console.log(`Fetched ${allProducts.length} products from Takealot`);

    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const takealotProduct of allProducts) {
      // Calculate stock from leadtime_stock array
      const stock = calculateStock(takealotProduct.leadtime_stock);
      const offerId = String(takealotProduct.offer_id);
      
      // Check if product exists
      const { data: existingProducts, error: queryError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .or(`sku.eq.${takealotProduct.sku},takealot_offer_id.eq.${offerId}`);

      if (queryError) {
        console.error('Error querying products:', queryError);
        continue;
      }

      const now = new Date().toISOString();

      if (existingProducts && existingProducts.length > 0) {
        const existing = existingProducts[0];
        
        // Log price change if price changed
        if (existing.current_price !== takealotProduct.selling_price) {
          await supabase.from('price_history').insert({
            product_id: existing.id,
            old_price: existing.current_price,
            new_price: takealotProduct.selling_price,
            reason: 'Takealot sync',
          });
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({
            title: takealotProduct.title,
            current_price: takealotProduct.selling_price,
            stock_quantity: stock,
            takealot_offer_id: offerId,
            last_synced_at: now,
            image_url: takealotProduct.image_url || existing.image_url,
            buy_box_status: takealotProduct.buy_box_winner ? 'won' : (takealotProduct.status === 'Buyable' ? 'unknown' : 'lost'),
          })
          .eq('id', existing.id);
        
        if (updateError) {
          console.error('Error updating product:', updateError);
        } else {
          updatedCount++;
        }
      } else {
        const { error: insertError } = await supabase.from('products').insert({
          user_id: userId,
          sku: takealotProduct.sku,
          title: takealotProduct.title,
          current_price: takealotProduct.selling_price,
          stock_quantity: stock,
          takealot_offer_id: offerId,
          last_synced_at: now,
          image_url: takealotProduct.image_url,
          buy_box_status: takealotProduct.buy_box_winner ? 'won' : 'unknown',
          is_active: takealotProduct.status === 'Buyable',
        });
        
        if (insertError) {
          console.error('Error inserting product:', insertError);
        } else {
          createdCount++;
        }
      }
      
      syncedCount++;
    }

    console.log(`Sync complete: ${createdCount} created, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        created: createdCount,
        updated: updatedCount,
        total_available: allProducts.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing products:', error);
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
