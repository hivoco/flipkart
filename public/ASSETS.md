# Drop your real assets here

The app works **out of the box** with built-in fallbacks (an animated CSS goat +
synthesised goat bleats + an emoji celebration). To use your own assets, just
drop files with these exact names into `public/` and they take over
automatically — no code change needed.

## 1. The goat animation — `public/goat.riv`

Export your Rive file as `goat.riv`. Inside it, the app expects:

| Thing            | Name              | Type    | When it fires                    |
| ---------------- | ----------------- | ------- | -------------------------------- |
| State Machine    | `State Machine 1` | —       | —                                |
| Input `speak`    | `speak`           | Trigger | each time the goat starts a line |
| Input `listen`   | `listen`          | Boolean | `true` while the user is talking |
| Input `laugh`    | `laugh`           | Trigger | when the goat laughs             |
| Input `voucher`  | `voucher`         | Trigger | at the very end (voucher opens)  |

If your names differ, edit them in [`lib/conversation.ts`](../lib/conversation.ts)
(the `RIVE` constant). If the file is missing or names don't match, the animated
CSS goat is shown instead.

## 2. The 5 goat speaking sounds — `public/audio/goat-speak-1.mp3` … `goat-speak-5.mp3`

One file per conversation round (round 1 → `goat-speak-1.mp3`, etc.).
Missing files are replaced by a synthesised "baa" so there's always sound.

## 3. The laugh sound — `public/audio/goat-laugh.mp3`

Played when the goat laughs at the user's reply.

## 4. The reward animation — `public/voucher.gif`

Shown inside the 50%-off popup at the end. If absent, an animated emoji
celebration is shown instead.
