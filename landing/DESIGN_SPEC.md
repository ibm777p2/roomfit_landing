# roomfit Landing Page — Design Spec

Handoff from Claude Design to Claude Code. Read this before building any section.

## Sources, in order of authority

1. **Design system** — `landing/design-system/roomfit-design-spec.pdf`. Colors, type, shape and rules, taken from the live app. Use its values exactly.
2. **This spec** — copy, behavior, data, motion and honesty rules for the landing page.
3. **Visual reference** — `landing/design/RoomFit Landing Desktop.dc.html` and `landing/design/RoomFit Landing Mobile.dc.html`. Match layout, spacing and illustration.

If the HTML export disagrees with 1 or 2, **1 and 2 win**. The export uses fixed pixel widths and inline styles — rebuild it responsively; don't copy it wholesale.

Build one section per pull request, reviewed against the export.

---

## Project setup

| Item | Decision |
|---|---|
| Framework | Next.js (App Router) — for long-term Google discoverability |
| Styling | Plain CSS: tokens in `app/globals.css`, per-section `*.module.css` |
| Motion | Motion library (formerly Framer Motion) + plain CSS for hovers |
| Data | Supabase — same project as the app, new `waitlist` table |
| Hosting | Separate Vercel project, root directory `landing/` |
| Domain | `joinroomfit.com` → this page |
| App link | `https://app.joinroomfit.com` (the existing Vite app — do not modify it) |

- Keep text server-rendered; only animated or interactive pieces are client components (`"use client"`).
- Env vars use the `NEXT_PUBLIC_` prefix. Never put the Supabase `service_role` key here.
- Ask before adding any dependency beyond Next.js, Motion and `@supabase/supabase-js`.

---

## Design tokens

From the design system. Paste into `app/globals.css`; use the custom properties, never raw hex.

```css
:root {
  /* ground and text */
  --paper: #f4f1e5;       /* page background */
  --surface: #f1ecdb;     /* inputs, small tags */
  --card: #ffffff;        /* cards stay pure white */
  --ink: #191c1a;         /* main text */
  --ink-soft: #646d66;    /* secondary text, 4.5:1 on all three grounds */
  --line: #e3decb;        /* hairlines, decorative */

  /* brand */
  --accent: #2f6f4e;      /* pine, the one brand colour */
  --accent-ink: #ffffff;  /* text on accent */

  /* score ramp: meaning only */
  --fit-high: #2f6f4e;    /* 75%+ */
  --fit-mid: #c08a2e;     /* 50-74%, on white only */
  --fit-low: #a8564a;     /* under 50% */

  /* type */
  --display: "EB Garamond", ui-serif, Georgia, serif;          /* hero + wordmark only */
  --body: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --data: "JetBrains Mono", ui-monospace, monospace;            /* 500 and 700 only */

  /* shape */
  --radius: 14px;         /* cards, panels, notices */
  --radius-sm: 10px;      /* inputs, buttons, tabs, photos in cards */
  --pad: 16px;
  --shadow: 0 1px 2px rgba(20, 30, 25, 0.04), 0 1px 3px rgba(20, 30, 25, 0.06);
}
```

Load fonts with `next/font/google` (EB Garamond 500–700 incl. real italic; Plus Jakarta Sans 400/500/600/700; JetBrains Mono 500/700).

Landing-only values seen in the export (derived, keep as tokens if used): `--paper-deep: #eae5d6` (founder section ground), `--accent-deep: #235a3e` (button hover on pine).

## Design-system rules that apply here

- **One serif moment.** EB Garamond for the hero headline and the wordmark only. Every other heading is Plus Jakarta Sans 700. *(The export sets some headings in Garamond at 21–32px — rebuild those in Plus Jakarta Sans 700.)*
- **One italic word** per display headline — load the real italic.
- **Cream page, white cards.** Anything showing a room, a score or a form sits on a white card.
- **One brand colour.** Pine only. No second hue.
- **Score colours mean a score.** Green/amber/clay only on the receipt — never on stat chips, buttons or decoration.
- **Amber stays on white.** `--fit-mid` only on `--card`.
- **Secondary text is `--ink-soft`.** Don't lighten it.
- **Hairlines are decoration.** Form fields also get the `--surface` fill.
- **Name is lowercase:** roomfit. The export writes "RoomFit" in places — change to roomfit in all visible copy.
- **Voice:** short, plain, second person. No emoji, no exclamation marks. Say "receipt".
- **No icon library.** Use text glyphs (♡ ✕ ↓ →) and text links (e.g. "LinkedIn ↗").
- **Eyebrow labels:** JetBrains Mono 500, 12px, +0.14em, uppercase, `--accent`.
- **Numbers** (rents, scores, stats): JetBrains Mono.

**Landing-page exception:** the design system says "no illustrations; the images are the rooms." The hero's SF line art is a deliberate exception for the landing page only. Keep it thin, low-contrast and in `--line`/`--ink-soft` tones.

---

## Page order

1. Hero `#hero`
2. Problem `#problem`
3. Fit receipt `#fit-receipt`
4. Join `#join`
5. Founder + team `#founder`

*(How it works and footer: see open decisions.)*

---

## 1. Hero

**Layout** — desktop: everything centered; nav top; headline, subline and buttons in the sky; skyline full-width at the bottom. Mobile: text above the skyline; crop the skyline rather than shrinking it. Sun, clouds and plane are never covered by text or buttons.

**Illustration:** `landing/design/assets/sf-skyline-desk-1c.svg` (desktop), `landing/design/assets/sf-skyline-draw.svg` (mobile).

**Copy**
- Nav: roomfit wordmark (left) · Try the demo · Join (right)
- Headline (Garamond): Find a room that *fits*.
- Subline: Rooms ranked by how you actually live — with the reason for every score.
- Primary button: **Join roomfit** → `#join`
- Secondary link: **Try the demo →** → `https://app.joinroomfit.com`

**Motion** — plane crosses slowly (~25s, loops); clouds drift at different slow speeds; sun rotates or glows gently; optional skyline draw-in on load (1–2s). Reduced motion: static.

---

## 2. Problem

Zigzag rows; mobile stacks text then visual. Visual: circular-cropped room photo + white card overlapping it + white stat chips. No faces, avatars or star ratings.

### Row 1 — Seeker
- Headline: 250+ room posts a day. Endless scrolling, no filters, and a stranger behind every one.
- Body: A one-bedroom in SF runs $3,750, so most of us share — and every listing is a stranger you have to guess about.
- Card: **SF housing groups** · San Francisco
  - One group · 106K members · 90+ posts a day
  - Another · 101K members · 20+ posts a day
- Footnote: Public SF housing groups, Sept 2026
- Chips (mono numbers, ink — not ramp colours): $3,750 one-bedroom · 250+ posts a day · 2% vacancy
- Button: **Find a room that fits** → `#join?role=seeker`

### Row 2 — Lister
- Headline: An empty room means paying two rents.
- Body: It took me 4–5 weeks to find a replacement — and whoever I found still had to pass the landlord and the housemates.
- Card: a single room listing
- Chip: 4–5 weeks to fill a room
- Button: **List your room** → `#join?role=lister`

**Rules:** never name specific Facebook groups; no Facebook logo, blue or lookalike UI; stats carry a source + date.

**Motion:** chips count up on scroll into view; card slides over the circle. Once.

---

## 3. Fit receipt

**Layout:** full-bleed `--accent` background; photo + white receipt card one side, text the other (`--paper` text on pine). Mobile: text first.

**Receipt card** (white card, per the design system):
- Eyebrow: EXAMPLE MATCH
- Title: SoMa private room · meta: $1,000/mo · SoMa
- Ring: **89** FIT — ring takes the total's ramp colour (fit-high)
- Five factors, 20 points each; **each bar takes the ramp colour of its own ratio**:

  | Factor | Score | Colour | Reason |
  |---|---|---|---|
  | Budget fit | 20/20 | fit-high | $1,000 — comfortably under, $500 a month left over |
  | Location | 20/20 | fit-high | Same area — SoMa |
  | Cleanliness | 15/20 | fit-high | Off by 1 (room 4/5 vs your 3/5) |
  | Social level | 20/20 | fit-high | Matches (3/5) |
  | Sleep schedule | 14/20 | fit-mid | Flexible schedule — compatible |
- No owner name, avatar or Message link.

**Copy**
- Headline: Every match comes with a receipt.
- Body: Five factors, each scored and explained. See exactly why a room ranked where it did — not just a number.
- Second line: Listing a room? Anyone who messages you has already been scored against it.
- Link: **Try the demo →**

**Motion (signature moment):** on scroll into view, ring fills and counts to 89; bars fill top to bottom ~150ms apart; reasons fade in. Once. Reduced motion: finished card.

---

## 4. Join — community + capture (list direction)

Anchor `id="join"`.

**Copy**
- Headline: Bring roomfit to your neighborhood.
- Sub: We're opening neighborhood by neighborhood — the ones with the most sign-ups go first.

**Form** (white card)
- Role: segmented buttons — Looking · Listing · Both. Pre-selected from `?role=seeker|lister`.
- Neighborhood: dropdown of SF neighborhoods + "Other"
- Email
- Under email (small, ink-soft): We'll email you when roomfit opens near you. Nothing else.
- Button: **Join roomfit**

**Neighborhood chips:** tapping one fills the dropdown. **No sign-up counts** until real numbers exist.

**States**
| State | Behavior |
|---|---|
| Idle | Button enabled when email is valid and a neighborhood is chosen |
| Submitting | Disabled, "Joining…" |
| Success | "You're in. {Neighborhood} is on the list." + **Share with someone looking** (native share, fallback: copy link) |
| Duplicate | Same as success — never reveal whether an email already signed up |
| Error | "Something went wrong. Please try again." Keep entered values |

---

## 5. Founder + team

Ground: `--paper-deep`.

**Video:** poster + play button, caption *Why I'm building roomfit*. If no video yet, **omit the block** — no "coming soon". Load the embed only on click.

**Founder note**
- Eyebrow: A NOTE FROM NI NI
- Headline: Why I'm building this
- Body: When I moved to San Francisco, I had no network and no rental history here. I tried Craigslist and nearly got scammed. Facebook groups were the best option — and every listing was a stranger I had to guess about. Later, as the one listing a room, it took 4–5 weeks to find someone. So I'm building the tool I kept wishing existed.
- Sign-off: — Ni Ni, founder

**Team cards:** real photo, name, role, text links ("LinkedIn ↗", "GitHub ↗"). No stock people.

**Trust line:** roomfit is in beta, built in San Francisco. · hello@joinroomfit.com · GitHub (public repo)

---

## Waitlist data contract

Agree this before splitting work.

```sql
create table waitlist (
  id            bigint generated always as identity primary key,
  role          text not null check (role in ('seeker', 'lister', 'both')),
  neighborhood  text not null,
  email         text not null,
  created_at    timestamptz not null default now(),
  unique (email, neighborhood)
);

alter table waitlist enable row level security;

-- Visitors can add a row. Nobody can read rows through the public key.
create policy "anyone can join the waitlist"
  on waitlist for insert
  to anon, authenticated
  with check (true);
```

A unique-constraint error on insert = Duplicate state. Sign-ups are read only in the Supabase dashboard.

---

## SEO

- Title: roomfit — Find a room that fits in San Francisco
- Description: Rooms ranked by how you actually live, with the reason for every score. Join roomfit in your SF neighborhood.
- Open Graph image 1200×630: hero illustration + headline
- One `<h1>` (hero); each section `<h2>`; descriptive alt text

## Accessibility

- All motion respects `prefers-reduced-motion`
- Contrast per the design system; `--paper` on `--accent` for the receipt section
- Visible form labels; errors announced; full keyboard navigation

## Honesty rules

- Receipt labeled EXAMPLE MATCH; the app is called a **demo** (seed data)
- No sign-up counts, testimonials or press logos until real
- Stats carry a source and date
- Never name specific Facebook groups

---

## Open decisions

- [x] Join direction: **list**
- [ ] How it works section: add, or drop (not in the export)
- [ ] Footer: add a minimal one, or drop (not in the export)
- [ ] Founder layout: confirm the exported one is final
- [ ] Teammate name, role, photo, links
- [ ] Video URL (or omit)
- [ ] Room photos confirmed owned or licensed
- [ ] Sources + dates for $3,750, 2% vacancy, 250+ posts a day
- [ ] OG image

## Build plan

| PR | Owner | Scope |
|---|---|---|
| 1 | Backend | `waitlist` table + RLS |
| 2 | Frontend | Next.js project, tokens, fonts, nav, SEO |
| 3 | Frontend | Hero + motion |
| 4 | Frontend | Problem |
| 5 | Frontend | Fit receipt + motion |
| 6 | Frontend | Join form + states (needs PR 1) |
| 7 | Frontend | Founder + team |
| 8 | Either | Deploy, attach `joinroomfit.com`, remove its redirect, phone test |

## Out of scope

- Changes to the app at `app.joinroomfit.com`
- Neighborhood or listing pages for SEO (later)
- Accounts or login on the landing page
