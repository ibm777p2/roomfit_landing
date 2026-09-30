"use client";

import { useEffect, useRef, useState } from "react";
import { EXAMPLE_MATCH } from "@/lib/content";
import styles from "./Receipt.module.css";

// Score colours mean a score, per the design system: each bar takes the colour
// of its own ratio, the ring takes the total's.
function ramp(ratio) {
  if (ratio >= 0.75) return "var(--fit-high)";
  if (ratio >= 0.5) return "var(--fit-mid)";
  return "var(--fit-low)";
}

const R = 31;
const CIRC = 2 * Math.PI * R;

export default function Receipt() {
  const cardRef = useRef(null);
  // Server-render the finished card, so it reads correctly with no JavaScript.
  const [phase, setPhase] = useState("done"); // "waiting" | "playing" | "done"
  const [ring, setRing] = useState(EXAMPLE_MATCH.total);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setPhase("waiting");
    setRing(0);
    let raf = 0;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setPhase("playing");
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / 1200);
          setRing(Math.round(EXAMPLE_MATCH.total * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
          else setPhase("done");
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const { title, meta, total, factors } = EXAMPLE_MATCH;
  const filled = phase !== "waiting";
  const ringColor = ramp(total / 100);

  return (
    <section id="fit-receipt" className={styles.section} aria-labelledby="receipt-title">
      <div className={`wrap ${styles.grid}`}>
        <div className={`${styles.text} reveal`}>
          <div className={styles.icon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </div>
          <h2 id="receipt-title" className={styles.title}>
            Every match comes with a receipt.
          </h2>
          <p className={styles.body}>
            Five factors, each scored and explained. See exactly why a room ranked where it did, not
            just a number.
          </p>
          <p className={styles.body}>
            Listing a room? Anyone who messages you has already been scored against it.
          </p>
        </div>

        <div ref={cardRef} className={`${styles.card} ${filled ? styles.filled : ""}`}>
          <div className={styles.eyebrow}>Example match</div>
          <div className={styles.cardHead}>
            <div className={styles.cardTitleWrap}>
              <div className={styles.cardTitle}>{title}</div>
              <div className={styles.meta}>{meta}</div>
            </div>
            <div className={styles.ring}>
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r={R} fill="none" stroke="#e6e1d0" strokeWidth="6" />
                <circle
                  className={styles.ringFill}
                  cx="36"
                  cy="36"
                  r={R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={filled ? CIRC * (1 - total / 100) : CIRC}
                />
              </svg>
              <div className={styles.ringLabel}>
                <span className={styles.ringNum} style={{ color: ringColor }}>
                  {ring}
                </span>
                <span className={styles.ringCap}>FIT</span>
              </div>
              <span className="srOnly">Fit score {total} out of 100</span>
            </div>
          </div>

          <ul className={styles.factors}>
            {factors.map((f, i) => {
              const ratio = f.score / 20;
              const color = ramp(ratio);
              return (
                <li key={f.label} className={styles.factor} style={{ "--i": i }}>
                  <div className={styles.factorTop}>
                    <span className={styles.factorName}>{f.label}</span>
                    <span className={styles.factorPts}>{f.score}/20</span>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <div
                      className={styles.bar}
                      style={{ width: filled ? `${ratio * 100}%` : "0%", background: color, "--c": color }}
                    />
                  </div>
                  <span className={styles.reason}>{f.reason}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
