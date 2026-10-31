// Deterministic guard for Do it for me mode (Architecture §6.6a). Every model-proposed desktop
// action passes through here before the input driver runs it. The model cannot change the mode
// or bypass this; anything uncertain asks the user.
import type { ControlMode, DesktopAction } from "@tandrix/contracts";

export type SensitiveCategory =
  "payment" | "send" | "delete" | "credentials" | "security_settings" | "install";

export interface GuardContext {
  mode: ControlMode;
  /** What the model said it is doing this turn (ScreenAnswer.reply). */
  intent: string;
  /** Name of the control being acted on, as shown in the app. */
  targetLabel?: string;
  /** Text read from the target region of the screenshot, if available. */
  targetText?: string;
  /** True when the focused field is a password/secure text field (from the accessibility API). */
  focusedFieldIsSecure?: boolean;
  /** Actions already executed for this user request. */
  actionsThisRequest: number;
  /** Execution times (ms) of recent actions, any order. */
  recentActionTimes: readonly number[];
  now: number;
}

export type GuardDecision =
  | { decision: "allow" }
  | { decision: "confirm"; category: SensitiveCategory | "unusual_input"; prompt: string }
  | { decision: "deny"; code: DenyCode; message: string };

export type DenyCode =
  "show_mode" | "action_limit" | "rate_limit" | "secure_field" | "secret_text" | "system_shortcut";

export const guardLimits = {
  /** One task: three calendar events from a chat take about 30 actions. Esc stops any task. */
  maxActionsPerRequest: 150,
  /** A floor against a runaway loop; the pointer's own pause sets the pace. */
  minGapMs: 30,
  /** Above the pace the pointer's announce allows (about two a second), so it never throttles. */
  maxPerMinute: 120,
} as const;

/**
 * Whole-word match with Unicode-aware boundaries: `\b` breaks on accented letters (the ñ in
 * "contraseña" is a non-word character to it), so lookarounds on Unicode letters do the job.
 */
const words = (alts: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alts.join("|")})(?![\\p{L}\\p{N}_])`, "iu");

const sensitivePatterns: Array<{ category: SensitiveCategory; pattern: RegExp; verb: string }> = [
  {
    category: "payment",
    pattern: words([
      "pay",
      "payment",
      "checkout",
      "check out",
      "purchase",
      "buy",
      "place order",
      "subscribe",
      "card number",
      "billing",
      // de fr es it pt: the words a pay button actually shows.
      "bezahlen",
      "zahlung",
      "kaufen",
      "bestellen",
      "payer",
      "paiement",
      "acheter",
      "commande",
      "pagar",
      "pago",
      "comprar",
      "pedido",
      "acquistare",
    ]),
    verb: "make a payment",
  },
  {
    category: "send",
    pattern: words([
      "send",
      "submit",
      "post",
      "publish",
      "share",
      "reply",
      "forward",
      "email",
      "message",
      "senden",
      "weiterleiten",
      "teilen",
      "antworten",
      "envoyer",
      "partager",
      "enviar",
      "compartir",
      "responder",
      "publicar",
      "inviare",
      "condividere",
    ]),
    verb: "send something",
  },
  {
    category: "delete",
    pattern: words([
      "delete",
      "remove",
      "erase",
      "discard",
      "trash",
      "wipe",
      "uninstall",
      "reset",
      "factory reset",
      "format",
      "löschen",
      "entfernen",
      "supprimer",
      "effacer",
      "eliminar",
      "borrar",
      "excluir",
      "apagar",
    ]),
    verb: "delete something",
  },
  {
    category: "credentials",
    pattern: words([
      "password",
      "passcode",
      "pin",
      "sign in",
      "log in",
      "login",
      "2fa",
      "two[- ]factor",
      "api key",
      "token",
      "secret",
      "passwort",
      "anmelden",
      "mot de passe",
      "se connecter",
      "contraseña",
      "iniciar sesión",
      "accedi",
      "senha",
      "entrar",
    ]),
    verb: "enter or change sign-in details",
  },
  {
    category: "install",
    pattern: words([
      "install",
      "download",
      "update now",
      "upgrade",
      "\\.dmg",
      "\\.pkg",
      "run script",
      "terminal",
      "installieren",
      "herunterladen",
      "installer",
      "télécharger",
      "instalar",
      "descargar",
      "installare",
      "scaricare",
      "baixar",
    ]),
    verb: "install or run software",
  },
  {
    category: "security_settings",
    pattern: words([
      "firewall",
      "privacy",
      "permission",
      "security",
      "filevault",
      "gatekeeper",
      "admin(istrator)?",
      "sudo",
      "accessibility access",
      "screen recording access",
      "firmware",
      "datenschutz",
      "sicherheit",
      "sécurité",
      "confidentialité",
      "seguridad",
      "privacidad",
      "sicurezza",
    ]),
    verb: "change security settings",
  },
];

/** macOS shortcuts Tandrix never sends. */
const blockedShortcuts = [
  ["cmd", "q"],
  ["cmd", "option", "esc"],
  ["ctrl", "cmd", "q"],
  ["cmd", "shift", "q"],
  ["ctrl", "cmd", "power"],
  ["cmd", "shift", "delete"],
  ["cmd", "option", "shift", "delete"],
] as const;

/**
 * Shortcuts that are fine but consequential enough to ask. ⌘Space (Spotlight) and ⌘Tab only move
 * between apps, which tasks need, so they run without asking.
 */
const confirmShortcuts = [
  ["cmd", "w"],
  ["cmd", "delete"],
  ["cmd", "enter"],
] as const;

const keyAlias: Record<string, string> = {
  command: "cmd",
  meta: "cmd",
  super: "cmd",
  control: "ctrl",
  alt: "option",
  opt: "option",
  escape: "esc",
  backspace: "delete",
  return: "enter",
};
const normKeys = (keys: readonly string[]) =>
  [...new Set(keys.map((k) => keyAlias[k.toLowerCase()] ?? k.toLowerCase()))].sort();
const sameCombo = (a: readonly string[], b: readonly string[]) => {
  const x = normKeys(a);
  const y = normKeys(b);
  return x.length === y.length && x.every((k, i) => k === y[i]);
};

/** Strings that look like credentials or keys. Tandrix never types these for the user. */
const secretLike = [
  /\b(sk|pk|rk)[-_][A-Za-z0-9]{16,}\b/, // provider API keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/, // long base64 blobs
];

function sensitiveCategory(text: string): (typeof sensitivePatterns)[number] | null {
  return sensitivePatterns.find((p) => p.pattern.test(text)) ?? null;
}

function describe(action: DesktopAction, target?: string): string {
  const on = target ? ` ${target}` : "";
  switch (action.type) {
    case "click":
      return `click${on || " here"}`;
    case "double_click":
      return `double-click${on || " here"}`;
    case "drag":
      return "drag on the screen";
    case "keypress":
      return `press ${action.keys.join("+")}`;
    case "type":
      return `type "${action.text.length > 40 ? `${action.text.slice(0, 40)}…` : action.text}"`;
    case "scroll":
      return "scroll";
    case "move":
      return "move the pointer";
    case "screenshot":
      return "take a screenshot";
    case "wait":
      return "wait";
  }
}

const passive = new Set<DesktopAction["type"]>(["move", "screenshot", "wait"]);

export function guardAction(action: DesktopAction, ctx: GuardContext): GuardDecision {
  if (ctx.mode !== "do") {
    return {
      decision: "deny",
      code: "show_mode",
      message: "Tandrix is in Show me mode, so it points instead of acting.",
    };
  }

  // Passive actions never change anything, so limits and classification don't apply.
  if (passive.has(action.type)) return { decision: "allow" };

  if (ctx.actionsThisRequest >= guardLimits.maxActionsPerRequest) {
    return {
      decision: "deny",
      code: "action_limit",
      message: "Tandrix has taken a lot of steps for this request. Ask again to continue.",
    };
  }
  const recent = ctx.recentActionTimes.filter((t) => ctx.now - t < 60_000);
  const last = recent.length ? Math.max(...recent) : -Infinity;
  if (ctx.now - last < guardLimits.minGapMs || recent.length >= guardLimits.maxPerMinute) {
    return {
      decision: "deny",
      code: "rate_limit",
      message: "Slowing down before the next action.",
    };
  }

  if (action.type === "keypress") {
    if (blockedShortcuts.some((combo) => sameCombo(combo, action.keys))) {
      return {
        decision: "deny",
        code: "system_shortcut",
        message: `Tandrix doesn't press ${action.keys.join("+")}. Do it yourself if you need to.`,
      };
    }
    if (confirmShortcuts.some((combo) => sameCombo(combo, action.keys))) {
      return confirm("unusual_input", `Tandrix wants to ${describe(action)}.`);
    }
  }

  if (action.type === "type") {
    if (ctx.focusedFieldIsSecure) {
      return {
        decision: "deny",
        code: "secure_field",
        message: "This is a password field. Type it yourself; Tandrix will wait.",
      };
    }
    if (secretLike.some((re) => re.test(action.text))) {
      return {
        decision: "deny",
        code: "secret_text",
        message: "That looks like a key or password. Type it yourself; Tandrix will wait.",
      };
    }
  }

  if (action.type === "drag") {
    return confirm("unusual_input", "Tandrix wants to drag on the screen.");
  }
  if (action.type === "click" && action.button !== "left" && action.button !== "right") {
    return confirm("unusual_input", `Tandrix wants to use the ${action.button} mouse button.`);
  }

  const text = [
    ctx.intent,
    ctx.targetLabel,
    ctx.targetText,
    action.type === "type" ? action.text : "",
  ]
    .filter(Boolean)
    .join("\n");
  const hit = sensitiveCategory(text);
  if (hit) {
    return confirm(
      hit.category,
      `Tandrix wants to ${describe(action, ctx.targetLabel)}, which may ${hit.verb}. Allow it?`,
    );
  }

  return { decision: "allow" };
}

function confirm(category: SensitiveCategory | "unusual_input", prompt: string): GuardDecision {
  return { decision: "confirm", category, prompt };
}
