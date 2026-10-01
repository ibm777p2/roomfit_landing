"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { DEMO, EXAMPLE_MATCH } from "@/lib/content";
import styles from "./ReceiptDemo.module.css";

// "How it works", played out: a pointer sets the preferences, presses Find my
// fit, three rooms come back ranked, and the top one opens into its receipt.
//
// Everything is driven by one clock, `t` (ms into a 17 s loop): each value on
// screen is a pure function of `t`, so the loop is repeatable and there's no
// state to drift. The clock runs only while the card is on screen. With
// reduced motion it is pinned to the finished receipt.

const LOOP = 17000;
const FINAL = 13000; // the resting frame for reduced motion

// ---- timeline (ms) ----
const T = {
  budget: [1500, 2600],
  areaClick: 3200,
  areaOpen: [3250, 3700],
  areaPick: 3650,
  tidy: [4500, 5300],
  social: [5800, 6500],
  sleepClick: 7000,
  press: [7650, 7850],
  loading: [7800, 8800],
  results: 8800,
  openClick: 10500,
  receipt: 10800,
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (t, a, b) => easeInOut(clamp01((t - a) / (b - a)));
const lin = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const mix = (p, q, k) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) });

const BUDGET_MIN = 500;
const BUDGET_MAX = 3000;
const SLEEP = [
  { value: "early", label: "Early riser" },
  { value: "late", label: "Night owl" },
  { value: "flexible", label: "Flexible" },
];

function ramp(ratio) {
  if (ratio >= 0.75) return "var(--fit-high)";
  if (ratio >= 0.5) return "var(--fit-mid)";
  return "var(--fit-low)";
}

// Everything on screen at time t.
function frame(t) {
  const budget = Math.round(lerp(900, DEMO.prefs.budget, seg(t, ...T.budget)) / 50) * 50;
  const tidy = lerp(5, DEMO.prefs.tidy, seg(t, ...T.tidy));
  const social = lerp(1, DEMO.prefs.social, seg(t, ...T.social));
  return {
    budget,
    budgetFrac: (budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN),
    area: t >= T.areaPick ? DEMO.prefs.area : "Mission",
    areaOpen: t >= T.areaOpen[0] && t < T.areaOpen[1],
    tidy,
    social,
    sleep: t >= T.sleepClick ? DEMO.prefs.sleep : "flexible",
    pressed: t >= T.press[0] && t < T.press[1],
    step: t < T.loading[0] ? 1 : t < T.receipt ? 2 : 3,
    op: {
      all: seg(t, 0, 300) * (1 - seg(t, LOOP - 600, LOOP - 100)),
      form: 1 - seg(t, T.loading[0], T.loading[0] + 250),
      loading: seg(t, T.loading[0], T.loading[0] + 200) * (1 - seg(t, T.loading[1] - 150, T.loading[1] + 50)),
      results: seg(t, T.results - 50, T.results + 150) * (1 - seg(t, T.receipt - 50, T.receipt + 150)),
      receipt: seg(t, T.receipt, T.receipt + 250),
    },
    cards: DEMO.results.map((_, i) => ({
      in: seg(t, T.results + i * 250, T.results + 400 + i * 250),
      count: lin(t, T.results + 100 + i * 250, T.results + 1000 + i * 250),
    })),
    firstCardPressed: t >= T.openClick && t < T.openClick + 180,
    ring: lin(t, T.receipt + 100, T.receipt + 1200),
    bars: EXAMPLE_MATCH.factors.map((_, i) => seg(t, T.receipt + 300 + i * 150, T.receipt + 1000 + i * 150)),
    reasons: EXAMPLE_MATCH.factors.map((_, i) => seg(t, T.receipt + 700 + i * 150, T.receipt + 1100 + i * 150)),
  };
}

// Where the pointer is at time t, from the measured positions of the controls.
function pointer(t, g, f) {
  if (!g) return null;
  const knob = (track, frac) => ({ x: track.x + frac * track.w, y: track.y });
  const start = { x: g.w - 28, y: g.h - 24 };
  const budget0 = knob(g.budget, (900 - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN));
  const budgetNow = knob(g.budget, f.budgetFrac);
  const tidy0 = knob(g.tidy, 1);
  const tidyNow = knob(g.tidy, (f.tidy - 1) / 4);
  const social0 = knob(g.social, 0);
  const socialNow = knob(g.social, (f.social - 1) / 4);
  const option = { x: g.area.x - g.area.w * 0.25, y: g.area.y + 46 };
  const exit = { x: g.w + 30, y: g.card.y + 90 };

  let p;
  let down = false;
  if (t < 400) p = start;
  else if (t < 1500) p = mix(start, budget0, seg(t, 400, 1400));
  else if (t < 2600) { p = budgetNow; down = true; }
  else if (t < 3300) p = mix(budgetNow, g.area, seg(t, 2600, 3150));
  else if (t < 3900) p = mix(g.area, option, seg(t, 3300, 3600));
  else if (t < 4500) p = mix(option, tidy0, seg(t, 3900, 4400));
  else if (t < 5300) { p = tidyNow; down = true; }
  else if (t < 5800) p = mix(tidyNow, social0, seg(t, 5300, 5750));
  else if (t < 6500) { p = socialNow; down = true; }
  else if (t < 7050) p = mix(socialNow, g.sleep, seg(t, 6500, 6950));
  else if (t < 9800) p = mix(g.sleep, g.button, seg(t, 7050, 7550));
  else if (t < 10800) p = mix(g.button, g.card, seg(t, 9800, 10400));
  else p = mix(g.card, exit, seg(t, 10900, 11600));

  const clicks = [T.areaClick, T.areaPick, T.sleepClick, T.press[0], T.openClick];
  if (clicks.some((c) => t >= c && t < c + 180)) down = true;
  const visible = t >= 300 && t < 11600;
  return { ...p, down, visible };
}

function Ring({ value, frac, size = 72, stroke = 6 }) {
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const color = ramp(value / 100);
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6e1d0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (value / 100) * frac)}
        />
      </svg>
      <div className={styles.ringLabel}>
        <span className={styles.ringNum} style={{ color, fontSize: size > 60 ? 22 : 15 }}>
          {Math.round(value * frac)}
        </span>
        {size > 60 && <span className={styles.ringCap}>FIT</span>}
      </div>
    </div>
  );
}

function Slider({ label, low, high, frac, value, trackRef }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldTop}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      <div className={styles.track} ref={trackRef}>
        <div className={styles.trackFill} style={{ width: `${frac * 100}%` }} />
        <div className={styles.knob} style={{ left: `${frac * 100}%` }} />
      </div>
      {low && (
        <div className={styles.ends}>
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

export default function ReceiptDemo() {
  const [t, setT] = useState(FINAL); // server-render the finished receipt
  const [geo, setGeo] = useState(null);
  const cardRef = useRef(null);
  const refs = {
    budget: useRef(null),
    area: useRef(null),
    tidy: useRef(null),
    social: useRef(null),
    sleep: useRef(null),
    button: useRef(null),
    card: useRef(null),
  };

  // Measure where each control sits inside the card, for the pointer.
  useLayoutEffect(() => {
    const root = cardRef.current;
    if (!root) return;
    const measure = () => {
      const base = root.getBoundingClientRect();
      const box = (el, fx = 0.5, fy = 0.5) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - base.left + r.width * fx, y: r.top - base.top + r.height * fy, w: r.width };
      };
      const track = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top + r.height / 2, w: r.width };
      };
      setGeo({
        w: base.width,
        h: base.height,
        budget: track(refs.budget.current),
        tidy: track(refs.tidy.current),
        social: track(refs.social.current),
        area: box(refs.area.current, 0.82),
        sleep: box(refs.sleep.current),
        button: box(refs.button.current, 0.62, 0.6),
        card: box(refs.card.current, 0.7),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The clock: runs while on screen, loops, restarts from the top each time
  // the card comes back into view.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start just past the fade-in, so before it plays the card shows the
    // empty form rather than nothing.
    const START = 300;
    let raf = 0;
    let t0 = 0;
    const tick = (now) => {
      setT((now - t0) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        cancelAnimationFrame(raf);
        if (entry.isIntersecting) {
          t0 = performance.now() - START;
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    setT(START);
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const f = frame(t);
  const p = pointer(t, geo, f);
  const { title, meta, total, factors } = EXAMPLE_MATCH;

  return (
    <div className={styles.wrap}>
      {/* What the animation shows, for screen readers */}
      <div className="srOnly">
        <p>
          Example: set a ${DEMO.prefs.budget.toLocaleString()} budget in SoMa, tidiness and social level 3 of 5,
          and night-owl hours, then Find my fit. Three rooms come back ranked:
          {DEMO.results.map((r) => ` ${r.title}, ${r.meta}, fit ${r.score};`)} and the top one opens into its
          receipt:
        </p>
        <ul>
          {factors.map((fac) => (
            <li key={fac.label}>
              {fac.label} {fac.score}/20: {fac.reason}
            </li>
          ))}
        </ul>
      </div>

      <ol className={styles.steps} aria-hidden="true">
        {["Set your preferences", "Find my fit", "Read the receipt"].map((s, i) => (
          <li key={s} className={f.step === i + 1 ? styles.stepOn : ""}>
            <span className={styles.stepNum}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div ref={cardRef} className={styles.card} aria-hidden="true" style={{ opacity: f.op.all }}>
        <div className={styles.eyebrow}>Example</div>

        {/* ---- 1. preferences ---- */}
        <div className={styles.stage} style={{ opacity: f.op.form, visibility: f.op.form > 0 ? "visible" : "hidden" }}>
          <Slider
            label="Monthly budget"
            frac={f.budgetFrac}
            value={`$${f.budget.toLocaleString()}`}
            trackRef={refs.budget}
          />

          <div className={styles.field}>
            <span className={styles.label}>Where you want to be</span>
            <div className={styles.select} ref={refs.area}>
              {f.area}
              <span className={styles.chev}>▾</span>
              {f.areaOpen && (
                <div className={styles.menu}>
                  <div>Mission</div>
                  <div className={t >= T.areaPick - 250 ? styles.menuHot : ""}>SoMa</div>
                  <div>Sunset</div>
                </div>
              )}
            </div>
          </div>

          <Slider
            label="How tidy you keep a place"
            low="Relaxed"
            high="Spotless"
            frac={(f.tidy - 1) / 4}
            value={`${Math.round(f.tidy)}/5`}
            trackRef={refs.tidy}
          />
          <Slider
            label="How social you want the home"
            low="Quiet"
            high="Very social"
            frac={(f.social - 1) / 4}
            value={`${Math.round(f.social)}/5`}
            trackRef={refs.social}
          />

          <div className={styles.field}>
            <span className={styles.label}>Your sleep hours</span>
            <div className={styles.segmented}>
              {SLEEP.map((s) => (
                <span
                  key={s.value}
                  ref={s.value === "late" ? refs.sleep : undefined}
                  className={f.sleep === s.value ? styles.segOn : ""}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          <div ref={refs.button} className={`${styles.findBtn} ${f.pressed ? styles.findBtnDown : ""}`}>
            Find my fit
          </div>
        </div>

        {/* ---- 2a. ranking ---- */}
        <div className={`${styles.stage} ${styles.center}`} style={{ opacity: f.op.loading, visibility: f.op.loading > 0 ? "visible" : "hidden" }}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Ranking rooms by how well they fit you…</p>
        </div>

        {/* ---- 2b. results ---- */}
        <div className={styles.stage} style={{ opacity: f.op.results, visibility: f.op.results > 0 ? "visible" : "hidden" }}>
          <div className={styles.resultsHead}>
            <span className={styles.resultsCount}>3 rooms fit</span>
            <span className={styles.resultsMeta}>SoMa · up to ${DEMO.prefs.budget.toLocaleString()}</span>
          </div>
          <ul className={styles.results}>
            {DEMO.results.map((r, i) => (
              <li
                key={r.title}
                ref={i === 0 ? refs.card : undefined}
                className={`${styles.result} ${i === 0 && f.firstCardPressed ? styles.resultDown : ""}`}
                style={{ opacity: f.cards[i].in, transform: `translateY(${(1 - f.cards[i].in) * 14}px)` }}
              >
                <div className={styles.thumb}>
                  <Image src={r.photo} alt="" fill sizes="64px" style={{ objectFit: "cover" }} />
                </div>
                <div className={styles.resultText}>
                  <span className={styles.resultTitle}>{r.title}</span>
                  <span className={styles.resultMeta}>{r.meta}</span>
                </div>
                <Ring value={r.score} frac={f.cards[i].count} size={52} stroke={5} />
              </li>
            ))}
          </ul>
          <p className={styles.hint}>Tap a room to see why it ranked there.</p>
        </div>

        {/* ---- 3. the receipt ---- */}
        <div className={styles.stage} style={{ opacity: f.op.receipt, visibility: f.op.receipt > 0 ? "visible" : "hidden" }}>
          <div className={styles.receiptHead}>
            <div className={styles.receiptTitleWrap}>
              <div className={styles.receiptTitle}>{title}</div>
              <div className={styles.resultMeta}>{meta}</div>
            </div>
            <Ring value={total} frac={f.ring} />
          </div>
          <ul className={styles.factors}>
            {factors.map((fac, i) => {
              const ratio = fac.score / 20;
              const color = ramp(ratio);
              return (
                <li key={fac.label} className={styles.factor}>
                  <div className={styles.factorTop}>
                    <span className={styles.factorName}>{fac.label}</span>
                    <span className={styles.factorPts}>{fac.score}/20</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.bar} style={{ width: `${ratio * f.bars[i] * 100}%`, background: color, "--c": color }} />
                  </div>
                  <span className={styles.reason} style={{ opacity: f.reasons[i] }}>
                    {fac.reason}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* the pretend pointer */}
        {p && (
          <svg
            className={styles.pointer}
            width="22"
            height="26"
            viewBox="0 0 22 26"
            style={{
              transform: `translate(${p.x - 3}px, ${p.y - 2}px) scale(${p.down ? 0.86 : 1})`,
              opacity: p.visible ? 1 : 0,
            }}
          >
            <path d="M3 2l15.5 13.2-6.9.6 4 8.1-3.2 1.6-4-8.2L3 22.3z" fill="#191c1a" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        )}
        {p && p.down && p.visible && (
          <span className={styles.tapRing} style={{ left: p.x, top: p.y }} />
        )}
      </div>
    </div>
  );
}
