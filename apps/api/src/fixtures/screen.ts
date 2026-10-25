// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): clicks a third of the
// way into the screenshot, so the Mac pointer can be seen landing without the model.
import type { ScreenGuide } from "../screen-guide";

export const fixtureScreenGuide: ScreenGuide = {
  async ask({ screenshot }) {
    return {
      status: "answered",
      reply: "Click here first. Then follow what opens on screen and ask again if you're stuck.",
      actions: [
        {
          type: "click",
          button: "left",
          x: Math.round(screenshot.width / 3),
          y: Math.round(screenshot.height / 3),
        },
      ],
    };
  },
};
