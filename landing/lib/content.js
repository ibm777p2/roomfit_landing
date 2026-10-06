// Everything a non-developer might want to change lives here: links, names,
// the neighbourhood list. Components read from this file rather than
// hard-coding copy.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.joinroomfit.com";
// The app opened on its My listings tab. A query, not a path: the app is a
// single page, and app.joinroomfit.com/listings would be a 404.
export const LIST_ROOM_URL = `${APP_URL}/?view=listings`;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://joinroomfit.com";

// The pills on the join form. "Somewhere else" catches everyone outside these,
// so nobody is turned away for living in the wrong place.
export const NEIGHBORHOODS = [
  "SoMa",
  "Mission",
  "Castro",
  "Sunset",
  "Richmond",
  "Nob Hill",
  "Haight",
  "Noe Valley",
  "Marina",
  "Dogpatch",
  "Hayes Valley",
  "North Beach",
  "Pacific Heights",
  "Potrero Hill",
  "Bernal Heights",
  "Russian Hill",
];
export const ELSEWHERE = "Somewhere else";

// How many neighbourhoods one sign-up can pick. The database enforces the same
// limit (supabase/14_waitlist_neighborhoods.sql); change both together.
export const MAX_NEIGHBORHOODS = 3;

// Stored in the waitlist table's `role` column. Labels are what visitors see.
export const ROLES = [
  { value: "looking", label: "Looking" },
  { value: "listing", label: "Listing" },
  { value: "both", label: "Both" },
];

// The "how it works" demo in the receipt section: a pointer sets these
// preferences, presses Find my fit, and these three rooms come back. The
// scores are what the real ranking engine (backend/ranking.py) gives these
// rooms for these preferences, so the demo never claims more than the app does.
// Photos are from the app's own sample listings in Supabase — never real
// users' listings.
const PHOTOS = "https://nmmbktcqjznwdddwqxad.supabase.co/storage/v1/object/public/room-photos";

export const DEMO = {
  prefs: { budget: 1500, area: "SoMa", tidy: 3, social: 3, sleep: "late" },
  results: [
    { title: "SoMa private room", meta: "$1,000/mo · SoMa", score: 89, photo: `${PHOTOS}/P7.jpg` },
    { title: "Sunny room in a Mission flat", meta: "$1,200/mo · Mission", score: 76, photo: `${PHOTOS}/P3.jpg` },
    { title: "Quiet Sunset room", meta: "$900/mo · Sunset", score: 56, photo: `${PHOTOS}/P1.jpg` },
  ],
};

// The example receipt — the top result above. Each bar takes the ramp colour of its own ratio:
// 75%+ is fit-high, 50–74% fit-mid, under 50% fit-low.
export const EXAMPLE_MATCH = {
  title: "SoMa private room",
  meta: "$1,000/mo · SoMa",
  total: 89,
  factors: [
    { label: "Budget fit", score: 20, reason: "$1,000, comfortably under, $500 a month left over" },
    { label: "Location", score: 20, reason: "Same area, SoMa" },
    { label: "Cleanliness", score: 15, reason: "Off by 1 (room 4/5 vs your 3/5)" },
    { label: "Social level", score: 20, reason: "Matches (3/5)" },
    { label: "Sleep schedule", score: 14, reason: "Flexible schedule, compatible" },
  ],
};

// Team. A site or photo left as null is simply not shown, so a missing URL
// never turns into a dead link on the live page. Photos are square, cropped on
// the face, in public/img/.
export const TEAM = [
  {
    name: "Ni Ni",
    role: "Founder",
    initials: "NN",
    photo: "/img/team-nini.jpg",
    site: "https://ninitinwin.com/",
  },
  {
    name: "Vincent L.",
    role: "Co-founder",
    initials: "VL",
    photo: "/img/team-vincent.jpg",
    site: "https://vincentlai.web.app/",
  },
];

// The founder video: the ID from its YouTube link (youtube.com/watch?v=<ID>).
// Set to null to show the placeholder with a play button instead.
export const FOUNDER_VIDEO_ID = "NDwgZKqwwfQ";
