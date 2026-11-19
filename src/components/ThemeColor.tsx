"use client";

import { useEffect } from "react";

/**
 * Keeps the bar the system draws around the app (the title bar of the Mac app, the status bar area in a browser) the
 * same colour as the page. That colour comes from <meta name="theme-color">, which is otherwise fixed at the classic
 * look's grey or black; here it follows whatever look and light/dark side is showing.
 */
export default function ThemeColor() {
  useEffect(() => {
    const root = document.documentElement;
    const paint = () => {
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
    };
    paint();
    const looks = new MutationObserver(paint);
    looks.observe(root, { attributes: true, attributeFilter: ["data-look", "data-theme"] });
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", paint);
    return () => {
      looks.disconnect();
      dark.removeEventListener("change", paint);
    };
  }, []);
  return null;
}
