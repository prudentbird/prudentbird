"use client";

import { Volume2, VolumeOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  sounds,
  subscribeSound,
  unlockSound,
} from "~/lib/sound";
import { cn } from "~/lib/utils";

const INTERACTIVE =
  "a[href], button:not(:disabled), [role='button'], [role='menuitem'], [data-sound-hover]";

type HoverSound = "hover" | "coin" | "dial";
type ClickSound = "tap" | "send" | "coin" | "none";

export function useSoundEnabled() {
  return useSyncExternalStore(subscribeSound, isSoundEnabled, () => true);
}

export function SoundEffects() {
  useEffect(() => {
    const unlock = () => unlockSound();
    let current: Element | null = null;

    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest?.(INTERACTIVE);
      if (!target || target === current) return;
      current = target;
      const sound = (target.closest("[data-sound-hover]") as HTMLElement | null)
        ?.dataset.soundHover as HoverSound | undefined;
      if (sound === "coin") sounds.coin(event.clientX);
      else if (sound === "dial") sounds.dial(event.clientX);
      else sounds.hover(event.clientX);
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
      if (!target) {
        const selection = window.getSelection();
        const selecting = selection && !selection.isCollapsed;
        if (event.detail > 0 && !selecting && el?.tagName !== "CANVAS")
          sounds.drop(event.clientX, event.clientY);
        return;
      }
      if (sound === "coin") sounds.coin(x);
      else if (
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

export function SoundToggle({ className }: { className?: string }) {
  const enabled = useSoundEnabled();
  return (
    <button
      type="button"
      data-sound="none"
      aria-pressed={enabled}
      aria-label="Sound effects"
      title={enabled ? "Mute sounds" : "Turn sounds on"}
      onClick={() => setSoundEnabled(!enabled)}
      className={cn(
        "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-border/60 bg-muted text-accent-foreground/80 transition-colors hover:text-accent-foreground sm:size-[1.875rem]",
        className,
      )}
    >
      {enabled ? (
        <Volume2 className="size-3.5" aria-hidden="true" />
      ) : (
        <VolumeOff className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
