// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): a canned pump
// procedure so the step screens can be built and tested without the model. It goes through the
// same rules and transaction as a real draft.
import type { ProcedureGenerator } from "../procedure-generator";

export const fixtureProcedureGenerator: ProcedureGenerator = {
  async generate({ manual }) {
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
        ],
      },
    };
  },
};
