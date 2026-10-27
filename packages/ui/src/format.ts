// Dates and times as Tandrix shows them: always on the Gregorian calendar with Western digits, in
// the device's 12/24-hour preference. Some regions default to another calendar (en-AF shows
// "5 Aban"), and Hermes on iOS ignores Intl's `calendar` option, so the date part is built here
// from the Date itself. The app's copy is English; month names follow it.
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10:46" or "10:46 AM", as the device prefers. Times don't depend on the calendar. */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  });

/** "27 Oct", or "27 Oct 2025" outside the current year. */
export const formatDate = (iso: string, now: Date = new Date()) => {
  const d = new Date(iso);
  const day = `${d.getDate()} ${months[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
};

/** "27 Oct at 10:46". */
export const formatDateTime = (iso: string, now?: Date) =>
  `${formatDate(iso, now)} at ${formatTime(iso)}`;
