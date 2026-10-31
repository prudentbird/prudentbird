"use client";

import { useEffect, useRef, useState } from "react";

export function MarqueeText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      setOverflow(Math.max(0, textEl.scrollWidth - container.clientWidth));
    };

    document.fonts.ready.then(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, className]);

  const isScrolling = overflow > 0;
  const duration = Math.max(6, overflow / 10);

  return (
    <div
      ref={containerRef}
      title={text}
      className="overflow-hidden w-full"
      style={
        isScrolling
          ? ({
              "--marquee-offset": `-${overflow}px`,
              "--marquee-duration": `${duration}s`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span
        ref={textRef}
        className={`${className ?? ""} inline-block whitespace-nowrap ${!isScrolling ? "max-w-full overflow-hidden text-ellipsis" : ""} [text-box-trim:trim-both] [text-box-edge:cap_alphabetic] ${
          isScrolling
            ? "motion-safe:animate-[marquee-scroll_var(--marquee-duration)_ease-in-out_infinite_alternate] motion-reduce:max-w-full motion-reduce:overflow-hidden motion-reduce:text-ellipsis"
            : ""
        }`}
      >
        {text}
      </span>
    </div>
  );
}
