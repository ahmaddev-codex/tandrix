// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): a canned pump
// procedure so the step screens can be built and tested without the model. It goes through the
// same rules and transaction as a real draft.
import type { ProcedureDraft } from "@tandrix/contracts";
import type { ProcedureGenerator } from "../procedure-generator";

/** A project with no equipment ("assemble a home server rack"): general steps from the goal. */
function projectDraft(task: string): ProcedureDraft {
  const generic = { kind: "generic" as const };
  const step = (
    order: number,
    title: string,
    instruction: string,
    rest: Partial<ProcedureDraft["steps"][number]> = {},
  ): ProcedureDraft["steps"][number] => ({
    order,
    surface: "physical",
    title,
    instruction,
    partRefs: [],
    hazardTags: [],
    verification: "user_confirm",
    expectedState: "Done as described.",
    citation: generic,
    ...rest,
  });
  return {
    title: `${task} (fixture)`,
    parts: [
      { ref: "P1", name: "Main unit", qty: 1 },
      { ref: "P2", name: "Mounting screws", qty: 8 },
    ],
    steps: [
      step(1, "Check every part is there", "Lay the parts out and tick them off the list.", {
        partRefs: ["P1", "P2"],
        verification: "photo",
        expectedState: "All parts laid out apart, none missing.",
      }),
      step(2, "Prepare a clear work area", "Clear a flat surface with room to work around it."),
      step(3, "Fit the main unit", "Set the main unit in place and fit the screws loosely.", {
        partRefs: ["P1", "P2"],
        hazardTags: ["heavy_lift"],
        verification: "photo",
        expectedState: "Main unit level and seated, all screws in.",
      }),
      step(
        4,
        "Set it up on the computer",
        "On your Mac, open the setup software and finish setup.",
        {
          surface: "desktop",
          verification: "screen",
          expectedState: "Setup complete screen is shown.",
        },
      ),
    ],
  };
}

export const fixtureProcedureGenerator: ProcedureGenerator = {
  async generate({ asset, task, manual }) {
    if (!asset) return { status: "drafted", draft: projectDraft(task) };
    // Cite real pages of whatever manual is attached; generic when there is none.
    const page = (n: number) =>
      manual
        ? { kind: "manual" as const, page: Math.min(n, manual.pages) }
        : { kind: "generic" as const };
    return {
      status: "drafted",
      draft: {
        title: "Assemble the pump (fixture)",
        parts: [
          { ref: "P1", name: "Impeller", qty: 1 },
          { ref: "P2", name: "Mechanical seal", qty: 1 },
          { ref: "P3", name: "Casing bolt", qty: 8 },
          { ref: "P4", name: "Impeller nut", qty: 1 },
        ],
        steps: [
          {
            order: 1,
            surface: "physical",
            title: "Isolate and drain the pump",
            instruction:
              "Switch off and lock out the supply, close both valves and drain the casing.",
            partRefs: [],
            hazardTags: ["electrical_isolation", "pressure"],
            verification: "user_confirm",
            expectedState: "Supply locked off, valves closed, casing empty.",
            citation: page(2),
          },
          {
            order: 2,
            surface: "physical",
            title: "Fit the mechanical seal",
            instruction: "Press the seal onto the shaft until it sits against the shoulder.",
            partRefs: ["P2"],
            hazardTags: [],
            verification: "photo",
            expectedState: "Seal flush against the shaft shoulder, spring visible.",
            citation: { ...page(3), ...(manual ? { figure: "Fig. 2" } : {}) },
          },
          {
            order: 3,
            surface: "physical",
            title: "Fit the impeller",
            instruction:
              "Slide the impeller onto the shaft with the vanes facing the inlet, then fit the nut.",
            partRefs: ["P1", "P4"],
            hazardTags: [],
            verification: "photo",
            expectedState: "Impeller seated on the shaft, vanes towards the inlet.",
            citation: page(3),
          },
          {
            order: 4,
            surface: "physical",
            title: "Torque the casing bolts",
            instruction: "Tighten the casing bolts in a cross pattern to the stated torque.",
            partRefs: ["P3"],
            hazardTags: [],
            verification: "measurement",
            measurement: { quantity: "torque", unit: "Nm", target: 25, tolerance: 2 },
            expectedState: "All eight bolts at 25 Nm.",
            citation: page(4),
          },
          {
            order: 5,
            surface: "desktop",
            title: "Set the drive ramp time",
            instruction:
              "In the drive software, set Acceleration ramp to 10 seconds and save the parameters.",
            partRefs: [],
            hazardTags: [],
            verification: "screen",
            expectedState: "Acceleration ramp reads 10 s and the parameters are saved.",
            citation: page(5),
          },
        ],
      },
    };
  },
};
