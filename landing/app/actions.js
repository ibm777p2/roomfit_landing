"use server";

import { createClient } from "@supabase/supabase-js";
import { NEIGHBORHOODS, ELSEWHERE, MAX_NEIGHBORHOODS, ROLES } from "@/lib/content";

// The waitlist form posts here. It runs on the server only, so the Supabase
// key never ships to the browser (it's a public key anyway: the table is
// closed, and join_waitlist() is the one way in — see supabase/13_waitlist.sql).
//
// Every outcome the visitor can see is one of: success, invalid (with a
// message per field), or error. A repeat sign-up is a success, so the form
// never reveals whether an email is already on the list.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function joinWaitlist(_prev, formData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  // One form field per ticked pill. Deduped here so a replayed or hand-built
  // request can't count one neighbourhood twice toward the limit.
  const neighborhoods = [...new Set(formData.getAll("neighborhood").map(String))];

  // Spam trap: a field people never see. Bots fill it in; pretend it worked.
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success", name, neighborhoods };
  }

  const errors = {};
  if (!name) errors.name = "Add your name.";
  else if (name.length > 80) errors.name = "That name is too long. Keep it under 80 characters.";
  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  if (!ROLES.some((r) => r.value === role)) errors.role = "Choose Looking, Listing or Both.";
  const allowed = [...NEIGHBORHOODS, ELSEWHERE];
  if (!neighborhoods.length) errors.neighborhood = "Pick at least one neighborhood.";
  else if (neighborhoods.length > MAX_NEIGHBORHOODS)
    errors.neighborhood = `Pick up to ${MAX_NEIGHBORHOODS} neighborhoods.`;
  else if (!neighborhoods.every((n) => allowed.includes(n))) errors.neighborhood = "Pick from the list.";
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[waitlist] SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set");
    return { status: "error" };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.rpc("join_waitlist", {
    p_name: name,
    p_email: email,
    p_role: role,
    p_neighborhoods: neighborhoods,
  });

  if (error) {
    console.error("[waitlist] join_waitlist failed:", error.message);
    return { status: "error" };
  }
  return { status: "success", name, neighborhoods };
}
