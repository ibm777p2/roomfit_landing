"use client";

import { useEffect, useRef, useState } from "react";

// Counts from 0 to `to` the first time it scrolls into view. Server-renders
// the final number, so without JavaScript (or with reduced motion) it simply
// reads "250+".
//
// The page text holds the number once, in the screen-reader copy. The number
// you see is drawn by CSS from data-value (.countUp in globals.css), so search
// engines and copy-paste don't read "250+250+".
export default function CountUp({ to, suffix = "", duration = 1200 }) {
  const ref = useRef(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let started = false;
    setValue(0);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(to * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      <span className="srOnly">
        {to}
        {suffix}
      </span>
      <span aria-hidden="true" className="countUp" data-value={`${value}${suffix}`} />
    </span>
  );
}
