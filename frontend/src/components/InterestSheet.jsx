import { useState } from "react";
import {
  expressInterest,
  INTEREST_NOTE_DEFAULT,
  INTEREST_NOTE_MAX,
} from "../supabase.js";

// "I'm interested" on a room whose host isn't on RoomFit yet. The note is what
// the host reads first: it's quoted in the email that invites them, and becomes
// this person's opening message once they claim the room. The promise stays
// modest on purpose — the host may never claim it.
export default function InterestSheet({ room, onClose, onSent }) {
  const [note, setNote] = useState(INTEREST_NOTE_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await expressInterest(room.id, note); // "already" reads the same to them
      setDone(true);
      onSent(room.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="I'm interested in this room"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <button
            type="button"
            className="sheet-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
          <span className="sheet-title">I'm interested</span>
          {done ? (
            <span className="sheet-spacer" />
          ) : (
            <button
              type="button"
              className="sheet-save"
              disabled={busy || !note.trim()}
              onClick={send}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          )}
        </div>

        <div className="sheet-body">
          <p className="room-title">{room.title}</p>
          <p className="room-meta interest-meta">
            ${room.rent}/mo · {room.location}
          </p>

          {done ? (
            <div className="interest-done" role="status">
              <p>
                <strong>We've let the host know.</strong>
              </p>
              <p>
                We'll email you as soon as they reply on RoomFit, and your note
                will be waiting for them in your Inbox.
              </p>
              <button type="button" className="submit" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="interest-note">Your note to the host</label>
              <span className="hint">
                The host isn't on RoomFit yet. We'll email them your first name
                and this note, and let you know when they reply.
              </span>
              <textarea
                id="interest-note"
                rows={3}
                value={note}
                maxLength={INTEREST_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
              />
              <span className="char-count">
                {note.length}/{INTEREST_NOTE_MAX}
              </span>
              {error && <p className="auth-error">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
