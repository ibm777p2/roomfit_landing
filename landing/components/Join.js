"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { joinWaitlist } from "@/app/actions";
import { ROLE_EVENT } from "./JoinLink";
import { NEIGHBORHOODS, ELSEWHERE, ROLES, SITE_URL } from "@/lib/content";
import styles from "./Join.module.css";

// The waitlist form: I'm (Looking / Listing / Both) → First name → Email →
// neighbourhood pills → Join the waitlist. The pills sit above the button so
// the form reads top to bottom and nobody submits before choosing.
//
// Every field is controlled, so nothing typed is lost if the server says no.

const ROLE_ALIASES = { seeker: "looking", lister: "listing" };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Join() {
  const [role, setRole] = useState("looking");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hood, setHood] = useState("");
  const [clientErrors, setClientErrors] = useState({});
  const [state, formAction, pending] = useActionState(joinWaitlist, { status: "idle" });
  const successRef = useRef(null);

  // "Find a room that fits" / "List your room" pick the role on their way here,
  // and so does a link like /?role=listing#join.
  useEffect(() => {
    const onRole = (e) => setRole(ROLE_ALIASES[e.detail] || e.detail);
    window.addEventListener(ROLE_EVENT, onRole);
    const fromUrl = new URLSearchParams(window.location.search).get("role");
    const r = ROLE_ALIASES[fromUrl] || fromUrl;
    if (ROLES.some((x) => x.value === r)) setRole(r);
    return () => window.removeEventListener(ROLE_EVENT, onRole);
  }, []);

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
  }, [state.status]);

  const errors = { ...(state.status === "invalid" ? state.errors : {}), ...clientErrors };

  function onSubmit(e) {
    // Quick checks in the browser; the server checks everything again.
    const next = {};
    if (!name.trim()) next.name = "Add your first name.";
    if (!EMAIL.test(email.trim())) next.email = "Enter a valid email address.";
    if (!hood) next.neighborhood = "Pick a neighborhood.";
    setClientErrors(next);
    if (Object.keys(next).length) e.preventDefault();
  }

  const clear = (field) => setClientErrors(({ [field]: _, ...rest }) => rest);

  return (
    <section id="join" className={styles.section} aria-labelledby="join-title">
      <div className={`wrap ${styles.grid}`}>
        <div className={`${styles.intro} reveal`}>
          <h2 id="join-title" className={styles.title} tabIndex={-1} data-join-focus>
            Bring roomfit to your neighborhood.
          </h2>
          <p className={styles.sub}>
            We're opening neighborhood by neighborhood, the ones with the most sign-ups go first.
          </p>
        </div>

        <div className={`${styles.card} reveal`} style={{ "--reveal-delay": "120ms" }}>
          {state.status === "success" ? (
            <Success refEl={successRef} name={state.name} hood={state.neighborhood} />
          ) : (
            <form action={formAction} onSubmit={onSubmit} noValidate className={styles.form}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>I'm</legend>
                <div className={styles.segmented}>
                  {ROLES.map((r) => (
                    <label key={r.value} className={`${styles.segment} ${role === r.value ? styles.segmentOn : ""}`}>
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.field}>
                <label htmlFor="join-name" className={styles.label}>
                  First name
                </label>
                <input
                  id="join-name"
                  name="name"
                  type="text"
                  autoComplete="given-name"
                  maxLength={80}
                  placeholder="Alex"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clear("name");
                  }}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "join-name-err" : undefined}
                  className={styles.input}
                />
                {errors.name && (
                  <p id="join-name-err" className={styles.error}>
                    {errors.name}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="join-email" className={styles.label}>
                  Email
                </label>
                <input
                  id="join-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clear("email");
                  }}
                  aria-invalid={!!errors.email}
                  aria-describedby={`join-email-help${errors.email ? " join-email-err" : ""}`}
                  className={styles.input}
                />
                {errors.email && (
                  <p id="join-email-err" className={styles.error}>
                    {errors.email}
                  </p>
                )}
                <p id="join-email-help" className={styles.help}>
                  We'll email you when roomfit opens near you. Nothing else.
                </p>
              </div>

              <fieldset
                className={styles.fieldset}
                aria-describedby={errors.neighborhood ? "join-hood-err" : undefined}
              >
                <legend className={styles.label}>Pick your neighborhood</legend>
                <div className={styles.pills}>
                  {[...NEIGHBORHOODS, ELSEWHERE].map((n) => (
                    <label key={n} className={`${styles.pill} ${hood === n ? styles.pillOn : ""}`}>
                      <input
                        type="radio"
                        name="neighborhood"
                        value={n}
                        checked={hood === n}
                        onChange={() => {
                          setHood(n);
                          clear("neighborhood");
                        }}
                      />
                      {n}
                    </label>
                  ))}
                </div>
                {errors.neighborhood && (
                  <p id="join-hood-err" className={styles.error}>
                    {errors.neighborhood}
                  </p>
                )}
              </fieldset>

              {/* spam trap: hidden from people and screen readers */}
              <div className={styles.trap} aria-hidden="true">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>

              <button type="submit" className={`btn ${styles.submit}`} disabled={pending}>
                {pending ? "Joining…" : "Join the waitlist"}
              </button>

              <p className={styles.status} role="status" aria-live="polite">
                {state.status === "error" && !pending ? "Something went wrong. Please try again." : ""}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Success({ refEl, name, hood }) {
  const [copied, setCopied] = useState(false);
  const where = hood && hood !== ELSEWHERE ? hood : null;

  async function share() {
    const data = {
      title: "roomfit",
      text: "Rooms ranked by how you actually live, with the reason for every score.",
      url: SITE_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
    } catch {
      /* share sheet dismissed — nothing to do */
    }
  }

  return (
    <div className={styles.success}>
      <h3 ref={refEl} tabIndex={-1} className={styles.successTitle}>
        You're on the list{name ? `, ${name}` : ""}.
      </h3>
      <p className={styles.successBody}>
        {where
          ? `${where} is on the list. We'll email you when roomfit opens there.`
          : "We'll email you when roomfit opens near you."}
      </p>
      <button type="button" className={styles.share} onClick={share}>
        {copied ? "Link copied" : "Share with someone looking"}
      </button>
    </div>
  );
}
