const http = require('http');
const url = require('url');

const PORT = 54321;

// In-memory mock data
const products = [
  {
    id: 'prod-1',
    user_id: 'test-user',
    sku: 'SKU123',
    title: 'Mock Product',
    current_price: 100,
    cost_price: 50,
    min_price: 70,
    max_price: 150,
    buy_box_status: 'won',
    competitor_count: 2,
    stock_quantity: 20,
    takealot_offer_id: '123',
    image_url: null,
    is_active: true,
  },
];

const repricing_rules = [
  {
    id: 'rule-1',
    user_id: 'test-user',
    name: 'Beat lowest by 0.50',
    rule_type: 'beat_lowest',
    price_adjustment: 0.5,
    adjustment_type: 'absolute',
    min_margin: 5,
    priority: 1,
    is_active: true,
  },
];

const competitors = [
  { product_id: 'prod-1', competitor_price: 95, has_buy_box: false, user_id: 'test-user' },
];

const webhookEvents = [];
const priceHistory = [];

function parseEqFilters(query) {
  const filters = {};
  for (const key of Object.keys(query)) {
    const val = query[key];
    // handle eq.<value>
    if (Array.isArray(val)) continue;
    const m = val.match(/^eq\.(.*)$/);
    if (m) filters[key] = m[1];
  }
  return filters;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  if (pathname.startsWith('/rest/v1/products')) {
    if (method === 'GET') {
      const filters = parseEqFilters(parsed.query);
      // If querying by takealot_offer_id or sku + user_id, return single object
      const byOffer = filters.takealot_offer_id;
      const bySku = filters.sku;
      const byUser = filters.user_id;

      if ((byOffer || bySku) && byUser) {
        const product = products.find(p => (byOffer ? p.takealot_offer_id === byOffer : p.sku === bySku) && p.user_id === byUser);
        if (!product) return sendJson(res, 200, []);
        return sendJson(res, 200, product);
      }

      // Generic filter for user_id and is_active
      let results = products.slice();
      if (filters.user_id) results = results.filter(p => p.user_id === filters.user_id);
      if (filters.is_active) {
        results = results.filter(p => String(p.is_active) === filters.is_active || (filters.is_active === 'true' && p.is_active));
      }
      return sendJson(res, 200, results);
    }

    if (method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let data;
      try { data = JSON.parse(body); } catch { data = {}; }
      const id = 'prod-' + (products.length + 1);
      const newProd = { id, ...data };
      products.push(newProd);
      return sendJson(res, 201, newProd);
    }

    if (method === 'PATCH') {
      // naive patch handling - read body and update first matched id query
      const filters = parseEqFilters(parsed.query);
      let body = '';
      for await (const chunk of req) body += chunk;
      let data;
      try { data = JSON.parse(body); } catch { data = {}; }
      const idFilter = filters.id;
      let updated = 0;
      if (idFilter) {
        const prod = products.find(p => p.id === idFilter);
        if (prod) {
          Object.assign(prod, data);
          updated = 1;
        }
      } else if (filters.sku) {
        const prod = products.find(p => p.sku === filters.sku && prod.user_id === filters.user_id);
        if (prod) { Object.assign(prod, data); updated = 1; }
      }
      return sendJson(res, 200, { updated });
    }
  }

  if (pathname.startsWith('/rest/v1/repricing_rules')) {
    if (method === 'GET') {
      const filters = parseEqFilters(parsed.query);
      let results = repricing_rules.slice();
      if (filters.user_id) results = results.filter(r => r.user_id === filters.user_id);
      if (filters.is_active) results = results.filter(r => String(r.is_active) === filters.is_active || (filters.is_active === 'true' && r.is_active));
      return sendJson(res, 200, results);
    }
  }

  if (pathname.startsWith('/rest/v1/competitors')) {
    if (method === 'GET') {
      const filters = parseEqFilters(parsed.query);
      let results = competitors.slice();
      if (filters.user_id) results = results.filter(r => r.user_id === filters.user_id);
      return sendJson(res, 200, results);
    }
  }

  if (pathname.startsWith('/rest/v1/price_history')) {
    if (method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let data;
      try { data = JSON.parse(body); } catch { data = {}; }
      // Accept single object or array
      const entries = Array.isArray(data) ? data : [data];
      for (const e of entries) {
        priceHistory.push(e);
      }
      return sendJson(res, 201, { inserted: entries.length });
    }
  }

  if (pathname.startsWith('/rest/v1/webhook_events')) {
    if (method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let data;
      try { data = JSON.parse(body); } catch { data = {}; }
      webhookEvents.push(data);
      return sendJson(res, 201, data);
    }

    if (method === 'PATCH') {
      // mark processed; ignore
      return sendJson(res, 200, { updated: 1 });
    }
  }

  // Default response
  sendJson(res, 404, { error: 'Not implemented in mock server', path: pathname, method });
});

server.listen(PORT, () => {
  console.log(`Mock Supabase server listening on http://localhost:${PORT}`);
});
