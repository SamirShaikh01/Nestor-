import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This is the app's first server-side code (see docs/v2-feasibility.md §1 /
// docs/decisions.md ADR-025) — a thin proxy to the Gemini API. The API key
// only ever lives here, in a server environment variable; it never reaches
// the browser. No draft text or reframed output is persisted anywhere —
// this route is stateless request in, response out, nothing written to
// Supabase (per explicit product decision — see ADR-025).

const MAX_DRAFT_LENGTH = 6000; // generous for an email; caps token/cost exposure per request

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: "clear, professional, and courteous",
  formal: "formal and precise",
  concise: "as concise as possible while keeping all key information",
  friendly: "warm and friendly, but still professional",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email Reframer is not configured on the server yet." }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  // Require a real, currently-valid Supabase session — this route costs real
  // money per call, so it must not be reachable by anyone off the internet
  // who isn't a signed-in Nestor user.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Your session has expired — please sign in again." }, { status: 401 });
  }

  let body: { draft?: string; tone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const draft = (body.draft || "").trim();
  if (!draft) {
    return NextResponse.json({ error: "Nothing to reframe — paste your draft first." }, { status: 400 });
  }
  if (draft.length > MAX_DRAFT_LENGTH) {
    return NextResponse.json({ error: `That draft is too long (max ${MAX_DRAFT_LENGTH} characters).` }, { status: 400 });
  }

  const toneDescription = TONE_INSTRUCTIONS[body.tone || "professional"] || TONE_INSTRUCTIONS.professional;

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: draft }] }],
          systemInstruction: {
            parts: [
              {
                text:
                  `You rewrite work emails. Rewrite the user's email to be ${toneDescription}. ` +
                  "Preserve every fact, request, and piece of information in the original — never invent " +
                  "new claims, names, dates, or commitments. Keep roughly the same length unless asked to " +
                  "be more concise. Return ONLY the rewritten email text, with no preamble, no explanation, " +
                  "and no markdown formatting or quotation marks around it.",
              },
            ],
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (geminiRes.status === 429) {
      return NextResponse.json(
        { error: "The AI service is busy right now (rate limit) — please try again in a minute." },
        { status: 429 }
      );
    }
    if (!geminiRes.ok) {
      console.error("Gemini API error:", geminiRes.status, await geminiRes.text());
      return NextResponse.json({ error: "Couldn't reach the AI service. Please try again shortly." }, { status: 502 });
    }

    const data = await geminiRes.json();
    const reframed: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reframed) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        return NextResponse.json({ error: "That draft couldn't be processed by the AI's safety filters." }, { status: 422 });
      }
      return NextResponse.json({ error: "The AI didn't return a result — please try again." }, { status: 502 });
    }

    return NextResponse.json({ reframed: reframed.trim() });
  } catch (err) {
    console.error("Error calling Gemini API:", err);
    return NextResponse.json({ error: "Unexpected error reaching the AI service." }, { status: 500 });
  }
}
