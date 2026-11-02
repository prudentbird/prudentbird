"use client";

import { useEffect } from "react";
import { sounds, unlockSound } from "~/lib/sound";

const INTERACTIVE =
  "a[href], button:not(:disabled), [role='button'], [role='menuitem']";

type ClickSound = "tap" | "send" | "none";

export function SoundEffects() {
  useEffect(() => {
    const unlock = () => unlockSound();
    let current: Element | null = null;

    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest?.(INTERACTIVE);
      if (!target || target === current) return;
      current = target;
      sounds.hover(event.clientX);
    };
    const out = (event: PointerEvent) => {
      if (current && !current.contains(event.relatedTarget as Node | null))
        current = null;
    };
    const click = (event: MouseEvent) => {
      const el = event.target as Element | null;
      const x = event.detail === 0 ? undefined : event.clientX;
      const sound = (el?.closest?.("[data-sound]") as HTMLElement | null)
        ?.dataset.sound as ClickSound | undefined;
      if (sound === "none") return;
      const target = el?.closest?.(INTERACTIVE);
      if (!target) return;
      if (
        sound === "send" ||
        target.getAttribute("href")?.startsWith("mailto:")
      )
        sounds.send(x);
      else sounds.tap(x);
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("click", click);
    };
  }, []);
  return null;
}
