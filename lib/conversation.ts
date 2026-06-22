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

/** The 3 conversation rounds. After the 3rd user turn the goat delivers its
 *  FINALE roast, then the discount voucher opens. */
export const ROUNDS: Round[] = [
  {
    goatGibberish: "Meeeh blaaa meh blauuu.",
    goatText:
      "They say money can't buy happiness. Which is why you're here looking for discounts.",
    userGibberish: "Blaaa mih baa meeh.",
    userText:
      "I have 3 items in my cart. I've been \"researching\" them for 5 weeks.",
  },
  {
    goatGibberish: "Blauuu baa meeh.",
    goatText: "That's not research. That's a long-distance relationship.",
    userGibberish: "Meeeh blau mih baa.",
    userText: "I compare prices across 7 apps. Then buy from Flipkart anyway.",
  },
  {
    goatGibberish: "Baa meeh blauuu.",
    goatText: "A beautiful waste of effort. I respect consistency.",
    userGibberish: "Mih blaaaa meeh baa blauuu.",
    userText:
      "I bought a treadmill in 2024. It's currently holding 11 T-shirts, 2 towels, and one life decision I regret.",
  },
];

/**
 * The goat's closing roast. Delivered as a big laugh + final line right after
 * the 3rd user turn, just before the discount voucher opens.
 */
export const FINALE = {
  goatGibberish: "MEEEEEH BAAA BLAAUUU.",
  goatText:
    "Congratulations. You paid ₹29,999 for the world's most expensive clothes rack.",
};

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
