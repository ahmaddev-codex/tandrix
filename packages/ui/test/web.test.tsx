import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrandWordmark,
  Button,
  CheckResult,
  ConfirmDialog,
  ControlIndicator,
  doItForMeConfirmation,
  HandoffBanner,
  Icon,
  Input,
  JobReport,
  ModeToggle,
  Notice,
  PointerBuddy,
  PresenceBar,
  SourceChip,
  StatusChip,
  StepCard,
  StepRow,
  Tabs,
  Toggle,
  VoiceTranscript,
} from "../src/web";

afterEach(cleanup);

describe("Icon", () => {
  it("renders Phosphor outline SVG by default for >= 20px", () => {
    const { container } = render(<Icon name="camera" size={20} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("class")).toContain("tx-ico-20");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 256 256");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  it("renders solid filled Phosphor paths when weight=fill", () => {
    const { container } = render(<Icon name="camera" size={20} weight="fill" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("class")).toContain("tx-ico-20");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 256 256");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    const path = svg?.querySelector("path");
    expect(path?.getAttribute("d")).toBeTruthy();
  });

  it("renders PiSealCheckFill for sealCheck with weight=fill", () => {
    const { container } = render(<Icon name="sealCheck" size={20} weight="fill" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 256 256");
    const path = svg?.querySelector("path");
    // Verify Phosphor seal-check-fill path
    expect(path?.getAttribute("d")).toContain("M225.86,102.82");
  });

  it("always uses outline for retake (reload icon) because its fill is terrible", () => {
    const { container: outlineContainer } = render(
      <Icon name="retake" size={20} weight="outline" />,
    );
    const { container: fillContainer } = render(<Icon name="retake" size={20} weight="fill" />);
    const outlinePath = outlineContainer.querySelector("path")?.getAttribute("d");
    const fillPath = fillContainer.querySelector("path")?.getAttribute("d");
    // Both must use the clean circular arrow outline path, never the solid pie wedge
    expect(outlinePath).toBe(fillPath);
    expect(fillPath).toContain("M224,128a96,96,0,0,1-94.71,96H128");
  });
});

describe("StatusChip", () => {
  it("never labels user-confirmed as verified", () => {
    render(<StatusChip status="confirmed" />);
    expect(screen.getByText("You confirmed")).toBeTruthy();
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("renders sealCheck for verified status with solid fill", () => {
    const { container } = render(<StatusChip status="verified" />);
    expect(screen.getByText("Verified")).toBeTruthy();
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toContain("M225.86,102.82");
  });
});

describe("SourceChip", () => {
  it("labels generic steps by default", () => {
    render(<SourceChip kind="generic" />);
    expect(screen.getByText("Generic, not from the manufacturer")).toBeTruthy();
  });
});

describe("Button", () => {
  it("defaults to type=button and forwards clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Check my work</Button>);
    const btn = screen.getByRole("button", { name: "Check my work" });
    expect(btn.getAttribute("type")).toBe("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports the ring variant with signature styling", () => {
    render(<Button variant="ring">Explore workflow</Button>);
    const btn = screen.getByRole("button", { name: "Explore workflow" });
    expect(btn.className).toContain("tx-btn-ring");
  });
});

describe("BrandWordmark", () => {
  it("renders binary-inspired brand mark and wordmark text", () => {
    render(<BrandWordmark size="md" href="#top" />);
    const link = screen.getByRole("link", { name: "Tandrix Home" });
    expect(link.getAttribute("href")).toBe("#top");
    expect(screen.getByText("Tandrix")).toBeTruthy();
    expect(link.querySelector(".tx-wordmark-glyph")).toBeTruthy();
    expect(link.querySelector(".tx-mark-pointer")).toBeTruthy();
    expect(link.querySelector(".tx-mark-tile")).toBeTruthy();
  });
});

describe("ModeToggle", () => {
  it("requests Do it for me without switching itself", () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="show" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Do it for me/ }));
    expect(onChange).toHaveBeenCalledWith("do");
    expect(screen.getByRole("radio", { name: /Show me/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
  it("ignores clicks on the current mode", () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="show" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Show me/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Do it for me confirmation", () => {
  it("uses the exact product copy", () => {
    render(<ConfirmDialog {...doItForMeConfirmation} />);
    expect(screen.getByRole("dialog", { name: "Let Tandrix click for you?" })).toBeTruthy();
    expect(screen.getByText("Clicking this allows Tandrix to control your device.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep pointing only" })).toBeTruthy();
  });
});

describe("ControlIndicator", () => {
  it("offers a stop control", () => {
    const onStop = vi.fn();
    render(<ControlIndicator onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop (Esc)" }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});

describe("Toggle", () => {
  it("flips when uncontrolled and reports the new value", () => {
    const onChange = vi.fn();
    render(<Toggle label="Speak instructions" onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Speak instructions" });
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it("does nothing when disabled", () => {
    const onChange = vi.fn();
    render(<Toggle label="Share reports" disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Share reports" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Tabs", () => {
  it("moves selection with arrow keys and wraps", () => {
    render(
      <Tabs
        label="Job"
        items={[
          { id: "steps", label: "Steps" },
          { id: "parts", label: "Parts" },
        ]}
      />,
    );
    const steps = screen.getByRole("tab", { name: "Steps" });
    fireEvent.keyDown(steps, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Parts" }).getAttribute("aria-selected")).toBe("true");
    expect(steps.getAttribute("tabindex")).toBe("-1");
  });

  it("applies is-on class to active tab smoothly", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Job"
        items={[
          { id: "steps", label: "Steps" },
          { id: "parts", label: "Parts", count: 3 },
        ]}
        onChange={onChange}
      />,
    );
    const steps = screen.getByRole("tab", { name: "Steps" });
    const parts = screen.getByRole("tab", { name: "Parts 3" });
    expect(steps.classList.contains("is-on")).toBe(true);
    expect(parts.classList.contains("is-on")).toBe(false);

    fireEvent.click(parts);
    expect(onChange).toHaveBeenCalledWith("parts");
    expect(parts.classList.contains("is-on")).toBe(true);
    expect(steps.classList.contains("is-on")).toBe(false);
  });
});

describe("Input", () => {
  it("links the error message to the field", () => {
    render(
      <Input label="Torque applied" error="The manual specifies 25 Nm." onChange={() => {}} />,
    );
    const field = screen.getByLabelText("Torque applied");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const describedBy = field.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toContain("25 Nm");
  });
});

describe("CheckResult", () => {
  it("states when a photo can't verify a step", () => {
    render(<CheckResult result="not_verifiable" reason="Torque can't be seen in a photo." />);
    expect(screen.getByText("Can't check this from a photo")).toBeTruthy();
  });
});

describe("HandoffBanner", () => {
  it("names the step on the Mac side", () => {
    render(<HandoffBanner state="incoming" job="Pump P-100 assembly" step={9} device="iPhone" />);
    expect(screen.getByText("Pump P-100 assembly: step 9 is ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open step 9" })).toBeTruthy();
  });
});

describe("JobReport", () => {
  it("always carries the certification footnote", () => {
    render(<JobReport title="Pump P-100 assembly" counts={{ verified: 9 }} steps={[]} />);
    expect(screen.getByText(/does not certify the installation/)).toBeTruthy();
  });

  it("renders step status overrides and check notes", () => {
    render(
      <JobReport
        title="Raspberry Pi 5 build"
        counts={{ verified: 1, confirmed: 0, attention: 0, unresolved: 1 }}
        steps={[
          {
            index: 1,
            title: "Press both pins down until they click",
            status: "verified",
            note: "Both pins sit flush.",
            source: "Manual p.1",
            sourceKind: "manual",
            time: "10:46",
          },
          {
            index: 2,
            title: "Connect the optional Ethernet cable",
            status: "pending",
            statusLabel: "Skipped",
            note: "Using Wi-Fi instead.",
            sourceKind: "generic",
            source: "Generic, not from the manufacturer",
          },
        ]}
      />,
    );
    expect(screen.getByText("Both pins sit flush.")).toBeTruthy();
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Using Wi-Fi instead.")).toBeTruthy();
  });
});

describe("Notice", () => {
  it("announces errors as alerts and everything else as status", () => {
    render(<Notice tone="error">Couldn't sign in.</Notice>);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't sign in.");
    cleanup();
    render(<Notice tone="info">Read from the nameplate.</Notice>);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("StepRow", () => {
  it("carries status and source in its label", () => {
    const onSelect = vi.fn();
    render(
      <StepRow index={2} title="Fit the mechanical seal" statusLabel="To do" onSelect={onSelect} />,
    );
    const row = screen.getByRole("button", {
      name: "Step 2: Fit the mechanical seal, To do, Generic, not from the manufacturer",
    });
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("VoiceTranscript", () => {
  it("is hidden with nothing to show", () => {
    const { container } = render(<VoiceTranscript />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the last four turns and how to send while listening", () => {
    const turns = ["one", "two", "three", "four", "five"].map((text) => ({
      speaker: "you" as const,
      text,
    }));
    render(
      <VoiceTranscript state="listening" turns={turns} listeningLabel="Press ⌃⌥Space to ask." />,
    );
    expect(screen.queryByText("one")).toBeNull();
    expect(screen.getByText("five")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Press ⌃⌥Space to ask.");
  });
});

describe("StepCard", () => {
  it("names the step's place, its source and its one action", () => {
    render(
      <StepCard
        index={3}
        total={4}
        title="Set the ramp time"
        status="progress"
        actions={<Button variant="primary">Check my screen</Button>}
      />,
    );
    expect(screen.getByRole("region", { name: "Step 3 of 4" })).toBeTruthy();
    expect(screen.getByText("Generic, not from the manufacturer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check my screen" })).toBeTruthy();
  });
});

describe("PresenceBar and PointerBuddy", () => {
  it("never renders request or response text on the screen", () => {
    render(
      <>
        <PresenceBar state="answering" label="Tandrix" text="Click Export in the top right." />
        <PointerBuddy x={100} y={120} caption="Click Export in the top right." />
      </>,
    );
    expect(screen.getByText("Tandrix")).toBeTruthy();
    expect(screen.queryByText("Click Export in the top right.")).toBeNull();
  });

  it("annotates parts as a teacher would: touch, a pen line out, the words written at its end", () => {
    const { container } = render(
      <PointerBuddy
        x={500}
        y={200}
        hold={30000}
        regions={[
          {
            dx: 0,
            dy: 0,
            width: 80,
            height: 100,
            label: "Skull",
            detail: "Protects the brain",
            ax: -10,
            ay: -12,
            mark: { kind: "point", strokes: [] },
          },
          {
            dx: -100,
            dy: 200,
            width: 40,
            height: 280,
            label: "Arm",
            detail: "Moves the arm",
            mark: { kind: "trace", strokes: [[0, -100, 2, 0, 0, 100]] },
          },
        ]}
      />,
    );
    // A dot only where the mark is a point; a line for each part, a pen on it, the words.
    expect(container.querySelectorAll(".tx-touch")).toHaveLength(1);
    expect(container.querySelectorAll(".tx-marker")).toHaveLength(2);
    expect(container.querySelectorAll(".tx-pen-line")).toHaveLength(2);
    expect(container.querySelectorAll(".tx-writing")).toHaveLength(2);
    expect(screen.getByText("Skull")).toBeTruthy();
    expect(screen.getByText("Protects the brain")).toBeTruthy();
    // The pen touches where it was told: 10 left and 12 up from the skull's centre.
    const touch = container.querySelector(".tx-touch")!;
    expect(touch.getAttribute("cx")).toBe("490");
    expect(touch.getAttribute("cy")).toBe("188");
    // And the line it draws starts there, the pen riding the same path.
    const line = container.querySelector(".tx-marker")!.getAttribute("d")!;
    expect(line.startsWith("M 490.0 188.0")).toBe(true);
    const pen = container.querySelector<HTMLElement>(".tx-pen-line")!;
    expect(pen.style.getPropertyValue("offset-path") || pen.getAttribute("style")).toContain(
      "M 490.0 188.0",
    );
    // The traced part is drawn along its own strokes, from where the stroke starts.
    const arm = container.querySelector('[data-kind="trace"] .tx-marker')!.getAttribute("d")!;
    expect(arm.startsWith("M 400")).toBe(true);
  });

  it("points with the arrow, adds a step badge, and frames a region with its name and note", () => {
    const { container: plain } = render(<PointerBuddy x={100} y={120} />);
    expect(plain.querySelector(".tx-ptr-arrow")).toBeTruthy();
    expect(plain.querySelector(".tx-annot-edges")).toBeNull();

    render(<PointerBuddy x={100} y={120} step={2} />);
    expect(screen.getByText("2")).toBeTruthy();

    const { container: framed } = render(
      <PointerBuddy
        x={300}
        y={200}
        box={{ width: 240, height: 60 }}
        label="Equation"
        note={"3x − 2 = 2x + 9\nx = 11"}
        hold={20000}
      />,
    );
    // A clean dashed frame, revealed as the pen draws round it.
    const edges = framed.querySelector(".tx-annot-edges")!;
    expect(edges.querySelector(".tx-marker")).toBeTruthy();
    expect(edges.querySelector("mask .tx-reveal")).toBeTruthy();
    expect(screen.getByText("Equation")).toBeTruthy();
    expect(screen.getByText("x = 11")).toBeTruthy();
    const annot = framed.querySelector<HTMLElement>(".tx-annot")!;
    expect(annot.style.getPropertyValue("--tx-hold")).toBe("20000ms");
    expect(annot.style.getPropertyValue("--tx-w")).toBe("240px");
  });
});
