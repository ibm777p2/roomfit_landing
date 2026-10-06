import Image from "next/image";
import CountUp from "./CountUp";
import { APP_URL } from "@/lib/content";
import styles from "./Problem.module.css";

// Two rows, zigzag on wide screens: the seeker's problem, then the lister's.
// On phones each row stacks: text first, then the picture.

export default function Problem() {
  return (
    <section id="problem" className={styles.problem} aria-label="The problem">
      <div className={`wrap ${styles.rows}`}>
        {/* ---- seeker ---- */}
        <div className={styles.row}>
          <div className={`${styles.text} reveal`}>
            <h2 className={styles.statHead}>
              <span className={styles.stat}>
                <CountUp to={250} suffix="+" />
              </span>
              room posts a day. Endless scrolling, no filters, and a stranger behind every one.
            </h2>
            <p className={styles.body}>
              A one-bedroom in SF runs $3,750, so most of us share, and every listing is a stranger
              you have to guess about.
            </p>
            <a className={`btn ${styles.cta}`} href={APP_URL}>
              Find a room that fits
            </a>
          </div>

          <div className={`${styles.visual} ${styles.visualSeeker}`}>
            <div className={`${styles.circle} ${styles.circleRight} reveal`}>
              <Image
                src="/img/room-bedroom.jpg"
                alt="Bedroom with a gallery wall and green curtains"
                fill
                sizes="(min-width: 1024px) 440px, 260px"
                style={{ objectFit: "cover", objectPosition: "30% 50%" }}
              />
            </div>
            <div className={`${styles.groupsWrap} reveal`} style={{ "--reveal-delay": "150ms" }}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>SF housing groups</span>
                  <span className={styles.mono}>San Francisco</span>
                </div>
                <div className={styles.groupRow}>
                  <div className={styles.groupName}>One group</div>
                  <div className={styles.mono}>106K members · 90+ posts a day</div>
                </div>
                <div className={styles.groupRow}>
                  <div className={styles.groupName}>Another</div>
                  <div className={styles.mono}>101K members · 20+ posts a day</div>
                </div>
              </div>
              <p className={styles.source}>
                Public SF housing groups, Sept 2026 ·{" "}
                <span className={styles.keep}>Rent: Apartment List, 2026</span>
              </p>
            </div>
          </div>
        </div>

        {/* ---- lister ---- */}
        <div className={`${styles.row} ${styles.rowFlip}`}>
          <div className={`${styles.text} reveal`}>
            <h2 className={styles.head}>An empty room means paying two rents.</h2>
            <p className={styles.body}>
              It took me 4–5 weeks to find a replacement, and whoever I found still had to pass the
              landlord and the housemates.
            </p>
            <a className={`btn ${styles.cta}`} href={APP_URL}>
              List your room
            </a>
          </div>

          <div className={`${styles.visual} ${styles.visualLister}`}>
            <div className={`${styles.circle} ${styles.circleLeft} reveal`}>
              <Image
                src="/img/room-empty-large.jpg"
                alt="Empty carpeted bedroom with a large window"
                fill
                sizes="(min-width: 1024px) 440px, 260px"
                style={{ objectFit: "cover", objectPosition: "62% 50%" }}
              />
            </div>
            <div className={`${styles.chip} reveal`} style={{ "--reveal-delay": "120ms" }}>
              <span className={styles.chipNum}>4–5 weeks</span>
              <span className={styles.chipLabel}>to fill a room</span>
            </div>
            <div className={`${styles.listing} reveal`} style={{ "--reveal-delay": "220ms" }}>
              <div className={styles.thumb}>
                <Image
                  src="/img/room-empty-small.jpg"
                  alt="Empty bedroom with a large window onto trees"
                  fill
                  sizes="120px"
                  style={{ objectFit: "cover", objectPosition: "70% 50%" }}
                />
              </div>
              <div className={styles.listingText}>
                <div className={styles.listingTitle}>Room in the Inner Sunset</div>
                <div className={styles.monoMeta}>$1,650/mo · Inner Sunset</div>
                <div className={styles.listingNote}>Listed 5 weeks ago · still empty</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
