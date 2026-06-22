import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { ChatGroq } from "@langchain/groq";

// Runs server-side so the GROQ_API_KEY never reaches the browser.
export const runtime = "nodejs";

const WHISPER_MODEL = "whisper-large-v3-turbo";
const CLASSIFIER_MODEL = "llama-3.1-8b-instant";

/** Quick, free heuristic. Returns true=goat, null=unsure (ask the LLM). */
function looksLikeGoat(transcript: string): boolean | null {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return true; // silence / non-speech → harmless
  const t = trimmed.toLowerCase();
  const letters = t.replace(/[^a-z]/g, "");
  // Strong positive: obvious Latin bleats made of b/a/e/m/h.
  if (letters.length > 0 && /\b(b?a{2,}h?|m?e{2,}h?|ma{2,}|bleat|mbaa+|baah+)\b/.test(t)) {
    const goatChars = (letters.match(/[baemh]/g) || []).length;
    if (goatChars / letters.length > 0.7) return true;
  }
  // Everything else — real words, or bleats transliterated into another
  // script (Whisper loves doing that) — goes to the LLM to decide.
  return null;
}

/** LangChain + Groq LLM decides goat vs. real human language. */
async function classifyWithLLM(transcript: string, apiKey: string): Promise<boolean> {
  const model = new ChatGroq({
    apiKey,
    model: CLASSIFIER_MODEL,
    temperature: 0,
    maxTokens: 4,
  });
  const res = await model.invoke([
    [
      "system",
      "You are a strict classifier. The user message is a speech-to-text transcript. " +
        "Answer GOAT if it is ONLY goat/animal bleating sounds — including bleats that " +
        "a transcriber transliterated into another language or script (e.g. 'baa', " +
        "'baah', 'baba', 'meh', 'maa', 'mbaa', 'मे', 'بع', 'بابا') or just repeated " +
        "short meaningless syllables with no coherent meaning. " +
        "Answer HUMAN if it is a coherent word, phrase, or sentence that carries real " +
        "meaning in ANY human language. Reply with exactly one word: GOAT or HUMAN.",
    ],
    ["human", transcript],
  ]);
  const content = Array.isArray(res.content)
    ? res.content
        .map((c) => (typeof c === "string" ? c : "text" in c ? c.text : ""))
        .join(" ")
    : String(res.content);
  return content.trim().toUpperCase().startsWith("GOAT");
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  // No key configured → degrade gracefully: accept whatever was said so the
  // experience keeps working out of the box.
  if (!apiKey) {
    return NextResponse.json({ ok: true, mode: "no-key", isGoat: true, transcript: "" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }

  try {
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ ok: false, error: "no audio" }, { status: 400 });
    }

    const type = audio.type || "audio/webm";
    const ext = type.includes("mp4")
      ? "mp4"
      : type.includes("ogg")
        ? "ogg"
        : type.includes("wav")
          ? "wav"
          : "webm";
    const file = new File([await audio.arrayBuffer()], `speech.${ext}`, { type });

    // 1) Transcribe with Groq Whisper.
    const groq = new Groq({ apiKey });
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      response_format: "json",
    });
    const transcript = (transcription.text || "").trim();

    // 2) Classify: goat language or real language? (heuristic first, LLM if unsure)
    let isGoat = looksLikeGoat(transcript);
    if (isGoat === null) {
      try {
        isGoat = await classifyWithLLM(transcript, apiKey);
      } catch {
        // LLM failed → be lenient and accept.
        isGoat = true;
      }
    }

    return NextResponse.json({ ok: true, transcript, isGoat });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
