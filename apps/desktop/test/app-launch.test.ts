import { wantsDesktopExecution } from "@tandrix/core";
import { describe, expect, it } from "vitest";

function isOnlyOpenApp(task: string, app: string): boolean {
  const pattern = new RegExp(
    `^(?:please\\s+)?(?:open|launch|start|switch to)\\s+${app.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?:\\s+for\\s+me)?[.!]*$`,
    "i",
  );
  return pattern.test(task.trim());
}

describe("App launch and task routing workflow", () => {
  describe("isOnlyOpenApp", () => {
    it("recognizes single-step app open intents", () => {
      expect(isOnlyOpenApp("Open Spotify", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("open Spotify.", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("please open Spotify", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("launch Spotify", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("Launch Spotify for me", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("start Spotify", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("switch to Spotify!", "Spotify")).toBe(true);
      expect(isOnlyOpenApp("Open System Settings", "System Settings")).toBe(true);
      expect(isOnlyOpenApp("Open Google Chrome", "Google Chrome")).toBe(true);
    });

    it("distinguishes multi-step workflows from simple open requests", () => {
      expect(isOnlyOpenApp("Open Spotify and play jazz", "Spotify")).toBe(false);
      expect(isOnlyOpenApp("Play Bohemian Rhapsody on Spotify", "Spotify")).toBe(false);
      expect(isOnlyOpenApp("Search for podcasts in Spotify", "Spotify")).toBe(false);
      expect(isOnlyOpenApp("Shuffle my liked songs on Spotify", "Spotify")).toBe(false);
      expect(isOnlyOpenApp("Open Safari to search for flights", "Safari")).toBe(false);
    });
  });

  describe("wantsDesktopExecution", () => {
    it("routes app open commands to desktop computer-use mode", () => {
      expect(wantsDesktopExecution("Open Spotify")).toBe(true);
      expect(wantsDesktopExecution("Launch Calculator")).toBe(true);
      expect(wantsDesktopExecution("Open Notes and write a summary")).toBe(true);
      expect(wantsDesktopExecution("click the submit button for me")).toBe(true);
      expect(wantsDesktopExecution("type my note in the field for me")).toBe(true);
      expect(wantsDesktopExecution("do it: close the active window")).toBe(true);
    });

    it("keeps conversational or physical questions in guidance mode", () => {
      expect(wantsDesktopExecution("Where is the power button?")).toBe(false);
      expect(wantsDesktopExecution("What does this error message mean?")).toBe(false);
      expect(wantsDesktopExecution("Show me how to format a table in Excel")).toBe(false);
    });
  });

  describe("Case-insensitive app resolution", () => {
    const installed = [
      "Calculator",
      "Calendar",
      "Google Chrome",
      "Notes",
      "Safari",
      "Spotify",
      "System Settings",
    ];

    function resolveApp(requested: string): string | undefined {
      const target = requested.trim().toLowerCase();
      return installed.find((a) => a.toLowerCase() === target);
    }

    it("matches regardless of casing", () => {
      expect(resolveApp("spotify")).toBe("Spotify");
      expect(resolveApp("SPOTIFY")).toBe("Spotify");
      expect(resolveApp("system settings")).toBe("System Settings");
      expect(resolveApp("safari")).toBe("Safari");
      expect(resolveApp("UnknownApp")).toBeUndefined();
    });

    it("determines whether the app is already the frontmost window", () => {
      const frontApp = "Spotify";
      const targetApp = "spotify";
      const needsSwitch = frontApp.toLowerCase() !== targetApp.toLowerCase();
      expect(needsSwitch).toBe(false);

      const otherTarget = "safari";
      const needsSwitchToSafari = frontApp.toLowerCase() !== otherTarget.toLowerCase();
      expect(needsSwitchToSafari).toBe(true);
    });
  });
});
