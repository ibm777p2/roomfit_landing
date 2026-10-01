import { TEAM, FOUNDER_VIDEO_ID, CONTACT_EMAIL } from "@/lib/content";
import styles from "./Founder.module.css";

// Founder note, team, and the page's closing line.
// The video block is a placeholder for now: a box with a play button that does
// nothing. When FOUNDER_VIDEO_ID is set in lib/content.js it becomes a YouTube
// embed (privacy-enhanced domain, loaded only when this section renders).

const ICONS = {
  LinkedIn: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z" />
    </svg>
  ),
  GitHub: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  Link: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  ),
};

function Video() {
  if (FOUNDER_VIDEO_ID) {
    return (
      <iframe
        className={styles.embed}
        src={`https://www.youtube-nocookie.com/embed/${FOUNDER_VIDEO_ID}`}
        title="Why I'm building roomfit"
        loading="lazy"
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
          <span className={styles.caption}>Why I'm building roomfit · 90 sec</span>
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
              </div>
              {person.links.length > 0 && (
                <div className={styles.links}>
                  {person.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className={styles.iconLink}
                      aria-label={`${person.name} on ${l.label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ICONS[l.label] || ICONS.Link}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </article>

      <footer className={styles.footer}>
        <span>roomfit is in beta, built in San Francisco.</span>
        <span className={styles.footerLinks}>
          <a className="textlink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </span>
      </footer>
    </section>
  );
}
