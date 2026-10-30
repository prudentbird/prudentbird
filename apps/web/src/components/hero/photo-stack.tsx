"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { PHOTOS } from "./photos";

type Photo = { src: string; caption: string };
const TILT = [-7, 5, -3, 8, -5];

export default function PhotoStack({ className }: { className?: string }) {
  return <PhotoStackGallery photos={PHOTOS} className={className} />;
}

function PhotoStackGallery({
  photos,
  className,
}: {
  photos: Photo[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const [fanned, setFanned] = useState(false);

  useEffect(() => {
    if (reduce || fanned || photos.length < 2) return;
    const id = setInterval(() => setOrder((o) => [...o.slice(1), o[0]!]), 4000);
    return () => clearInterval(id);
  }, [reduce, fanned, photos.length]);

  return (
    <div
      className={cn("relative grid place-items-center select-none", className)}
      onPointerEnter={() => setFanned(true)}
      onPointerLeave={() => setFanned(false)}
      aria-label={photos.length ? "A stack of my photos" : undefined}
      aria-hidden={photos.length ? undefined : true}
    >
      {photos.map((card, i) => {
        const depth = order.indexOf(i);
        const n = photos.length;
        const spread = n > 1 ? depth / (n - 1) - 0.5 : 0;
        return (
          <motion.figure
            key={i}
            initial={false}
            onClick={() => setOrder((o) => [i, ...o.filter((x) => x !== i)])}
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
            className="absolute w-[60%] cursor-pointer rounded-[4px] bg-[#fbfaf7] p-[4%] pb-[16%] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.12)] dark:bg-[#292724] dark:ring-1 dark:ring-white/25 dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.5)]"
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
            {card.caption && (
              <figcaption className="absolute inset-x-0 bottom-[4%] text-center text-sm text-neutral-600 dark:text-neutral-100 [font-family:'Bradley_Hand','Segoe_Print',cursive]">
                {card.caption}
              </figcaption>
            )}
          </motion.figure>
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
      alt={photo.caption || "Photo by Prudent Bird"}
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
