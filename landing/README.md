# landing/

The roomfit landing page for joinroomfit.com. It will be built in Next.js as a
separate Vercel project, deployed from this folder (root directory `landing/`).
It is not the app: the app is the Vite project in `frontend/`, live at
app.joinroomfit.com, and nothing here changes it.

Nothing is built yet. For now this folder is the design handoff.

| Path | What |
|---|---|
| `design-system/roomfit-design-spec.pdf` | Colours, type, shape and rules from the live app. Its values win over everything else. |
| `DESIGN_SPEC.md` | Source of truth for copy, behaviour and data. Also holds the build plan and open decisions. |
| `design/` | The Claude Design HTML export, as visual reference |
| `design/screenshots/` | Section screenshots, desktop and mobile |
| `assets/` | Images for the build (to come) |

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
