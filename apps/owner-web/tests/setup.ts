import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { seed } from "../lib/demo";
// Radix relies on browser layout APIs that jsdom intentionally does not implement.
Object.defineProperty(window, "matchMedia", {
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  })),
});
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);
HTMLElement.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
afterEach(() => {
  cleanup();
  localStorage.clear();
  history.replaceState({}, "", "/");
});
export { seed };
