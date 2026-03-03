"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

const QUOTES = ["Hire Me!", "Croc Power!"];

export default function Croc() {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState("");

  const handleClick = useCallback(() => {
    if (!open) {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }
    setOpen((o) => !o);
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-10 flex items-end gap-0">
      {/* speech bubble */}
      <div
        className="relative mb-2 transition-all duration-200"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.7)",
          transformOrigin: "bottom right",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="relative w-[160px] h-[85px]">
          <Image
            src="/speech-bubble.png"
            alt=""
            fill
            className="object-contain"
          />
          <span className="absolute inset-0 flex items-center justify-center pr-6 pb-3 font-serif font-bold text-[0.85rem] text-black text-center leading-tight">
            {quote}
          </span>
        </div>
      </div>

      {/* croc */}
      <button
        onClick={handleClick}
        className="relative w-[120px] h-[60px] cursor-pointer bg-transparent border-0 p-0 flex-shrink-0"
      >
        <Image
          src={open ? "/croc-open.png" : "/croc-closed.png"}
          alt="croc"
          fill
          className="object-contain"
        />
      </button>
    </div>
  );
}
