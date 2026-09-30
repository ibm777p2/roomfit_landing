// Everything a non-developer might want to change lives here: links, names,
// the neighbourhood list. Components read from this file rather than
// hard-coding copy.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.joinroomfit.com";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://joinroomfit.com";

export const CONTACT_EMAIL = "hello@joinroomfit.com";

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

// Stored in the waitlist table's `role` column. Labels are what visitors see.
export const ROLES = [
  { value: "looking", label: "Looking" },
  { value: "listing", label: "Listing" },
  { value: "both", label: "Both" },
];

// The example receipt. Each bar takes the ramp colour of its own ratio:
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

// Team. A link or photo left as null is simply not shown, so a missing URL
// never turns into a dead link on the live page.
export const TEAM = [
  {
    name: "Ni Ni",
    role: "Founder",
    initials: "NN",
    photo: null,
    links: [{ label: "GitHub", href: "https://github.com/ninitwin4" }],
  },
  {
    name: "Vincent L.",
    role: "Co-founder",
    initials: "VL",
    photo: null,
    links: [], // add { label: "LinkedIn", href: "https://..." } when ready
  },
];

// The founder video. Leave null to show the placeholder with a play button.
// Later: a YouTube video ID, e.g. "dQw4w9WgXcQ".
export const FOUNDER_VIDEO_ID = null;
