import { TEAM, FOUNDER_VIDEO_ID } from "@/lib/content";
import styles from "./Founder.module.css";

// Founder note, team, and the page's closing line.
// The video is a YouTube embed of FOUNDER_VIDEO_ID (lib/content.js), on the
// privacy-enhanced domain and lazy-loaded, so it's fetched only as the section
// nears the screen. With no ID it falls back to a placeholder: a box with a
// play button that does nothing.

// Each person's website, shown under their name: a globe, the usual sign for
// "website". Drawn inline, so no icon library.
const GLOBE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

function Video() {
  if (FOUNDER_VIDEO_ID) {
    return (
      <iframe
        className={styles.embed}
        src={`https://www.youtube-nocookie.com/embed/${FOUNDER_VIDEO_ID}`}
        title="Why I'm building roomfit"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <div className={styles.poster} aria-hidden="true">
      <div className={styles.play}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
        </svg>
      </div>
    </div>
  );
}

export default function Founder() {
  return (
    <section id="founder" className={styles.section} aria-labelledby="founder-title">
      <article className={`${styles.card} reveal`}>
        <div className={styles.videoWrap}>
          <div className={styles.video}>
            <Video />
          </div>
          <span className={styles.caption}>Why I'm building roomfit</span>
        </div>

        <div className={styles.note}>
          <span className="eyebrow">A note from Ni Ni</span>
          <h2 id="founder-title" className={styles.title}>
            Why I'm building this
          </h2>
          <p className={styles.letter}>
            When I moved to San Francisco, I had no network and no rental history here. I tried
            Craigslist and nearly got scammed. Facebook groups were the best option, and every
            listing was a stranger I had to guess about.
          </p>
          <p className={styles.letter}>
            Later, as the one listing a room, it took 4–5 weeks to find someone. So I'm building
            the tool I kept wishing existed.
          </p>
          <p className={styles.signoff}>— Ni Ni, founder</p>
        </div>

        <ul className={styles.team}>
          {TEAM.map((person) => (
            <li key={person.name} className={styles.person}>
              {person.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.avatar} src={person.photo} alt="" />
              ) : (
                <span className={`${styles.avatar} ${styles.initials}`} aria-hidden="true">
                  {person.initials}
                </span>
              )}
              <div className={styles.who}>
                <span className={styles.name}>{person.name}</span>
                <span className={styles.role}>{person.role}</span>
                {person.site && (
                  <a
                    href={person.site}
                    className={styles.site}
                    aria-label={`${person.name}'s website`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {GLOBE}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </article>

      <footer className={styles.footer}>
        <span>roomfit is in beta, built in San Francisco.</span>
      </footer>
    </section>
  );
}
