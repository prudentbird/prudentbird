"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True only once `value` has flipped from false to true while mounted.
 * Lets celebrations fire on the transition, not when reloading a finished game.
 */
export function useBecame(value: boolean): boolean {
  const initial = useRef(value);
  const [became, setBecame] = useState(false);
  useEffect(() => {
    if (value && !initial.current) setBecame(true);
    if (!value) initial.current = false;
  }, [value]);
  return became;
}
