# landing/

The roomfit landing page for joinroomfit.com: a Next.js site, deployed as its
own Vercel project from this folder (root directory `landing/`). It is not the
app: the app is the Vite project in `frontend/`, live at app.joinroomfit.com,
and nothing here changes it.

**Stage:** built and in review (PR #3). The preview runs at
roomfit-landing-six.vercel.app; joinroomfit.com still redirects to the app until
the domain moves to this project.

| Path | What |
|---|---|
| `app/` | Next.js App Router: `page.js`, `layout.js` (fonts, SEO), `globals.css` (tokens), `actions.js` (waitlist server action) |
| `components/` | One file per section, plus `Sky.js` (the three.js hero sky) |
| `lib/content.js` | Links, team, neighbourhood list, example receipt — edit copy here |
| `public/img/` | Skylines and room photos, copied from `design/assets/` |
| `design-system/roomfit-design-spec.pdf` | Colours, type, shape and rules from the live app. Its values win over everything else. |
| `DESIGN_SPEC.md` | The original handoff spec: copy, behaviour, data, build plan |
| `design/` | The Claude Design HTML export, as visual reference |

## Running it

```bash
cd landing
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:3000
```

The waitlist needs `supabase/13_waitlist.sql` on the database (it is on the
live project). Sign-ups are read in the Supabase dashboard: Table Editor →
`waitlist`.

## Deploying

A separate Vercel project, **Root Directory `landing`**, production branch
`main`. Environment variables (Production, Preview and Development):

| Name | Value |
|---|---|
| `SUPABASE_URL` | the RoomFit project URL |
| `SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) — never the service role key |
| `NEXT_PUBLIC_APP_URL` | `https://app.joinroomfit.com` |
| `NEXT_PUBLIC_SITE_URL` | this site's address (`https://joinroomfit.com` once the domain is attached) |

`vercel.json` skips the build when a push doesn't touch `landing/`, so app-only
commits don't redeploy the landing page.

## Where this build departs from DESIGN_SPEC.md

Decided by Vincent; flagged here so the spec and the build can be reconciled.

- **Hero motion uses three.js**, not Motion: drifting clouds, a plane that
  climbs and dips with a fading dashed trail, a slowly turning sun. It stays in
  the clear sky around the headline, pauses off screen, and is static under
  reduced motion. Everything else animates with CSS.
- **Join form:** no neighbourhood dropdown — the pills are the only choice, and
  sit above the button. A **Name** field is added. "Somewhere else" joins
  the pills. No "Opening soon" label; all pills look alike until chosen. The
  button reads **Join the waitlist**.
- **Waitlist table:** roles are `looking` / `listing` / `both`, it has a `name`,
  one row per email (a repeat sign-up updates it), and inserts go through
  `join_waitlist()` from the server — see `supabase/13_waitlist.sql`.
- **Founder video:** the placeholder (poster + play button) shows until
  `FOUNDER_VIDEO_ID` is set in `lib/content.js`.
- **Team:** Vincent L., Co-founder. Links and photos not provided yet are left
  out rather than shown as dead links.
- **Fit receipt:** a 17-second looping "how it works" demo (set preferences,
  Find my fit, open the top room's receipt) instead of a one-time fill. It is
  labelled Example.
- **Footer:** no GitHub link.

## Viewing the design

Open either file in `design/` in a browser:

- `RoomFit Landing Desktop.dc.html`
- `RoomFit Landing Mobile.dc.html`

Double-clicking works; no server needed. Keep `support.js`, `image-slot.js` and
`design/assets/` beside them, because the export loads them by relative path.

## Which one wins

**`DESIGN_SPEC.md` wins over the HTML export on copy, behaviour and data.** Use
the export for layout, spacing and illustration. It uses fixed pixel widths and
inline styles, so rebuild it responsively rather than copying it.

## Build plan and open decisions

Both are at the end of `DESIGN_SPEC.md`: an eight-PR build plan, one section per
PR, and the decisions still open. Agree the waitlist data contract (also in the
spec) before splitting the work.

## Changing the design

Ni Ni owns design changes. Edits happen in Claude Design and get re-exported into
`design/`. Don't edit the export by hand; the next export overwrites it.
