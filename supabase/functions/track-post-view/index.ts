import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { post_id, user_id } = await req.json();
    if (!post_id) {
      return Response.json({ error: "post_id required" }, { status: 400 });
    }

    // Use the auto-injected env vars
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error: eventError } = await supabaseAdmin
      .from("analytics_events")
      .insert({
        post_id,
        user_id: user_id ?? null,
        event_type: "view",
      });

    if (eventError) {
      console.error("Insert error:", eventError);
      return Response.json({ error: eventError.message }, { status: 500 });
    }

    await supabaseAdmin.rpc("increment_post_views", { post_id });

    return Response.json({ success: true }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});