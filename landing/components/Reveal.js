"use client";

import { useEffect } from "react";

// Fades .reveal elements up the first time they scroll into view.
// It marks <html> with .js-motion first; the hidden starting state in
// globals.css only applies under that class, so without JavaScript every
// section is simply visible. With reduced motion it does nothing.
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = [...document.querySelectorAll(".reveal")];
    if (!("IntersectionObserver" in window) || els.length === 0) return;

    // Anything already on screen at load shows straight away, without a fade.
    const vh = window.innerHeight;
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.9) el.classList.add("isIn");
    });
    document.documentElement.classList.add("js-motion");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("isIn");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    els.filter((el) => !el.classList.contains("isIn")).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
