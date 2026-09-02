"use client";

import { useEffect, useRef } from "react";
import { Confetti, type ConfettiRef } from "~/components/ui/confetti";

/**
 * Full-screen confetti burst that fires once on mount.
 * `intensity` "big" is for wins; "small" for finishing without winning.
 */
export function Celebration({
  intensity = "big",
}: {
  intensity?: "big" | "small";
}) {
  const ref = useRef<ConfettiRef>(null);

  useEffect(() => {
    const fire = (opts: Parameters<NonNullable<ConfettiRef>["fire"]>[0]) =>
      ref.current?.fire(opts);
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (intensity === "small") {
      fire({ particleCount: 60, spread: 60, origin: { y: 0.65 } });
      return;
    }

    fire({
      particleCount: 120,
      spread: 80,
      startVelocity: 45,
      origin: { y: 0.6 },
    });
    timers.push(
      setTimeout(() => {
        fire({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } });
        fire({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } });
      }, 250),
      setTimeout(() => {
        fire({
          particleCount: 90,
          spread: 100,
          scalar: 1.1,
          origin: { y: 0.5 },
        });
      }, 600),
    );
    return () => timers.forEach(clearTimeout);
  }, [intensity]);

  return (
    <Confetti
      ref={ref}
      manualstart
      className="pointer-events-none fixed inset-0 z-[70] h-full w-full"
    />
  );
}
