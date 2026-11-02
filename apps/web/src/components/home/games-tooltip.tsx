"use client";

import { useEffect, useRef, useState } from "react";

const GUTTER = 16;

export function GamesTooltip() {
  const [dismissed, setDismissed] = useState(false);
  const tip = useRef<HTMLSpanElement>(null);

  const place = () => {
    const el = tip.current;
    if (!el) return;
    el.style.setProperty("--shift", "0px");
    el.style.width = "";
    el.style.top = "";
    el.style.bottom = "";
    el.style.marginTop = "";
    el.style.marginBottom = "";
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()];
    const longest =
      Math.max(...lines.map((r) => r.right)) - el.getBoundingClientRect().left;
    const style = getComputedStyle(el);
    if (lines.length)
      el.style.width = `${Math.ceil(longest + parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth))}px`;
    const box = el.getBoundingClientRect();
    const max = document.documentElement.clientWidth - GUTTER;
    const shift = Math.max(GUTTER - box.left, Math.min(0, max - box.right));
    el.style.setProperty("--shift", `${Math.round(shift)}px`);
    if (box.bottom > window.innerHeight - GUTTER) {
      el.style.top = "auto";
      el.style.bottom = "100%";
      el.style.marginTop = "0";
      el.style.marginBottom = "8px";
    }
  };

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  return (
    <span
      className="group relative inline-block underline decoration-dotted underline-offset-4 focus-visible:outline-2"
      tabIndex={0}
      aria-describedby="about-games"
      data-sound="coin"
      data-sound-hover="coin"
      onPointerEnter={() => {
        setDismissed(false);
        place();
      }}
      onFocus={() => {
        setDismissed(false);
        place();
      }}
    >
      games
      <span
        ref={tip}
        id="about-games"
        role="tooltip"
        style={dismissed ? { visibility: "hidden", opacity: 0 } : undefined}
        className="invisible absolute left-0 top-full z-20 mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] translate-x-(--shift) rounded-xl border border-border/60 bg-popover p-3 text-left text-sm font-normal leading-snug text-popover-foreground no-underline opacity-0 shadow-lg transition-[opacity,visibility] duration-150 before:absolute before:inset-x-0 before:-top-2.5 before:h-2.5 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 sm:text-base"
      >
        I&apos;m not much of a football fan; I prefer Sudoku, Alto&apos;s
        Adventure, Alto&apos;s Odyssey, and Call of Duty: Mobile.
      </span>
    </span>
  );
}
