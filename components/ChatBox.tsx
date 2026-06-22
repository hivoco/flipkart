"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/conversation";

// How many messages stay on screen, YouTube-live-chat style.
const VISIBLE = 5;

// Small typewriter so each "bleat" types itself out like the goat is talking.
function Typewriter({ text, speed = 38 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="animate-pulse">▍</span>}
    </>
  );
}

export function ChatBox({
  messages,
  visible,
}: {
  messages: ChatMessage[];
  visible: boolean;
}) {
  if (!visible) return null;

  const shown = messages.slice(-VISIBLE);

  return (
    // No panel/background — just floating text. Bottom-anchored, grows upward,
    // and the top fades out via the mask as new messages arrive.
    <div className="pointer-events-none fixed bottom-44 right-4 z-30 flex max-h-[48vh] w-[300px] max-w-[80vw] flex-col justify-end gap-2.5 [mask-image:linear-gradient(to_top,#000_72%,transparent)] [-webkit-mask-image:linear-gradient(to_top,#000_72%,transparent)] sm:bottom-28 sm:max-h-[58vh]">
      <AnimatePresence initial={false}>
        {shown.map((m) => {
          const isGoat = m.sender === "goat";
          return (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[13px] leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,0.65)]"
            >
              <span
                className="font-extrabold"
                style={{ color: isGoat ? "#FFE11B" : "#9ec3ff" }}
              >
                {isGoat ? "🐐 Goat" : "🧑 You"}
              </span>{" "}
              <span className="text-[15px] font-bold leading-snug text-white">
                {m.text}
              </span>
              <span className="mt-0.5 block text-[12px] font-normal italic leading-snug text-white/55">
                <Typewriter text={m.gibberish} />
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
