"use client";

// A link to the join form that can also pre-select Looking / Listing.
// Clicking it tells <Join/> which role to select (via a window event) and
// scrolls there. Without JavaScript it is still a plain link to #join.
export const ROLE_EVENT = "roomfit:join-role";

export default function JoinLink({ role, className, children }) {
  function onClick(e) {
    const target = document.getElementById("join");
    if (!target) return;
    e.preventDefault();
    if (role) window.dispatchEvent(new CustomEvent(ROLE_EVENT, { detail: role }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#join");
    // Move keyboard focus to the form so tabbing continues from there.
    const first = target.querySelector("[data-join-focus]");
    if (first) first.focus({ preventScroll: true });
  }

  return (
    <a href="#join" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
