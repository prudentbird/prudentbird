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
  }, [text]);

  const isScrolling = overflow > 0;
  const duration = Math.max(6, overflow / 10);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden w-full"
      style={
        isScrolling
          ? ({ "--marquee-offset": `-${overflow}px` } as React.CSSProperties)
          : undefined
      }
    >
      <span
        ref={textRef}
        className={`${className ?? ""} inline-block whitespace-nowrap [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]`}
        style={
          isScrolling
            ? {
                animation: `marquee-scroll ${duration}s ease-in-out infinite alternate`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
