/* @ds-bundle: {"format":4,"namespace":"Tandrix","components":[{"name":"Button"},{"name":"StatusChip"},{"name":"SourceChip"},{"name":"StepCard"},{"name":"SafetyGate"},{"name":"PartHighlight"},{"name":"PointerBuddy"},{"name":"ControlIndicator"},{"name":"ConfirmDialog"},{"name":"LensCard"},{"name":"CaptureView"},{"name":"PartsList"},{"name":"CheckResult"},{"name":"HandoffBanner"},{"name":"ModeToggle"},{"name":"JobReport"},{"name":"Input"},{"name":"Toggle"},{"name":"Tabs"},{"name":"Icon"},{"name":"Notice"},{"name":"ActionCard"},{"name":"SummaryCard"},{"name":"StepRow"},{"name":"HighlightCorrection"},{"name":"ProgressState"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }

  // Icons: 24-unit grid, 1.5 stroke, round caps (Lucide-compatible geometry).
  var PATHS = {
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5"],
    alert: ["M12 3.5l9.5 16.5h-19z", "M12 10v4", "M12 17.2v.1"],
    eyeOff: ["M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z", "M12 14.5a2.5 2.5 0 1 0 0-5", "M4 20L20 4"],
    stop: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5.6 5.6l12.8 12.8"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3 2"],
    progress: ["M12 3a9 9 0 1 1-9 9"],
    info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.8v.1"],
    book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3"],
    video: ["M3 7h12v10H3z", "M15 10.5l6-3.5v10l-6-3.5"],
    camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"],
    monitor: ["M3 4h18v12H3z", "M8 20h8", "M12 16v4"],
    file: ["M6 3h8l4 4v14H6z", "M14 3v4h4", "M9 12h6", "M9 16h6"],
    mic: ["M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 17.5V21"],
    power: ["M12 3v8", "M6.6 6.6a8 8 0 1 0 10.8 0"],
    gauge: ["M4 15a8 8 0 1 1 16 0", "M12 15l4-5"],
    arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
    retake: ["M4 12a8 8 0 1 0 2.3-5.6", "M4 4v4.5h4.5"],
    glasses: ["M2.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z", "M14.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z", "M9.5 12.5c1.5-1 3.5-1 5 0", "M2.5 12L4 6h3", "M21.5 12L20 6h-3"],
    laptop: ["M4.5 5h15v10h-15z", "M2.5 19h19"],
    phone: ["M7.5 3h9v18h-9z", "M11 18h2"],
    x: ["M6 6l12 12", "M18 6L6 18"],
    pointer: ["M5 3l5 16 2.5-6.5L19 10z"],
    hand: ["M9 11V5.5a1.5 1.5 0 0 1 3 0V11", "M12 10V4.5a1.5 1.5 0 0 1 3 0V11", "M15 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.3-2.8L3 14.5a1.6 1.6 0 0 1 2.5-2L9 15V8a1.5 1.5 0 0 1 3 0"]
  };

  function Icon(props) {
    var size = props.size || 16;
    var d = PATHS[props.name] || [];
    return h("svg", {
      className: cx("tx-ico", size === 20 && "tx-ico-20", size === 24 && "tx-ico-24", props.className),
      viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5,
      strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": props.label ? undefined : true,
      role: props.label ? "img" : undefined, "aria-label": props.label
    }, d.map(function (p, i) { return h("path", { key: i, d: p }); }));
  }

  function Button(props) {
    var variant = props.variant || "secondary";
    var size = props.size || "md";
    var rest = {};
    for (var k in props) if (["variant", "size", "icon", "block", "className", "children", "iconOnly"].indexOf(k) < 0) rest[k] = props[k];
    rest.type = props.type || "button";
    rest.className = cx("tx-btn", "tx-btn-" + variant, size !== "md" && "tx-btn-" + size, props.block && "tx-btn-block", props.iconOnly && "tx-btn-icon", props.className);
    return h("button", rest, props.icon ? h(Icon, { name: props.icon, size: size === "field" ? 24 : size === "lg" ? 20 : 16 }) : null, props.children);
  }

  var STATUS = {
    verified: { icon: "check", label: "Verified" },
    confirmed: { icon: "user", label: "You confirmed" },
    attention: { icon: "alert", label: "Needs attention" },
    unverifiable: { icon: "eyeOff", label: "Can't check from a photo" },
    blocked: { icon: "stop", label: "Blocked" },
    pending: { icon: "clock", label: "Pending" },
    progress: { icon: "progress", label: "In progress" }
  };

  function StatusChip(props) {
    var s = STATUS[props.status] || STATUS.pending;
    return h("span", { className: cx("tx-status", "tx-status-" + props.status, props.size === "lg" && "tx-status-lg") },
      h(Icon, { name: s.icon }), props.children || s.label);
  }

  var SOURCE_ICON = { manual: "book", expert: "video", generic: "file", screen: "monitor", photo: "camera" };

  function SourceChip(props) {
    var kind = props.kind || "manual";
    var text = props.children || (kind === "generic" ? "Generic, not from the manufacturer" : "");
    return h(props.href ? "a" : "span", {
      className: cx("tx-source", kind === "generic" && "tx-source-generic", props.href && "tx-focus"),
      href: props.href, target: props.href ? "_blank" : undefined, rel: props.href ? "noreferrer" : undefined
    }, h(Icon, { name: SOURCE_ICON[kind] || "file" }), text);
  }

  function StepCard(props) {
    return h("section", { className: "tx-step", "aria-label": "Step " + props.index + " of " + props.total },
      h("div", { className: "tx-step-meta" },
        h("span", { className: "tx-step-count" }, "Step " + props.index + " of " + props.total),
        h("span", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          props.status ? h(StatusChip, { status: props.status }) : null,
          props.source ? h(SourceChip, { kind: props.sourceKind || "manual" }, props.source) : null)),
      h("h2", { className: "tx-step-title" }, props.title),
      props.body ? h("p", { className: "tx-step-body" }, props.body) : null,
      props.caution ? h("div", { className: "tx-step-caution", role: "note" }, h(Icon, { name: "alert", size: 20 }), h("span", null, props.caution)) : null,
      props.actions ? h("div", { className: "tx-step-actions" }, props.actions) : null);
  }

  function SafetyGate(props) {
    var stop = props.tone === "stop";
    return h("section", { className: cx("tx-gate", stop && "tx-gate-stop"), role: "group", "aria-label": props.title },
      h("div", { className: "tx-gate-head" },
        h("svg", { width: 36, height: 36, viewBox: "0 0 36 36", "aria-hidden": true },
          h("circle", { cx: 18, cy: 18, r: 18, fill: stop ? "var(--red-700)" : "var(--mandatory)" }),
          stop
            ? h("path", { d: "M10 10l16 16", stroke: "var(--on-red)", strokeWidth: 3.5, strokeLinecap: "round" })
            : h("g", { fill: "none", stroke: "var(--on-mandatory)", strokeWidth: 3, strokeLinecap: "round" },
              h("path", { d: "M18 9v9" }), h("path", { d: "M12 13a8 8 0 1 0 12 0" }))),
        h("h3", { className: "tx-gate-title" }, props.title)),
      h("p", { className: "tx-gate-body" }, props.body),
      stop ? null : props.confirmed
        ? h("span", { className: "tx-gate-done" }, h(Icon, { name: "check", size: 20 }), props.confirmedLabel || "Confirmed")
        : h(Button, { variant: "mandatory", size: props.size || "field", block: true, onClick: props.onConfirm }, props.actionLabel || "Confirm"));
  }

  // targets: [{shape:"circle", cx, cy, r} | {shape:"box", x, y, w, h}] in the frame's viewBox units.
  function PartHighlight(props) {
    var vb = props.viewBox || [0, 0, 100, 100];
    var targets = props.targets || [];
    var layers = targets.map(function (t, i) {
      var common = { fill: t.mask ? "var(--highlight-tint)" : "none" };
      function shape(extra) {
        var a = Object.assign({}, common, extra);
        return t.shape === "box"
          ? h("rect", Object.assign({ x: t.x, y: t.y, width: t.w, height: t.h, rx: 6 }, a))
          : h("circle", Object.assign({ cx: t.cx, cy: t.cy, r: t.r }, a));
      }
      return h("g", { key: i },
        shape({ stroke: "var(--highlight-keyline)", strokeWidth: 7, fill: "none", opacity: 0.55 }),
        shape({ stroke: "var(--highlight-halo)", strokeWidth: 5, fill: "none" }),
        shape({ stroke: "var(--highlight)", strokeWidth: 2.5 }));
    });
    var labels = targets.map(function (t, i) {
      if (!t.label) return null;
      var top = t.shape === "box" ? t.y : t.cy - t.r;
      var cxv = t.shape === "box" ? t.x + t.w / 2 : t.cx;
      var left = ((cxv - vb[0]) / vb[2]) * 100;
      var topPct = ((top - vb[1]) / vb[3]) * 100;
      return h("span", { key: "l" + i, className: "tx-hl-label", style: { left: left + "%", top: topPct + "%" } },
        t.label, t.part ? h("b", null, t.part) : null, t.possible ? h("i", null, "Possible match") : null);
    });
    return h("figure", { className: "tx-hl", style: { margin: 0 }, "aria-label": props.alt },
      props.children,
      h("svg", { className: "tx-hl-layer", viewBox: vb.join(" "), preserveAspectRatio: props.preserveAspectRatio || "xMidYMid slice", "aria-hidden": true }, layers),
      labels);
  }

  function PointerBuddy(props) {
    return h("div", { className: "tx-ptr", style: { left: props.x, top: props.y }, role: "status", "aria-live": "polite" },
      h("svg", { viewBox: "0 0 28 28", "aria-hidden": true },
        h("path", { d: "M3 2 L3 22 L8.5 16.8 L12.4 25 L16 23.4 L12.2 15.4 L19.5 15.4 Z", fill: "var(--highlight)", stroke: "var(--highlight-halo)", strokeWidth: 2, strokeLinejoin: "round" }),
        h("path", { d: "M3 2 L3 22 L8.5 16.8 L12.4 25 L16 23.4 L12.2 15.4 L19.5 15.4 Z", fill: "none", stroke: "var(--highlight-keyline)", strokeWidth: 0.75, strokeLinejoin: "round", transform: "translate(0 0)" })),
      props.caption ? h("div", { className: "tx-ptr-cap" }, props.caption) : null);
  }

  function ControlIndicator(props) {
    return h("div", { className: "tx-ctl", role: "status" },
      h("span", { className: "tx-ctl-dot", "aria-hidden": true }),
      h("span", null, props.children || "Tandrix is in control"),
      h("button", { type: "button", onClick: props.onStop }, props.stopLabel || "Stop (Esc)"));
  }

  function ConfirmDialog(props) {
    return h("div", { className: "tx-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "tx-dlg-title" },
      h("div", { className: "tx-dialog-body" },
        h("h2", { className: "tx-dialog-title", id: "tx-dlg-title" }, props.title),
        props.lead ? h("p", { className: "tx-dialog-lead" }, props.lead) : null,
        props.note ? h("p", { className: "tx-dialog-note" }, props.note) : null),
      h("div", { className: "tx-dialog-foot" },
        h(Button, { variant: "secondary", onClick: props.onCancel }, props.cancelLabel || "Cancel"),
        h(Button, { variant: props.tone === "danger" ? "danger" : "primary", onClick: props.onConfirm }, props.confirmLabel || "Confirm")));
  }

  function LensCard(props) {
    return h("div", { className: "tx-lens", role: "status" },
      h("div", { className: "tx-lens-main" }, props.step != null ? h("span", { className: "tx-lens-num" }, props.step) : null, h("span", null, props.children)),
      props.hint ? h("div", { className: "tx-lens-hint" }, props.hint) : null);
  }

  // state: "live" | "preview" | "analyzing"; source: "phone" | "glasses"
  function CaptureView(props) {
    var state = props.state || "live";
    var src = props.source || "phone";
    var top = h("div", { className: "tx-cap-top" },
      h("span", { className: "tx-cap-pill", role: "status" },
        h("span", { className: "tx-cap-dot", "aria-hidden": true }),
        src === "glasses" ? "Glasses camera on" : "Camera on"),
      props.onSwitchSource ? h("button", { type: "button", className: "tx-cap-pill tx-cap-switch", onClick: props.onSwitchSource },
        h(Icon, { name: src === "glasses" ? "phone" : "glasses" }), src === "glasses" ? "Use phone" : "Use glasses") : null);
    var hint = props.hint ? h("div", { className: "tx-cap-hint" }, props.hint) : null;
    var analyzing = state === "analyzing"
      ? h("div", { className: "tx-cap-busy", role: "status", "aria-live": "polite" }, h("span", { className: "tx-cap-spin", "aria-hidden": true }), props.analyzingLabel || "Looking at the photo") : null;
    var controls = state === "preview"
      ? h("div", { className: "tx-cap-bar" },
        h(Button, { variant: "secondary", size: "field", icon: "retake", onClick: props.onRetake }, "Retake"),
        h(Button, { variant: "primary", size: "field", onClick: props.onUse }, props.useLabel || "Use photo"))
      : h("div", { className: "tx-cap-bar tx-cap-bar-live" },
        h("span", { className: "tx-cap-side" }),
        h("button", { type: "button", className: "tx-cap-shutter", "aria-label": "Take photo", onClick: props.onCapture, disabled: state === "analyzing" }),
        h("span", { className: "tx-cap-side" }, h(Button, { variant: "secondary", size: "field", icon: "mic", iconOnly: true, "aria-label": "Hold to talk", onClick: props.onTalk })));
    return h("div", { className: "tx-cap" },
      h("div", { className: "tx-cap-frame" }, props.children, top, hint, analyzing),
      controls);
  }

  var PART_STATUS = {
    found: { icon: "check", label: "Found", cls: "verified" },
    possible: { icon: "alert", label: "Possible match", cls: "attention" },
    missing: { icon: "stop", label: "Missing", cls: "blocked" }
  };

  // parts: [{part, name, qty, status: "found"|"possible"|"missing", note?}]
  function PartsList(props) {
    var parts = props.parts || [];
    var found = parts.filter(function (p) { return p.status === "found"; }).length;
    var missing = parts.filter(function (p) { return p.status === "missing"; }).length;
    var possible = parts.filter(function (p) { return p.status === "possible"; }).length;
    var summary = found + " of " + parts.length + " parts found";
    return h("section", { className: "tx-parts", "aria-label": "Parts check" },
      h("header", { className: "tx-parts-head" },
        h("h3", { className: "tx-parts-title" }, summary),
        h("p", { className: "tx-parts-sub" },
          [missing ? missing + " missing" : null, possible ? possible + " to confirm" : null].filter(Boolean).join(", ") || "Everything on the list is here")),
      h("ul", { className: "tx-parts-list" }, parts.map(function (p, i) {
        var s = PART_STATUS[p.status] || PART_STATUS.possible;
        return h("li", { key: i },
          h("button", { type: "button", className: "tx-parts-row", onClick: props.onSelect ? function () { props.onSelect(p, i); } : undefined },
            h("span", { className: "tx-parts-num" }, p.part),
            h("span", { className: "tx-parts-name" }, h("span", null, p.name), p.note ? h("small", null, p.note) : null),
            h("span", { className: "tx-parts-qty" }, "×" + (p.qty || 1)),
            h("span", { className: cx("tx-status", "tx-status-" + s.cls) }, h(Icon, { name: s.icon }), s.label)));
      })));
  }

  var CHECK = {
    pass: { cls: "pass", icon: "check", title: "Looks right" },
    fail: { cls: "fail", icon: "alert", title: "Needs attention" },
    not_verifiable: { cls: "nv", icon: "eyeOff", title: "Can't check this from a photo" }
  };

  function CheckResult(props) {
    var c = CHECK[props.result] || CHECK.not_verifiable;
    return h("section", { className: cx("tx-check", "tx-check-" + c.cls), role: "status", "aria-live": "polite" },
      props.thumbnail ? h("div", { className: "tx-check-thumb" }, props.thumbnail) : null,
      h("div", { className: "tx-check-main" },
        h("h3", { className: "tx-check-title" }, h(Icon, { name: c.icon, size: 20 }), props.title || c.title),
        h("p", { className: "tx-check-reason" }, props.reason),
        props.evidence ? h(SourceChip, { kind: "photo" }, props.evidence) : null,
        props.actions ? h("div", { className: "tx-check-actions" }, props.actions) : null));
  }

  // state: "offer" (phone) | "waiting" (phone) | "incoming" (Mac)
  function HandoffBanner(props) {
    var state = props.state || "offer";
    var icon = state === "incoming" ? "phone" : "laptop";
    var title = state === "offer" ? "Next step is on your Mac"
      : state === "waiting" ? "Waiting on " + (props.device || "your Mac")
      : (props.job || "Job") + ": step " + props.step + " is ready";
    var body = state === "offer" ? (props.stepTitle ? "Step " + props.step + ": " + props.stepTitle : "Open it on " + (props.device || "your Mac") + ".")
      : state === "waiting" ? "Step " + props.step + " is open there. You can still go back to the physical steps."
      : "Sent from " + (props.device || "your phone") + (props.stepTitle ? ". " + props.stepTitle : ".");
    var action = state === "offer" ? h(Button, { variant: "primary", size: props.size || "field", block: props.size !== "md", onClick: props.onAction }, "Continue on Mac")
      : state === "waiting" ? h(Button, { variant: "secondary", size: props.size || "lg", onClick: props.onAction }, "Back to physical steps")
      : h(Button, { variant: "primary", onClick: props.onAction }, "Open step " + props.step);
    return h("section", { className: cx("tx-handoff", "tx-handoff-" + state), role: "status" },
      h("div", { className: "tx-handoff-ico" }, h(Icon, { name: icon, size: 20 })),
      h("div", { className: "tx-handoff-text" }, h("strong", null, title), h("span", null, body)),
      h("div", { className: "tx-handoff-act" }, action));
  }

  // mode: "show" | "do". Selecting "do" should open ConfirmDialog first; this control only reports the request.
  function ModeToggle(props) {
    var mode = props.mode || "show";
    function opt(id, label, icon) {
      return h("button", {
        type: "button", role: "radio", "aria-checked": mode === id, className: cx("tx-mode-opt", mode === id && "is-on"),
        onClick: function () { if (props.onChange && mode !== id) props.onChange(id); }
      }, h(Icon, { name: icon }), label, id === "do" && mode === "do" ? h("span", { className: "tx-mode-dot", "aria-hidden": true }) : null);
    }
    return h("div", { className: "tx-mode", role: "radiogroup", "aria-label": props.label || "How Tandrix helps" },
      opt("show", "Show me", "pointer"), opt("do", "Do it for me", "hand"));
  }

  // counts: {verified, confirmed, attention, unresolved}; steps: [{index, title, status, source, sourceKind, time, thumbnail?}]
  function JobReport(props) {
    var c = props.counts || {};
    var stats = [
      ["verified", c.verified || 0, "Verified"],
      ["confirmed", c.confirmed || 0, "You confirmed"],
      ["attention", c.attention || 0, "Needs attention"],
      ["blocked", c.unresolved || 0, "Unresolved"]
    ];
    return h("article", { className: "tx-report" },
      h("header", { className: "tx-report-head" },
        h("h2", { className: "tx-report-title" }, props.title),
        h("p", { className: "tx-report-meta" }, props.meta)),
      h("ul", { className: "tx-report-stats" }, stats.map(function (s) {
        return h("li", { key: s[0] }, h("span", { className: "tx-report-n" }, s[1]), h(StatusChip, { status: s[0] }, s[2]));
      })),
      h("ol", { className: "tx-report-steps" }, (props.steps || []).map(function (st, i) {
        return h("li", { key: i, className: "tx-report-step" },
          h("span", { className: "tx-report-idx" }, st.index),
          st.thumbnail ? h("span", { className: "tx-report-thumb" }, st.thumbnail) : h("span", { className: "tx-report-thumb tx-report-thumb-none" }, h(Icon, { name: "file" })),
          h("span", { className: "tx-report-body" },
            h("span", { className: "tx-report-step-title" }, st.title),
            h("span", { className: "tx-report-tags" },
              h(StatusChip, { status: st.status }),
              st.source ? h(SourceChip, { kind: st.sourceKind || "manual" }, st.source) : null)),
          h("span", { className: "tx-report-time" }, st.time));
      })),
      props.footnote ? h("p", { className: "tx-report-foot" }, props.footnote) : null);
  }

  var uid = 0;
  function useId(given) { var r = React.useRef(given || "tx-f" + (++uid)); return r.current; }

  function Input(props) {
    var id = useId(props.id);
    var hintId = id + "-hint";
    return h("div", { className: cx("tx-field", props.error && "is-error", props.size === "field" && "tx-field-lg") },
      h("label", { className: "tx-field-label", htmlFor: id }, props.label),
      h("div", { className: "tx-input-wrap" },
        h("input", {
          id: id, className: cx("tx-input", props.mono && "tx-input-mono"), value: props.value, defaultValue: props.defaultValue,
          placeholder: props.placeholder, inputMode: props.inputMode, disabled: props.disabled, onChange: props.onChange,
          "aria-invalid": props.error ? true : undefined, "aria-describedby": props.error || props.hint ? hintId : undefined
        }),
        props.suffix ? h("span", { className: "tx-input-suffix" }, props.suffix) : null),
      props.error || props.hint ? h("p", { id: hintId, className: "tx-field-hint" }, props.error ? h(Icon, { name: "alert" }) : null, props.error || props.hint) : null);
  }

  function Toggle(props) {
    var id = useId(props.id);
    var st = React.useState(!!props.defaultChecked);
    var on = props.checked != null ? props.checked : st[0];
    function flip() { if (props.disabled) return; if (props.checked == null) st[1](!on); if (props.onChange) props.onChange(!on); }
    return h("div", { className: "tx-toggle-row" },
      h("span", { className: "tx-toggle-text" },
        h("label", { htmlFor: id, className: "tx-toggle-label" }, props.label),
        props.description ? h("span", { className: "tx-toggle-desc" }, props.description) : null),
      h("button", { id: id, type: "button", role: "switch", "aria-checked": on, disabled: props.disabled, className: cx("tx-toggle", on && "is-on"), onClick: flip },
        h("span", { className: "tx-toggle-thumb", "aria-hidden": true })));
  }

  // items: [{id, label, count?}]
  function Tabs(props) {
    var items = props.items || [];
    var st = React.useState(props.defaultValue || (items[0] && items[0].id));
    var value = props.value != null ? props.value : st[0];
    function pick(id) { if (props.value == null) st[1](id); if (props.onChange) props.onChange(id); }
    function onKey(e, i) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var n = items[(i + d + items.length) % items.length];
      pick(n.id);
      var el = e.currentTarget.parentNode.children[(i + d + items.length) % items.length];
      if (el) el.focus();
    }
    return h("div", { className: cx("tx-tabs", props.size === "field" && "tx-tabs-lg"), role: "tablist", "aria-label": props.label },
      items.map(function (it, i) {
        var on = it.id === value;
        return h("button", {
          key: it.id, type: "button", role: "tab", "aria-selected": on, tabIndex: on ? 0 : -1,
          className: cx("tx-tab", on && "is-on"), onClick: function () { pick(it.id); }, onKeyDown: function (e) { onKey(e, i); }
        }, it.label, it.count != null ? h("span", { className: "tx-tab-count" }, it.count) : null);
      }));
  }


  // ---- Added 25 Oct 2026: patterns the phone app shipped (manual, procedure, highlight) ----

  var NOTICE_ICON = { neutral: "file", info: "info", attention: "alert", error: "stop" };

  // tone: "neutral" | "info" | "attention" | "error". No success tone: green means verified only.
  function Notice(props) {
    var tone = props.tone || "neutral";
    return h("div", { className: cx("tx-notice", "tx-notice-" + tone), role: tone === "error" ? "alert" : "status" },
      h(Icon, { name: props.icon || NOTICE_ICON[tone] || "file", size: 20 }),
      h("div", { className: "tx-notice-main" },
        props.title ? h("strong", { className: "tx-notice-title" }, props.title) : null,
        h("span", null, props.children),
        props.action ? h("div", { className: "tx-notice-act" }, props.action) : null));
  }

  // The one next thing to do on a screen: what, why, and a single primary action.
  function ActionCard(props) {
    return h("section", { className: "tx-action", "aria-label": props.title },
      h("div", { className: "tx-action-head" }, props.icon ? h(Icon, { name: props.icon, size: 20 }) : null,
        h("h3", { className: "tx-action-title" }, props.title)),
      props.body ? h("p", { className: "tx-action-body" }, props.body) : null,
      h("div", { className: "tx-action-acts" },
        h(Button, { variant: "primary", size: props.size || "field", block: true, onClick: props.onAction }, props.actionLabel),
        props.secondaryLabel ? h(Button, { variant: "tertiary", size: props.size || "field", block: true, onClick: props.onSecondary }, props.secondaryLabel) : null));
  }

  // A thing the job already has (equipment, manual): label, name, facts, source, one action.
  function SummaryCard(props) {
    return h("section", { className: "tx-summary", "aria-label": props.label },
      h("span", { className: "tx-summary-label" }, props.label),
      h("h3", { className: "tx-summary-title" }, props.title),
      (props.facts || []).map(function (f, i) {
        return h("span", { key: i, className: cx("tx-summary-fact", f.mono && "is-mono") }, f.text);
      }),
      props.source ? h(SourceChip, { kind: props.sourceKind || "manual" }, props.source) : null,
      props.action || null);
  }

  // One step in a job's list. The whole row opens the step; its label carries status and source.
  function StepRow(props) {
    var s = STATUS[props.status] || STATUS.pending;
    var source = props.source || "Generic, not from the manufacturer";
    return h("button", {
      type: "button", className: "tx-steprow", onClick: props.onSelect,
      "aria-label": "Step " + props.index + ": " + props.title + ", " + (props.statusLabel || s.label) + ", " + source
    },
      h("span", { className: "tx-steprow-num" }, props.index),
      h("span", { className: "tx-steprow-main" },
        h("span", { className: "tx-steprow-title" }, props.title),
        h("span", { className: "tx-steprow-chips" },
          h(StatusChip, { status: props.status || "pending" }, props.statusLabel),
          h(SourceChip, { kind: props.source ? props.sourceKind || "manual" : "generic" }, props.source))));
  }

  // Confirm or correct one highlight: "This looks like the impeller. Is that right?"
  function HighlightCorrection(props) {
    var name = (props.label || "").toLowerCase();
    return h("section", { className: "tx-correct", "aria-label": "Check this highlight" },
      h("h3", { className: "tx-correct-q" }, "This looks like the " + name + ". Is that right?"),
      h(Button, { variant: "primary", size: "lg", block: true, onClick: props.onConfirm }, "Yes, that's the " + name),
      h(Button, { variant: "secondary", size: "lg", block: true, onClick: props.onReject }, "No, that's not it"),
      (props.otherParts || []).map(function (p, i) {
        return h(Button, { key: i, variant: "tertiary", size: "lg", block: true, onClick: function () { if (props.onOtherPart) props.onOtherPart(p, i); } }, "It's the " + String(p.name || p).toLowerCase());
      }));
  }

  // A wait that can take a while (reading a manual). Says what is happening; on failure, why and a retry.
  function ProgressState(props) {
    if (props.failed) {
      return h("section", { className: "tx-wait" },
        h(Notice, { tone: "neutral", icon: "alert" }, props.failed),
        h(Button, { variant: "primary", size: "field", block: true, onClick: props.onRetry }, props.retryLabel || "Try again"),
        props.backLabel ? h(Button, { variant: "secondary", size: "field", block: true, onClick: props.onBack }, props.backLabel) : null);
    }
    return h("div", { className: "tx-wait tx-wait-busy", role: "progressbar", "aria-label": props.label, "aria-busy": true },
      h("span", { className: "tx-spinner", "aria-hidden": true }),
      h("span", { className: "tx-wait-label" }, props.label));
  }

  window.Tandrix = {
    Button: Button, StatusChip: StatusChip, SourceChip: SourceChip, StepCard: StepCard, SafetyGate: SafetyGate,
    PartHighlight: PartHighlight, PointerBuddy: PointerBuddy, ControlIndicator: ControlIndicator,
    ConfirmDialog: ConfirmDialog, LensCard: LensCard, CaptureView: CaptureView, PartsList: PartsList,
    CheckResult: CheckResult, HandoffBanner: HandoffBanner, ModeToggle: ModeToggle, JobReport: JobReport,
    Input: Input, Toggle: Toggle, Tabs: Tabs, Icon: Icon,
    Notice: Notice, ActionCard: ActionCard, SummaryCard: SummaryCard, StepRow: StepRow,
    HighlightCorrection: HighlightCorrection, ProgressState: ProgressState
  };
})();
