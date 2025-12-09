import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

serve(async (_req) => {
  try {
    const key = Deno.env.get("TAKEALOT_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ ok: false, error: "TAKEALOT_API_KEY not set" }), { status: 500 });
    }

    const TAKEALOT_HEALTH_URL = "https://api.takealot.com/seller/v1/offers";

    const res = await fetch(TAKEALOT_HEALTH_URL, {
      method: "GET",
      headers: {
        "Authorization": `Key ${key}`,
        "Accept": "application/json",
      },
    });

    const status = res.status;
    const text = await res.text();

    return new Response(
      JSON.stringify({ ok: status >= 200 && status < 300, status, bodyPreview: text.slice(0, 500) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("takealot health-check error", err);
    return new Response(JSON.stringify({ ok: false, error: "request failed" }), { status: 500 });
  }
});
