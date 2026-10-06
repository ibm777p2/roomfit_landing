"use client";

import { useEffect, useRef } from "react";
import styles from "./Sky.module.css";

// The hero sky, drawn with three.js: slow-turning sun, drifting clouds, and a
// plane that climbs at 45° up the left of the sky and off the edge, leaving a
// dashed trail that fades, then sets off again from the bottom-left.
//
// It works in CSS pixels: an orthographic camera the size of the hero, so an
// object at (x, y) sits x px from the left and y px from the top.
//
// It measures the nav, the headline block ([data-sky-avoid]) and the skyline
// ([data-sky-ground]). Clouds keep to the clear sky: they drift across the
// band above the headline and the band below the buttons, and on wide screens
// bob beside the headline. The plane's line is aimed just past the headline's
// top-left corner, so it climbs beside the words and never behind them.
//
// Every object is drawn whole (fill, then outline) in its own layer, so a
// cloud hides whatever is behind it instead of letting outlines show through.
//
// Cheap on purpose: three.js loads only after the page is up, the loop pauses
// when the hero is off screen or the tab is hidden, and with reduced motion it
// never starts (the static SVG sky in Hero.js stays instead).

const SHAPES = {
  cloud: {
    w: 70,
    h: 26,
    paths: ["M8 24h54a7 7 0 0 0-2-13.6A11 11 0 0 0 39 7a13 13 0 0 0-24 5A6 6 0 0 0 8 24z"],
    fill: true,
  },
  plane: {
    w: 44,
    h: 20,
    paths: [
      "M3 11h32c4 0 7-1.4 7-3s-3-2-7-2H22L14 1h-3l4 5H8L5 3H2l1.5 5z",
      "M20 11l-5 7h3l8-7",
    ],
    fill: true,
  },
  sun: {
    w: 46,
    h: 46,
    paths: [
      "M14 23a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z",
      "M23 4v5M23 37v5M4 23h5M37 23h5M9.6 9.6l3.5 3.5M32.9 32.9l3.5 3.5M9.6 36.4l3.5-3.5M32.9 13.1l3.5-3.5",
    ],
    fill: false,
  },
};

const PAPER = "#f4f1e5";
const SKETCH = "#c2bfb3";
const TAU = Math.PI * 2;

// Draw layers (renderOrder). Each sprite takes two: fill, then outline.
const LAYER_SUN = 0;
const LAYER_CLOUDS = 10; // each cloud gets its own pair above this
const LAYER_TRAIL = 900;
const LAYER_PLANE = 1000;

const PLANE_REST = 1.5; // seconds of empty sky between flights

export default function Sky() {
  const hostRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      let THREE, SVGLoader;
      try {
        THREE = await import("three");
        ({ SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js"));
      } catch {
        return; // static sky stays
      }
      if (disposed || !hostRef.current) return;

      const host = hostRef.current;
      const hero = host.closest("section");

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL: static sky stays
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.sortObjects = true;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);

      // All materials share one draw list (transparent, no depth), so the
      // layer numbers above decide what covers what. Fills are fully opaque.
      const mat = (color, opacity = 1) =>
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
      const fillMat = mat(PAPER);
      const strokeMat = mat(SKETCH);

      // ---- shapes, parsed once from the design's own SVG paths ----
      const loader = new SVGLoader();
      const parsed = {};
      for (const [name, s] of Object.entries(SHAPES)) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}">${s.paths
          .map((d) => `<path d="${d}"/>`)
          .join("")}</svg>`;
        const shapePaths = loader.parse(svg).paths;
        parsed[name] = {
          ...s,
          shapePaths,
          fillGeo: s.fill
            ? new THREE.ShapeGeometry(shapePaths.flatMap((p) => SVGLoader.createShapes(p)))
            : null,
        };
      }

      // One sprite: a pivot at the shape's centre, scaled to `width` CSS px,
      // outline `strokePx` wide whatever the scale, drawn at `layer`.
      const owned = []; // geometries to dispose
      function makeSprite(name, width, strokePx, layer) {
        const s = parsed[name];
        const scale = width / s.w;
        const pivot = new THREE.Group();
        const art = new THREE.Group();
        art.scale.set(scale, -scale, 1); // SVG y points down, three's points up
        art.position.set((-s.w / 2) * scale, (s.h / 2) * scale, 0);
        if (s.fillGeo) {
          const fill = new THREE.Mesh(s.fillGeo, fillMat);
          fill.renderOrder = layer;
          art.add(fill);
        }
        const style = SVGLoader.getStrokeStyle(strokePx / scale, SKETCH, "round", "round");
        for (const p of s.shapePaths) {
          for (const sub of p.subPaths) {
            const geo = SVGLoader.pointsToStroke(sub.getPoints(24), style);
            if (!geo) continue;
            owned.push(geo);
            const line = new THREE.Mesh(geo, strokeMat);
            line.renderOrder = layer + 1;
            art.add(line);
          }
        }
        pivot.add(art);
        return pivot;
      }

      // ---- the trail: short dashes that fade out ----
      const dashGeo = new THREE.PlaneGeometry(1, 1);
      const dashes = [];
      const DASH_LIFE = 2.4; // seconds

      function spawnDash(x, y, angle, len, thick) {
        let d = dashes.find((it) => !it.alive);
        if (!d) {
          if (dashes.length >= 160) return;
          const mesh = new THREE.Mesh(dashGeo, mat(SKETCH, 0.9));
          mesh.renderOrder = LAYER_TRAIL;
          scene.add(mesh);
          d = { mesh, alive: false, age: 0 };
          dashes.push(d);
        }
        d.alive = true;
        d.age = 0;
        d.mesh.visible = true;
        d.mesh.position.set(x, -y, 0);
        d.mesh.rotation.z = -angle;
        d.mesh.scale.set(len, thick, 1);
        d.mesh.material.opacity = 0.9;
      }

      // ---- layout ----
      let W = 1;
      let H = 1;
      let world = null; // { sun, clouds[], plane }

      function measure() {
        const hr = hero.getBoundingClientRect();
        const rel = (el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top - hr.top, bottom: r.bottom - hr.top, left: r.left - hr.left, right: r.right - hr.left, h: r.height };
        };
        const nav = rel(hero.querySelector("[data-sky-nav]"));
        const text = rel(hero.querySelector("[data-sky-avoid]"));
        const groundEl = [...hero.querySelectorAll("[data-sky-ground]")].find((el) => el.getBoundingClientRect().height > 0);
        const ground = groundEl ? rel(groundEl) : { top: hr.height, h: 0 };
        const groundTop = ground.top + ground.h * Number(groundEl?.dataset.topFraction || 0);
        return {
          W: hr.width,
          H: hr.height,
          navBottom: nav.bottom,
          groundTop,
          top: [nav.bottom + 8, text.top - 12],
          bottom: [text.bottom + 16, groundTop - 6],
          text,
        };
      }

      function clearWorld() {
        if (!world) return;
        for (const o of [world.sun, world.plane.pivot, ...world.clouds.map((c) => c.pivot)]) {
          if (o) scene.remove(o);
        }
        for (const d of dashes) {
          d.alive = false;
          d.mesh.visible = false;
        }
      }

      function build() {
        clearWorld();
        const m = measure();
        W = m.W;
        H = m.H;
        renderer.setSize(W, H, false);
        renderer.domElement.style.width = `${W}px`;
        renderer.domElement.style.height = `${H}px`;
        camera.left = 0;
        camera.right = W;
        camera.top = 0;
        camera.bottom = -H;
        camera.updateProjectionMatrix();

        const wide = W >= 1024;
        const laneH = (l) => Math.max(0, l[1] - l[0]);
        const clouds = [];
        let layer = LAYER_CLOUDS;

        // Drifting clouds, right across the clear bands, wrapping at the edges.
        const drift = (lane, frac, width, speed, startX) => {
          if (laneH(lane) < width * 0.4 + 10) return;
          const pivot = makeSprite("cloud", width, 1.3, (layer += 2));
          scene.add(pivot);
          clouds.push({ pivot, kind: "drift", w: width, speed, x: startX, y: lane[0] + laneH(lane) * frac });
        };
        // Clouds that bob in place beside the headline (wide screens only).
        const bob = (x, y, width, period, phase) => {
          const pivot = makeSprite("cloud", width, 1.25, (layer += 2));
          scene.add(pivot);
          clouds.push({ pivot, kind: "bob", w: width, bx: x, by: y, amp: 26 + width * 0.25, period, phase });
        };

        if (wide) {
          drift(m.top, 0.2, 86, 11, W * 0.62);
          drift(m.top, 0.72, 54, 16, W * 0.12);
          drift(m.bottom, 0.4, 70, 9, W * 0.35);
          const leftW = m.text.left;
          const rightW = W - m.text.right;
          const th = m.text.bottom - m.text.top;
          if (leftW > 170) {
            bob(leftW * 0.55, m.text.top + th * 0.25, 96, 26, 0);
            bob(leftW * 0.28, m.text.top + th * 0.5, 60, 21, 1.7);
          }
          if (rightW > 170) {
            bob(m.text.right + rightW * 0.32, m.text.top + th * 0.12, 108, 29, 0.8);
            bob(m.text.right + rightW * 0.64, m.text.top + th * 0.4, 56, 23, 2.4);
          }
        } else {
          drift(m.top, 0.25, 58, 7, W * 0.08);
          drift(m.top, 0.8, 38, 10, W * 0.72);
          drift(m.bottom, 0.55, 70, 6, W * 0.62);
        }

        // Sun: centred in the top band, behind everything.
        let sun = null;
        if (laneH(m.top) >= 44) {
          const size = wide ? 56 : 48;
          sun = makeSprite("sun", size, 1.3, LAYER_SUN);
          sun.position.set(W / 2, -(m.top[0] + laneH(m.top) * 0.5), 0);
          scene.add(sun);
        }

        // Plane: one straight climb at 45°, up and to the right. The line runs
        // through a point just off the headline's top-left corner, so below
        // the headline's top it stays left of the words. The flight starts and
        // ends a plane's length outside the hero, so it never pops in or out:
        // it comes in from the left or bottom edge and leaves by the top or right.
        const planeW = wide ? 56 : 44;
        // Below 1024px the headline's box is wider than its centred words, so
        // aim inside the box: that clears the words and passes between the
        // wordmark and the sun instead of behind the wordmark.
        const ax = wide ? m.text.left - 48 : m.text.left + 40;
        const ay = m.text.top - 8;
        const out = planeW;
        const plane = {
          pivot: makeSprite("plane", planeW, 1.2, LAYER_PLANE),
          w: planeW,
          // t: px travelled along x from the anchor; y falls as fast as x rises.
          ax,
          ay,
          t0: Math.max(-out - ax, ay - H - out),
          t1: Math.min(W + out - ax, ay + out),
          t: 0,
          rest: 0, // seconds left before the next flight
          speed: (wide ? 95 : 60) / Math.SQRT2, // 95 / 60 px per second along the climb
          dist: 0,
          dashLen: wide ? 7 : 6,
          dashThick: wide ? 1.5 : 1.3,
          gap: wide ? 13 : 11,
        };
        // Open on a plane already partway up, rather than an empty sky.
        plane.t = plane.t0 + (plane.t1 - plane.t0) * 0.35;
        plane.pivot.rotation.z = Math.PI / 4; // nose up and to the right
        scene.add(plane.pivot);

        world = { sun, clouds, plane };
      }

      // ---- animation ----
      let t = 0;

      function step(dt) {
        t += dt;
        const { sun, clouds, plane: p } = world;

        if (sun) sun.rotation.z = -t * 0.05;

        for (const c of clouds) {
          if (c.kind === "drift") {
            c.x += c.speed * dt;
            if (c.x - c.w / 2 > W) c.x = -c.w / 2 - Math.random() * 60;
            c.pivot.position.set(c.x, -c.y, 0);
          } else {
            const a = TAU * (t / c.period) + c.phase;
            c.pivot.position.set(c.bx + c.amp * Math.sin(a), -(c.by + 3 * Math.sin(a * 1.7)), 0);
          }
        }

        // Plane: climb along the line; once it's off the edge, wait a moment
        // (long enough for most of the trail to fade), then start again.
        if (p.rest > 0) {
          p.rest -= dt;
          if (p.rest <= 0) {
            p.t = p.t0;
            p.dist = 0;
          }
        } else {
          p.t += p.speed * dt;
          if (p.t >= p.t1) p.rest = PLANE_REST;
          const x = p.ax + p.t;
          const y = p.ay - p.t;
          p.pivot.position.set(x, -y, 0);

          // Drop a dash every `gap` px travelled, just behind the tail.
          p.dist += p.speed * dt * Math.SQRT2;
          while (p.dist >= p.gap) {
            p.dist -= p.gap;
            spawnDash(x - p.w * 0.55 * Math.SQRT1_2, y + p.w * 0.55 * Math.SQRT1_2, -Math.PI / 4, p.dashLen, p.dashThick);
          }
        }

        for (const d of dashes) {
          if (!d.alive) continue;
          d.age += dt;
          if (d.age >= DASH_LIFE) {
            d.alive = false;
            d.mesh.visible = false;
          } else {
            d.mesh.material.opacity = 0.9 * (1 - d.age / DASH_LIFE);
          }
        }
      }

      let raf = 0;
      let last = 0;
      let running = false;
      let onScreen = true;

      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000 || 0);
        last = now;
        step(dt);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }
      function start() {
        if (running || !onScreen || document.hidden) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
      function stop() {
        running = false;
        cancelAnimationFrame(raf);
      }

      build();
      step(0);
      renderer.render(scene, camera);
      hero.dataset.sky = "live"; // hides the static SVG sky
      host.classList.add(styles.live);

      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen ? start() : stop();
      });
      io.observe(hero);

      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);

      let resizeTimer = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          build();
          renderer.render(scene, camera);
        }, 120);
      });
      ro.observe(hero);

      start();

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        clearTimeout(resizeTimer);
        document.removeEventListener("visibilitychange", onVisibility);
        for (const d of dashes) d.mesh.material.dispose();
        for (const g of owned) g.dispose();
        for (const s of Object.values(parsed)) s.fillGeo?.dispose();
        dashGeo.dispose();
        fillMat.dispose();
        strokeMat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        delete hero.dataset.sky;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className={styles.sky} aria-hidden="true" />;
}
