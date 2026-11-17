"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
  type MouseEvent,
} from "react";

/** Animate the sidebar only; translating a resized page exposes blank edges. */
export function useSidebarMotion(
  setOpen: Dispatch<SetStateAction<boolean>>,
  enabled: boolean,
) {
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 761px)");
    const cancel = () => {
      setMotionEnabled(false);
    };
    reduced.addEventListener("change", cancel);
    desktop.addEventListener("change", cancel);
    return () => {
      reduced.removeEventListener("change", cancel);
      desktop.removeEventListener("change", cancel);
    };
  }, []);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const animate =
      enabled &&
      event.detail > 0 &&
      window.matchMedia("(min-width: 761px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotionEnabled(animate);
    setOpen((value) => !value);
  }
  return { motionEnabled: enabled && motionEnabled, toggle };
}
