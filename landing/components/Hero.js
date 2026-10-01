import Sky from "./Sky";
import JoinLink from "./JoinLink";
import { APP_URL } from "@/lib/content";
import styles from "./Hero.module.css";

// The sky (sun, clouds, plane) is drawn twice on purpose:
//  - as plain SVG, positioned like the design: this is what shows first, and
//    what stays for reduced motion or a browser without WebGL;
//  - by <Sky/> with three.js, which fades in over it and hides the SVGs once
//    its first frame is on screen.
// The data-sky-* attributes tell <Sky/> where the text and skyline are, so
// nothing it animates ever passes behind the headline or the buttons.

const CLOUD = "M8 24h54a7 7 0 0 0-2-13.6A11 11 0 0 0 39 7a13 13 0 0 0-24 5A6 6 0 0 0 8 24z";

function Cloud({ className }) {
  return (
    <svg className={className} viewBox="0 0 70 26" fill="var(--paper)" stroke="var(--sketch)" strokeWidth="1.3" strokeLinejoin="round">
      <path d={CLOUD} />
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.staticSky} aria-hidden="true">
        <svg className={styles.sun} viewBox="0 0 46 46" fill="none" stroke="var(--sketch)" strokeWidth="1.3" strokeLinecap="round">
          <circle cx="23" cy="23" r="9" />
          <path d="M23 4v5M23 37v5M4 23h5M37 23h5M9.6 9.6l3.5 3.5M32.9 32.9l3.5 3.5M9.6 36.4l3.5-3.5M32.9 13.1l3.5-3.5" />
        </svg>
        <Cloud className={`${styles.cloud} ${styles.cloudA}`} />
        <Cloud className={`${styles.cloud} ${styles.cloudB}`} />
        <Cloud className={`${styles.cloud} ${styles.cloudC}`} />
        <Cloud className={`${styles.cloud} ${styles.cloudD}`} />
        <svg className={styles.plane} viewBox="0 0 44 20" fill="var(--paper)" stroke="var(--sketch)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M3 11h32c4 0 7-1.4 7-3s-3-2-7-2H22L14 1h-3l4 5H8L5 3H2l1.5 5z" />
          <path d="M20 11l-5 7h3l8-7" />
        </svg>
      </div>

      <Sky />

      <div className={styles.ground} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.skylineMobile}
          src="/img/skyline-mobile.svg"
          alt=""
          data-sky-ground
          data-top-fraction="0.08"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.skylineDesktop}
          src="/img/skyline-desktop.svg"
          alt=""
          data-sky-ground
          data-top-fraction="0.4"
        />
      </div>
      <p className="srOnly">
        Line drawing of San Francisco: the Golden Gate Bridge, the Painted Ladies,
        Salesforce Tower, the Transamerica Pyramid and Coit Tower.
      </p>

      <nav className={styles.nav} data-sky-nav>
        <a href="#hero" className={styles.wordmark}>
          roomfit
        </a>
      </nav>

      <div className={styles.content}>
        <div className={styles.copy} data-sky-avoid>
          <h1 id="hero-title" className={styles.title}>
            Find a room
            <br />
            that <em>fits.</em>
          </h1>
          <p className={styles.sub}>
            <span>Rooms ranked by how you actually live</span>{" "}
            <span>with the reason for every score.</span>
          </p>
          <div className={styles.actions}>
            <JoinLink className={`btn ${styles.primary}`}>Join roomfit</JoinLink>
            <a className={`textlink ${styles.demo}`} href={APP_URL}>
              Try the demo →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
