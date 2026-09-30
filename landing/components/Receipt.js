import ReceiptDemo from "./ReceiptDemo";
import styles from "./Receipt.module.css";

// The pine section: what the receipt is (left), and a short demo of getting
// one (right) — set preferences, Find my fit, open the top room's receipt.

export default function Receipt() {
  return (
    <section id="fit-receipt" className={styles.section} aria-labelledby="receipt-title">
      <div className={`wrap ${styles.grid}`}>
        <div className={`${styles.text} reveal`}>
          <div className={styles.icon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </div>
          <h2 id="receipt-title" className={styles.title}>
            Every match comes with a receipt.
          </h2>
          <p className={styles.body}>
            Five factors, each scored and explained. See exactly why a room ranked where it did, not
            just a number.
          </p>
          <p className={styles.body}>
            Listing a room? Anyone who messages you has already been scored against it.
          </p>
        </div>

        <ReceiptDemo />
      </div>
    </section>
  );
}
