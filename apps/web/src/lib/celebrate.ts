// A short burst of confetti in the brand's colours, from a point on the page. Only decoration:
// it's loaded when needed, stays still for reduced motion, and a failure here is never shown.
const TOKENS = ["--highlight", "--blue-700", "--blue-100", "--ink"];

export async function celebrate(from: DOMRect | undefined) {
  const x = from ? (from.left + from.width / 2) / window.innerWidth : 0.5;
  const y = from ? (from.top + from.height / 2) / window.innerHeight : 0.5;
  try {
    const { default: confetti } = await import("canvas-confetti");
    const page = getComputedStyle(document.documentElement);
    const colors = TOKENS.map((t) => page.getPropertyValue(t).trim()).filter(Boolean);
    // One short burst doesn't need the library's default worker.
    const fire = confetti.create(undefined, {
      resize: true,
      useWorker: false,
      disableForReducedMotion: true,
    });
    await fire({
      particleCount: 110,
      spread: 95,
      startVelocity: 42,
      gravity: 0.9,
      ticks: 200,
      scalar: 0.95,
      origin: { x, y },
      colors,
    });
  } catch {
    // The sign-up already worked; the message says so.
  }
}
