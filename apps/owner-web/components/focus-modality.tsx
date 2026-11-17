"use client";

import { useEffect } from "react";

/** Track how focus was reached, including focus restored by a Radix popup. */
export function FocusModality() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.inputModality;
    root.dataset.inputModality = "keyboard";
    const pointer = () => {
      root.dataset.inputModality = "pointer";
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const editing =
        event.target instanceof HTMLElement &&
        event.target.matches('input, textarea, [contenteditable="true"]');
      if (editing && event.key !== "Tab") return;
      // Typing in a pointer-focused text field should not change its appearance.
      if (
        [
          "Tab",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          "Enter",
          " ",
          "Escape",
        ].includes(event.key)
      )
        root.dataset.inputModality = "keyboard";
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      if (previous === undefined) delete root.dataset.inputModality;
      else root.dataset.inputModality = previous;
    };
  }, []);
  return null;
}
