// Authority age counter for Great Divide Hotshot.
//
// The operating authority grant date is hardcoded below. The displayed age is
// computed in the browser on each page load so it stays current without a build
// step. Loaded as an external file (not an inline <script>) to satisfy the
// strict Content-Security-Policy in _headers (script-src 'self').

// Date the operating authority was granted (USDOT 4553555 / MC 1808780).
const AUTHORITY_GRANT_DATE = "2026-04-10";

/**
 * Return the whole number of days elapsed from the grant date until today.
 *
 * @param {string} grantDateString - ISO date, e.g. "2026-04-10".
 * @returns {number} whole days since the grant date (0 on the grant day itself).
 *
 * Uses the visitor's local timezone throughout. Both the grant date and "today"
 * are built as local midnight (via the year/month/day constructor) so they sit
 * in the same frame — this avoids the off-by-one from `new Date("2026-04-10")`,
 * which would otherwise parse as UTC midnight.
 */
function daysSince(grantDateString) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const [year, month, day] = grantDateString.split("-").map(Number);
  const grantDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - grantDate) / millisecondsPerDay);
}

document.addEventListener("DOMContentLoaded", () => {
  const target = document.getElementById("authority-age");
  if (target === null) {
    return;
  }
  const days = daysSince(AUTHORITY_GRANT_DATE);
  target.textContent = days === 1 ? "Age: 1 day" : `Age: ${days} days`;
});
