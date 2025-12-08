import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-takealot-signature, x-api-key',
};

interface WebhookPayload {
  event_type: string;
  offer_id?: string;
  sku?: string;
  price?: number;
  stock?: number;
  buy_box_winner?: boolean;
  buy_box_status?: string;
  timestamp?: string;
  user_id?: string;
}

// Rate limiting - simple in-memory store (resets on function restart)
const requestCounts: Record<string, { count: number; resetTime: number }> = {};
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts[ip];
  
  if (!record || now > record.resetTime) {
    requestCounts[ip] = { count: 1, resetTime: now + RATE_WINDOW };
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

async function verifySignature(body: string, signature: string | null, secret: string | null): Promise<boolean> {
  if (!secret || !signature) {
    console.log('No signature verification configured');
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === computedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  
  // Apply rate limiting
  if (!checkRateLimit(clientIp)) {
    console.warn(`Rate limit exceeded for IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // The Supabase CLI refuses to set env names that start with "SUPABASE_". Accept both
    // the legacy `SUPABASE_SERVICE_ROLE_KEY` and the non-prefixed `SERVICE_ROLE_KEY`.
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) throw new Error('Service role key not configured (SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY)');
    const webhookSecret = Deno.env.get('TAKEALOT_WEBHOOK_SECRET');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get('x-takealot-signature');

    console.log('Received webhook from IP:', clientIp);
    console.log('Webhook body preview:', body.substring(0, 200));

    // Verify signature if secret is configured (required for production)
    if (webhookSecret) {
      const isValid = await verifySignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.warn('TAKEALOT_WEBHOOK_SECRET not configured - signature verification skipped');
    }

    const payload: WebhookPayload = JSON.parse(body);
    console.log('Parsed webhook payload:', JSON.stringify(payload));

    // Validate required fields
    if (!payload.event_type) {
      return new Response(
        JSON.stringify({ error: 'event_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // user_id is required for proper data isolation
    if (!payload.user_id) {
      console.error('Webhook missing user_id');
      return new Response(
        JSON.stringify({ error: 'user_id is required in webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the webhook event
    const { error: insertError } = await supabase.from('webhook_events').insert({
      user_id: payload.user_id,
      event_type: payload.event_type || 'unknown',
      payload: payload,
      processed: false,
    });

    if (insertError) {
      console.error('Error storing webhook event:', insertError);
    }

    // Find the product
    let product = null;
    if (payload.offer_id) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('takealot_offer_id', payload.offer_id)
        .eq('user_id', payload.user_id)
        .single();
      product = data;
    } else if (payload.sku) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('sku', payload.sku)
        .eq('user_id', payload.user_id)
        .single();
      product = data;
    }

    if (!product) {
      console.log('Product not found for webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Product not found, event logged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Special handling: leadtime order item notifications
    // If the webhook contains an order_item_id or an offer object, treat it as a leadtime order
    if ((payload as any).order_item_id || (payload as any).offer) {
      try {
        const orderQty = (payload as any).quantity || 1;
        // If offer object provided, prefer its offer_id/sku
        const offerObj = (payload as any).offer;
        if (offerObj && !product) {
          // try find by offer object
          if (offerObj.offer_id) {
            const { data } = await supabase
              .from('products')
              .select('*')
              .eq('takealot_offer_id', String(offerObj.offer_id))
              .eq('user_id', payload.user_id)
              .single();
            product = data;
          }
          if (!product && offerObj.sku) {
            const { data } = await supabase
              .from('products')
              .select('*')
              .eq('sku', offerObj.sku)
              .eq('user_id', payload.user_id)
              .single();
            product = data;
          }
        }

        if (product) {
          // Persist leadtime order for audit
          const { error: insertLeadtimeErr } = await supabase.from('leadtime_orders').insert({
            user_id: payload.user_id,
            order_id: (payload as any).order_id,
            order_item_id: (payload as any).order_item_id,
            offer_id: offerObj?.offer_id ? String(offerObj.offer_id) : payload.offer_id ? String(payload.offer_id) : null,
            sku: offerObj?.sku || payload.sku || product.sku,
            quantity: Number(orderQty),
            warehouse: (payload as any).warehouse || null,
            facility: (payload as any).facility || null,
            payload: payload,
            created_at: new Date().toISOString(),
          });
          if (insertLeadtimeErr) console.error('Failed to insert leadtime_order:', insertLeadtimeErr);

          // Decrement per-warehouse leadtime stock if present in leadtime_stock_details
          const details = product.leadtime_stock_details || {};
          const warehouseKey = (payload as any).warehouse || (offerObj && offerObj.leadtime_stock && offerObj.leadtime_stock[0] && offerObj.leadtime_stock[0].merchant_warehouse && offerObj.leadtime_stock[0].merchant_warehouse.name) || null;
          let newStock = Number(product.stock_quantity || 0) - Number(orderQty);
          if (warehouseKey && details && typeof details === 'object') {
            const prevQty = Number((details as any)[warehouseKey] || 0);
            const updatedQty = Math.max(0, prevQty - Number(orderQty));
            (details as any)[warehouseKey] = updatedQty;
            // update aggregate
            const aggregate = Object.values(details).reduce((s: number, v: any) => s + Number(v || 0), 0);
            newStock = aggregate;
            await supabase.from('products').update({ leadtime_stock_details: details, stock_quantity: aggregate, last_synced_at: new Date().toISOString() }).eq('id', product.id);
          } else {
            newStock = Math.max(0, Number(product.stock_quantity || 0) - Number(orderQty));
            await supabase.from('products').update({ stock_quantity: newStock, last_synced_at: new Date().toISOString() }).eq('id', product.id);
          }

          console.log(`Leadtime order processed for ${product.sku}: -${orderQty}, new stock ${newStock}`);
          // mark webhook event processed
          await supabase
            .from('webhook_events')
            .update({ processed: true })
            .eq('payload->order_item_id', (payload as any).order_item_id)
            .eq('user_id', payload.user_id);

          return new Response(
            JSON.stringify({ success: true, message: 'Leadtime order applied', sku: product.sku, new_stock: newStock }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('Leadtime order received but product not found; event logged');
          return new Response(
            JSON.stringify({ success: true, message: 'Product not found, leadtime order logged' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        console.error('Error processing leadtime order webhook:', err);
        return new Response(JSON.stringify({ error: 'Failed to process leadtime order' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Special handling: sale / sale status changed notifications
    if ((payload as any).sale) {
      try {
        const sale = (payload as any).sale;
        const orderQty = Number(sale.quantity || 1);

        // Try to find product by offer_id or sku
        let saleProduct = product;
        if (!saleProduct) {
          if (sale.offer_id) {
            const { data } = await supabase
              .from('products')
              .select('*')
              .eq('takealot_offer_id', String(sale.offer_id))
              .eq('user_id', payload.user_id)
              .single();
            saleProduct = data;
          }
          if (!saleProduct && sale.sku) {
            const { data } = await supabase
              .from('products')
              .select('*')
              .eq('sku', sale.sku)
              .eq('user_id', payload.user_id)
              .single();
            saleProduct = data;
          }
        }

        // Persist sale record and update stock
        if (saleProduct) {
          const soldAt = sale.order_date || (payload as any).event_timestamp_utc || new Date().toISOString();
          const salePrice = Number(sale.selling_price || 0);

          // Insert into sales table
          const { error: salesError } = await supabase.from('sales').insert({
            user_id: payload.user_id,
            product_id: saleProduct.id,
            order_id: String(sale.order_id || ''),
            quantity: orderQty,
            sale_price: salePrice,
            sold_at: soldAt,
            created_at: new Date().toISOString(),
          });
          if (salesError) console.error('Failed to insert sale record:', salesError);

          // Decrement stock_quantity (aggregate) -- keep >=0
          const currentStock = Number(saleProduct.stock_quantity || 0);
          const newStock = Math.max(0, currentStock - orderQty);
          await supabase.from('products').update({ stock_quantity: newStock, last_synced_at: new Date().toISOString() }).eq('id', saleProduct.id);

          console.log(`Processed sale for ${saleProduct.sku}: qty ${orderQty}, new stock ${newStock}`);

          // Mark webhook event processed
          await supabase
            .from('webhook_events')
            .update({ processed: true })
            .eq('payload->sale->order_item_id', sale.order_item_id)
            .eq('user_id', payload.user_id);

          return new Response(JSON.stringify({ success: true, message: 'Sale processed', sku: saleProduct.sku, new_stock: newStock }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          console.log('Sale webhook received but product not found; event logged');
          return new Response(JSON.stringify({ success: true, message: 'Product not found, sale logged' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (err) {
        console.error('Error processing sale webhook:', err);
        return new Response(JSON.stringify({ error: 'Failed to process sale' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Special handling: offer created/updated notifications
    if (payload.event_type && (payload.event_type === 'offer.created' || payload.event_type === 'offer.updated' || payload.event_type === 'offer.update')) {
      try {
        // If Takealot sends 'values_changed' or an offer object, attempt to upsert product
        const offerObj = (payload as any).offer || {};
        const offerId = payload.offer_id || offerObj.offer_id || (payload as any).offerId;
        const sku = payload.sku || offerObj.sku || (payload as any).merchant_sku;
        const sellingPrice = (payload as any).price || offerObj.selling_price || (payload as any).selling_price;
        const imageUrl = (payload as any).image_url || offerObj.image_url || null;

        if (!sku && !offerId) {
          console.log('Offer webhook missing identifiers; skipping product upsert');
        } else {
          // Upsert product by sku if present, otherwise by offer id
          const existingQuery = sku
            ? supabase.from('products').select('*').eq('sku', sku).eq('user_id', payload.user_id).maybeSingle()
            : supabase.from('products').select('*').eq('takealot_offer_id', String(offerId)).eq('user_id', payload.user_id).maybeSingle();
          const { data: existing } = await existingQuery;

          const upsertData: any = {
            sku: sku || existing?.sku || null,
            takealot_offer_id: offerId ? String(offerId) : existing?.takealot_offer_id || null,
            title: (payload as any).title || offerObj.title || existing?.title || '',
            current_price: sellingPrice !== undefined ? Number(sellingPrice) : existing?.current_price || 0,
            image_url: imageUrl || existing?.image_url || null,
            last_synced_at: new Date().toISOString(),
            user_id: payload.user_id,
          };

          if (existing) {
            await supabase.from('products').update(upsertData).eq('id', existing.id);
            console.log(`Updated product from offer webhook: ${existing.sku || upsertData.sku}`);
          } else {
            await supabase.from('products').insert(upsertData);
            console.log(`Inserted new product from offer webhook: ${upsertData.sku}`);
          }
        }
      } catch (err) {
        console.error('Error processing offer webhook:', err);
      }
      return new Response(JSON.stringify({ success: true, message: 'Offer webhook handled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update product based on webhook data
    const updates: Record<string, any> = {
      last_synced_at: new Date().toISOString(),
    };

    if (payload.price !== undefined && payload.price !== product.current_price) {
      await supabase.from('price_history').insert({
        product_id: product.id,
        old_price: product.current_price,
        new_price: payload.price,
        reason: 'Takealot webhook update',
      });
      updates.current_price = payload.price;
    }

    if (payload.stock !== undefined) {
      updates.stock_quantity = payload.stock;
    }

    if (payload.buy_box_winner !== undefined) {
      updates.buy_box_status = payload.buy_box_winner ? 'won' : 'lost';
    } else if (payload.buy_box_status !== undefined) {
      updates.buy_box_status = payload.buy_box_status;
    }

    if (Object.keys(updates).length > 1) {
      await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id);
      
      console.log(`Updated product ${product.sku}:`, updates);
    }

    // Mark webhook as processed
    if (payload.offer_id) {
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('payload->offer_id', payload.offer_id)
        .eq('user_id', payload.user_id);
    }

    return new Response(
      JSON.stringify({ success: true, updated: product.sku }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
