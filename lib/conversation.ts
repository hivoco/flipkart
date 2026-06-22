// ---------------------------------------------------------------------------
// The whole experience is scripted here. Edit these 5 rounds to change what the
// goat and the user "say". Each round = 1 goat line + 1 user reply.
// ---------------------------------------------------------------------------

export type Sender = "goat" | "user";

/** Visual state the goat is in. Drives both the .riv file and the CSS fallback. */
export type GoatState = "idle" | "speak" | "listen" | "laugh" | "voucher";

/** High level flow phase used by the page orchestrator. */
export type Phase =
  | "idle" // nothing started yet
  | "goatSpeaking" // goat is bleating its line
  | "awaitMic" // waiting for the user to tap the mic
  | "userRecording" // user is "talking" into the mic, goat is listening
  | "transcribing" // sending audio to Whisper + classifying
  | "goatLaughing" // goat laughs at the reply
  | "finished"; // all rounds done, voucher time

export interface ChatMessage {
  id: string;
  sender: Sender;
  gibberish: string; // what is actually "said" (goat language)
  text: string; // the translated, human-readable subtitle
}

export interface Round {
  goatGibberish: string;
  goatText: string;
  userGibberish: string;
  userText: string;
}

/** The 5 conversation rounds. After the 5th, the discount voucher opens. */
export const ROUNDS: Round[] = [
  {
    goatGibberish: "Meeehhh baa baa mehhh... Baaa meh meh baa... Meeeeh baa baa.",
    goatText: "Tell me your cart total. I promise I'll judge quietly.",
    userGibberish: "Meh baa... Baaa baa baa...",
    userText: "My cart total is now bigger than my monthly electricity bill.",
  },
  {
    goatGibberish: "Baaa?! Meh meh baaaaa... meeeh.",
    goatText: "Bold. Did you at least add the matching socks to soften the damage?",
    userGibberish: "Meh baa baa... meeeh baa.",
    userText: "I added three pairs. And a lamp I will absolutely never switch on.",
  },
  {
    goatGibberish: "Meeeeh baa baa, meh meh baaa.",
    goatText: "A lamp you'll never use is the most honest purchase a human can make.",
    userGibberish: "Baa baa meh... meeeeh baa baa.",
    userText: "There's also a 2 AM phone case shaped like a samosa. Don't ask.",
  },
  {
    goatGibberish: "Meh baa baa baa... MEEEH.",
    goatText: "Four cases for a phone you've never once dropped. Iconic behaviour.",
    userGibberish: "Baaa baa meh meh... baa.",
    userText: "Future me will thank present me. Present me is having a great time.",
  },
  {
    goatGibberish: "Meeeehhh baa baa baa baa!",
    goatText: "Okay fine — you shopped with your whole heart. The goat is impressed.",
    userGibberish: "Meh baaa meh meh!",
    userText: "And roughly my whole wallet. Worth it.",
  },
];

/**
 * Shown when the user speaks a real human language instead of goat. The goat
 * refuses to continue and asks them to bleat properly. Rotated on each retry.
 */
export const NOT_GOAT_REPLIES: { gibberish: string; text: string }[] = [
  {
    gibberish: "Meeeh? Baa... baa? Mehhh.",
    text: "Hmm, I'm not getting you. I only speak goat — try bleating, please.",
  },
  {
    gibberish: "Baaa... meh meh? Meeeeh.",
    text: "That's definitely not goat. Less words, more 'baaa'. Try again.",
  },
  {
    gibberish: "Meh. Baa baa. Meeeh?",
    text: "Still human, I'm afraid. Channel your inner goat and bleat at me.",
  },
];

export const COUPON = { code: "GOAT50", percent: 50 };
