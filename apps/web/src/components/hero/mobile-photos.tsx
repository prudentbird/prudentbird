"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DeferredPhoto } from "./photo-stack";
import { PHOTOS, type Photo } from "./photos";

const PAPER = "rounded-[4px] bg-[#fbfaf7] p-4 pb-14 dark:bg-[#292724]";
const SHADOW =
  "shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.12)]";
const RING = "dark:ring-1 dark:ring-[#474747]";
const FRAME = `${PAPER} ${SHADOW} ${RING}`;
const ANGLES = [-45, -43, -46, -44, -45, -42, -44, -46];
const EDGE_PRINT = "absolute left-0 w-56 origin-top-left select-none";

function edgeStyle(i: number, count: number) {
  return {
    top: `${17 + (i * 65) / Math.max(count - 1, 1)}%`,
    transform: `translateX(${i % 2 ? 14 : 10}px) rotate(${ANGLES[i]}deg)`,
    zIndex: i + 1,
  };
}

export function MobilePhotos() {
  const photos = PHOTOS;
  const [selected, setSelected] = useState<number | null>(null);
  const [lifted, setLifted] = useState<{
    index: number;
    x: number;
    y: number;
    zoom: number;
    openX: number;
    edge: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const edge = useRef<HTMLDivElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (selected === null) return;
    const trigger = triggers.current[selected];
    closeButton.current?.focus({ preventScroll: true });
    const dismiss = () => setSelected(null);
    const hold = (event: Event) => event.preventDefault();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        dismiss();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    document.addEventListener("wheel", hold, { passive: false });
    document.addEventListener("touchmove", hold, { passive: false });
    document.addEventListener("keydown", keyboard);
    desktop.addEventListener("change", dismiss);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("wheel", hold);
      document.removeEventListener("touchmove", hold);
      document.removeEventListener("keydown", keyboard);
      desktop.removeEventListener("change", dismiss);
      trigger?.focus({ preventScroll: true });
    };
  }, [selected]);

  return (
    <>
      <div
        ref={edge}
        className="pointer-events-none absolute inset-y-0 -right-5 w-20 sm:-right-8 lg:hidden"
        aria-label="Photos tucked along the edge"
      >
        {photos.map((photo, i) => (
          <button
            key={i}
            ref={(node) => {
              triggers.current[i] = node;
            }}
            type="button"
            aria-label={`View photo ${i + 1}`}
            aria-haspopup="dialog"
            aria-expanded={selected === i}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const bounds = edge.current!.getBoundingClientRect();
              const room = bounds.left - 12 - 24;
              const width = Math.min(
                320,
                (window.innerHeight - 128) * 0.7,
                room,
              );
              setLifted({
                index: i,
                x: rect.left + rect.width / 2 - window.innerWidth / 2,
                y: rect.top + rect.height / 2 - window.innerHeight / 2,
                zoom: width / event.currentTarget.offsetWidth,
                openX: 24 + room / 2 - window.innerWidth / 2,
                edge: {
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.width,
                  height: bounds.height,
                },
              });
              setSelected(i);
            }}
            className={`pointer-events-auto ${EDGE_PRINT} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${FRAME}`}
            style={{
              ...edgeStyle(i, photos.length),
              opacity: lifted?.index === i ? 0 : 1,
            }}
          >
            <Print photo={photo} />
          </button>
        ))}
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence onExitComplete={() => setLifted(null)}>
            {selected !== null && lifted && (
              <motion.div
                key="photo-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={`Photo ${selected + 1}. Tap the photo or anywhere else to put it back.`}
                className="fixed inset-0 z-[100] grid place-items-center p-6 lg:hidden"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setSelected(null);
                }}
              >
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-black/65"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2 }}
                />
                <motion.button
                  ref={closeButton}
                  type="button"
                  aria-label="Put photo back"
                  className={`relative w-56 select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${FRAME}`}
                  initial={{
                    x: lifted.x,
                    y: lifted.y,
                    rotate: ANGLES[selected],
                    scale: 1,
                  }}
                  animate={{
                    x: lifted.openX,
                    y: 0,
                    rotate: 0,
                    scale: lifted.zoom,
                  }}
                  exit={{
                    x: lifted.x,
                    y: lifted.y,
                    rotate: ANGLES[selected],
                    scale: 1,
                    transition: reduce
                      ? { duration: 0 }
                      : { duration: 0.38, ease: [0.32, 0.72, 0, 1] },
                  }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", visualDuration: 0.42, bounce: 0.12 }
                  }
                  onClick={() => setSelected(null)}
                >
                  <Print photo={photos[selected]!} />
                </motion.button>
                <div
                  aria-hidden="true"
                  className="pointer-events-none fixed"
                  style={lifted.edge}
                >
                  {photos.map(
                    (photo, i) =>
                      i > lifted.index && (
                        <div
                          key={i}
                          className={`${EDGE_PRINT} ${PAPER}`}
                          style={edgeStyle(i, photos.length)}
                        >
                          <Print photo={photo} />
                          <motion.div
                            className="absolute inset-0 rounded-[4px] bg-black/65"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduce ? 0 : 0.2 }}
                          />
                        </div>
                      ),
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Print({ photo }: { photo: Photo }) {
  return (
    <div className="relative aspect-[4/5] bg-neutral-200 dark:bg-neutral-900">
      <DeferredPhoto photo={photo} sizes="(max-width: 1023px) 320px, 340px" />
      <svg
        aria-hidden="true"
        viewBox="0 0 240 16"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-x-px -bottom-1 h-4 w-[calc(100%+2px)] fill-[#fbfaf7] dark:fill-[#292724]"
      >
        <path d="M0 6 Q10 0 20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 T180 6 T200 6 T220 6 T240 6 V16 H0 Z" />
      </svg>
    </div>
  );
}
