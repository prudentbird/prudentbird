"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei/webgpu";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export function useStageEnv() {
  const { resolvedTheme } = useTheme();
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return { dark: resolvedTheme !== "light", reduce };
}

function Studio({ dark }: { dark: boolean }) {
  return (
    <Environment resolution={256}>
      <color attach="background" args={[dark ? "#0b0b0e" : "#9a9aa3"]} />
      <Lightformer
        form="rect"
        intensity={dark ? 2.4 : 3}
        position={[0, 6, 1]}
        rotation-x={Math.PI / 2}
        scale={[12, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={dark ? 0.35 : 0.9}
        position={[0, 0, 10]}
        rotation-y={Math.PI}
        scale={[30, 30, 1]}
      />
      <Lightformer
        form="rect"
        intensity={dark ? 2.6 : 2}
        position={[-3, 3.5, 9]}
        rotation-y={Math.PI}
        rotation-z={-0.5}
        scale={[14, 0.7, 1]}
      />
      <Lightformer
        form="rect"
        intensity={dark ? 1.6 : 2}
        position={[-7, 1, 1]}
        rotation-y={Math.PI / 2}
        scale={[8, 1.2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={dark ? 1.1 : 1.5}
        position={[7, -1, 2]}
        rotation-y={-Math.PI / 2}
        scale={[8, 0.8, 1]}
      />
    </Environment>
  );
}

export function Stage({
  className,
  children,
  camera,
  bleed,
}: {
  className?: string;
  children: ReactNode;
  camera: { position: [number, number, number]; fov: number };
  bleed: number;
}) {
  const { dark } = useStageEnv();
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setVisible(!!e?.isIntersecting),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={cn("relative", className)} aria-hidden="true">
      <div
        className="absolute"
        style={{ inset: `${((1 - bleed) / 2) * 100}%` }}
      >
        <Canvas
          dpr={[1, 2]}
          camera={{
            ...camera,
            position: [
              camera.position[0],
              camera.position[1],
              camera.position[2] * bleed,
            ],
          }}
          renderer={{ antialias: true, alpha: true }}
          frameloop={visible ? "always" : "never"}
        >
          <ambientLight intensity={dark ? 0.25 : 0.6} />
          <directionalLight position={[4, 6, 5]} intensity={dark ? 1.4 : 1.8} />
          {children}
          <Studio dark={dark} />
        </Canvas>
      </div>
    </div>
  );
}
