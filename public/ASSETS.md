# Assets

The goat is four 9:16 (720×1280) video clips. Replace any in `public/` (keep the
same names) and they take over automatically.

## Goat videos (required)

| State     | File                       | Notes                            |
| --------- | -------------------------- | -------------------------------- |
| Idle      | `Goat_Idle_Waiting-v2.mp4` | muted loop                       |
| Listening | `Goat_Listening-v2.mp4`    | muted loop (while you talk)      |
| Speaking  | `speaking-v2.mp4`          | plays with its own audio         |
| Laughing  | `laughing-v2.mp4`          | plays with its own audio         |

The `-v2` suffix is a cache-buster from re-compressing the clips. If you swap a
clip, rename it (e.g. `-v3`) and update the matching `*_SRC` in
`components/GoatStage.tsx` so caches/CDNs don't serve the stale file.

Speaking/laughing clips play **with their own (synced) audio**; idle/listening
are muted. Speaking is capped at ~4s and the laugh at ~5s in `app/page.tsx`
(`SPEAK_MS` / `LAUGH_MS`). If a video fails to load, an animated CSS goat shows
instead.

## Voucher animation (optional)

`public/voucher.gif` — shown in the 50%-off popup. If absent, an animated emoji
celebration is shown instead.

## Social / meta image

`public/GOAT.png` is the Open Graph / Twitter preview image (see `app/layout.tsx`).
For best link-preview results a landscape 1200×630 version is ideal.
