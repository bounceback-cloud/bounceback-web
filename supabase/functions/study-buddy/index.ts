// Deno runtime (Edge Function)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS helper
function cors(headers: Headers = new Headers()) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return headers;
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors() });
  }

  try {
    const { userId, question } = await req.json();

    if (!userId || !question) {
      return new Response(JSON.stringify({ error: "Missing userId or question" }), {
        status: 400,
        headers: cors(new Headers({ "Content-Type": "application/json" })),
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("PROJECT_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server is missing required secrets" }), {
        status: 500,
        headers: cors(new Headers({ "Content-Type": "application/json" })),
      });
    }

    // Call OpenAI (chat completions)
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }],
        temperature: 0.2,
      }),
    });

    const aiJson = await aiRes.json();
    const answer = aiJson?.choices?.[0]?.message?.content ?? "Sorry, I couldn’t generate an answer.";

    // Insert into DB with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from("study_buddy").insert({
      user_id: userId,
      question,
      answer,
    });

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: cors(new Headers({ "Content-Type": "application/json" })),
    });
  } catch (err) {
    // Surface some error context in logs
    console.error("study-buddy error:", err);
    return new Response(JSON.stringify({ error: "Function error" }), {
      status: 500,
      headers: cors(new Headers({ "Content-Type": "application/json" })),
    });
  }
});
