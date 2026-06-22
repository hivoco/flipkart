# Assets

The goat is six 9:16 (720×1280) video clips. Replace any in `public/` (keep the
same names) and they take over automatically.

## Goat videos (required)

| State     | File                       | Notes                                                     |
| --------- | -------------------------- | --------------------------------------------------------- |
| Idle      | `Goat_Idle_Waiting.mp4`    | muted loop                                                |
| Listening | `Goat_Listening.mp4`       | muted loop (while you talk)                               |
| Speaking  | `Goat_Speaking_1..3.mp4`   | one picked at random per turn; plays with its own audio   |
| Laughing  | `Goat_Laughing_1.mp4`      | plays with its own audio                                  |

Speaking/laughing clips play **with their own (synced) audio**; idle/listening
are muted. Speak and laugh are each capped at ~3s in `app/page.tsx`
(`SPEAK_MS` / `LAUGH_MS`). If a video fails to load, an animated CSS goat shows
instead.

## Voucher animation (optional)

`public/voucher.gif` — shown in the 50%-off popup. If absent, an animated emoji
celebration is shown instead.

## Social / meta image

`public/GOAT.png` is the Open Graph / Twitter preview image (see `app/layout.tsx`).
For best link-preview results a landscape 1200×630 version is ideal.
