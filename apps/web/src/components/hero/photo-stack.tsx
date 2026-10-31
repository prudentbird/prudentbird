"use client";

import Image from "next/image";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { PHOTOS, type Photo } from "./photos";

const TILT = [-7, 5, -3, 8, -5];

export default function PhotoStack({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(() => PHOTOS.map((_, i) => i));
  const [fanned, setFanned] = useState(false);

  useEffect(() => {
    if (reduce || fanned) return;
    const id = setInterval(() => setOrder((o) => [...o.slice(1), o[0]!]), 4000);
    return () => clearInterval(id);
  }, [reduce, fanned]);

  return (
    <div
      className={cn("relative grid place-items-center select-none", className)}
      onPointerEnter={() => setFanned(true)}
      onPointerLeave={() => setFanned(false)}
      onFocus={() => setFanned(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFanned(false);
      }}
      role="group"
      aria-label="A stack of my photos"
    >
      {PHOTOS.map((card, i) => {
        const depth = order.indexOf(i);
        const n = PHOTOS.length;
        const spread = depth / (n - 1) - 0.5;
        return (
          <m.figure
            key={i}
            initial={false}
            role="button"
            tabIndex={0}
            aria-label={`Bring photo ${i + 1} of ${n} forward`}
            onClick={() => setOrder((o) => [i, ...o.filter((x) => x !== i)])}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setOrder((o) => [i, ...o.filter((x) => x !== i)]);
            }}
            animate={{
              x: fanned ? `${spread * 45}%` : "0%",
              y: fanned ? Math.abs(spread) * 16 : Math.min(depth, 4) * -6,
              rotate: fanned ? spread * 28 : TILT[i % TILT.length]!,
              scale: 1 - Math.min(depth, 4) * 0.03,
              zIndex: n - depth,
            }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 210, damping: 24 }
            }
            className="absolute w-[60%] cursor-pointer rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring bg-[#fbfaf7] p-[4%] pb-[16%] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.12)] dark:bg-[#292724] dark:ring-1 dark:ring-white/25 dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.5)]"
          >
            <div className="relative aspect-[4/5] bg-neutral-200 dark:bg-neutral-900">
              <DeferredPhoto photo={card} />
              <svg
                aria-hidden="true"
                viewBox="0 0 240 16"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -inset-x-px -bottom-1 h-4 w-[calc(100%+2px)] fill-[#fbfaf7] dark:fill-[#292724]"
              >
                <path d="M0 6 Q10 0 20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 T180 6 T200 6 T220 6 T240 6 V16 H0 Z" />
              </svg>
            </div>
          </m.figure>
        );
      })}
    </div>
  );
}

export function DeferredPhoto({
  photo,
  sizes = "(max-width: 639px) 60vw, 340px",
}: {
  photo: Photo;
  sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      quality={90}
      loading="lazy"
      draggable={false}
      ref={(img) => {
        if (img?.complete && img.naturalWidth) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      className={cn(
        "object-cover transition-opacity duration-300 motion-reduce:transition-none [-webkit-user-drag:none]",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
