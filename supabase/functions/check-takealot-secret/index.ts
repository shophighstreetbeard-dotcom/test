import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

serve(async (_req) => {
  try {
    const exists = Deno.env.get("TAKEALOT_API_KEY") ? true : false;
    const body = { ok: exists, message: exists ? "TAKEALOT_API_KEY found" : "TAKEALOT_API_KEY not set" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("error checking secret", err);
    return new Response(JSON.stringify({ ok: false, error: "runtime error" }), { status: 500 });
  }
});
