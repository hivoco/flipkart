# 🐐 Judgy Goat — "Out-bleat me for 50% off"

An interactive Next.js experience: a goat greets visitors, you have a 5-round
chat (goat speaks gibberish "baa baa", a translated subtitle shows what it
means), you tap a mic to "bleat back", the goat **listens → laughs → speaks
again**, a progress bar fills, and after the 5th round a **50% discount popup**
opens.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Framer Motion** (animations)
- **Rive** (`@rive-app/react-canvas`) for the goat — with a full animated CSS
  fallback so it runs with zero assets.
- **Groq Whisper** (`whisper-large-v3-turbo`) for real speech-to-text + a
  **LangChain + Groq** LLM classifier that checks whether you actually spoke
  "goat". Speak a real human language and the goat refuses to continue.

## Run it

```bash
cp .env.example .env.local       # then paste your Groq key into GROQ_API_KEY
npm run dev                      # http://localhost:3000
npm run build                    # production build
```

Click **Start the chat** (this also unlocks audio per browser autoplay rules).
When it's your turn, **tap the mic, bleat like a goat, tap again to send**. Your
voice goes to `POST /api/transcribe` → Whisper transcribes it → the LLM decides
goat vs. human. If you speak a real language, the goat says *"I'm not getting
you — speak goat"* and you retry the same round.

> **No key?** The app still works end-to-end — without `GROQ_API_KEY` the mic
> simply accepts every reply (the speech check is skipped). Mic permission
> denied also falls back to auto-accept.

## How it works

| File                          | Role                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `lib/conversation.ts`         | The 5-round script, coupon, and Rive input names. **Edit here.**  |
| `lib/useGoatAudio.ts`         | Plays the 5 speak files + laugh; synthesises bleats if files miss |
| `components/GoatStage.tsx`    | Rive goat + automatic CSS fallback                                |
| `components/GoatFallback.tsx` | Animated emoji goat (speak / listen / laugh / voucher states)     |
| `components/ChatBox.tsx`      | Transparent 300px bottom-right chat with typewriter bleats        |
| `components/ProgressBar.tsx`  | Top progress bar (fills across the 5 rounds)                      |
| `components/MicButton.tsx`    | Mic trigger + recording equalizer                                 |
| `components/DiscountPopup.tsx`| Final 50%-off popup (gif + confetti fallback)                     |
| `app/page.tsx`                | Orchestrates the whole flow                                       |

## Add your own assets

Everything runs on built-in fallbacks. To use real art/sound, drop files into
`public/` — see [`public/ASSETS.md`](public/ASSETS.md) for the exact names
(`goat.riv`, `audio/goat-speak-1..5.mp3`, `audio/goat-laugh.mp3`, `voucher.gif`).
# flipkart
