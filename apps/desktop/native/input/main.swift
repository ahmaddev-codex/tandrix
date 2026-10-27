// tandrix-input: posts mouse and keyboard events for Do it for me. The Electron main process runs
// it and writes one JSON command per line on stdin; it answers each with one JSON line on stdout.
// Every event it posts carries TANDRIX_MARK in eventSourceUserData, so Tandrix can tell its own
// input from the user's. It runs only what the main process sends, after the action guard.
// Coordinates are global display points with the origin at the top left of the main display.
import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

let TANDRIX_MARK: Int64 = 0x5441_4E44  // "TAND"

struct Point: Decodable { let x: Double; let y: Double }
struct Command: Decodable {
  let op: String
  let x: Double?
  let y: Double?
  let button: String?
  let count: Int?
  let path: [Point]?
  let dx: Int32?
  let dy: Int32?
  let text: String?
  let keys: [String]?
}

let source = CGEventSource(stateID: .hidSystemState)

func post(_ e: CGEvent?) {
  guard let e else { return }
  e.setIntegerValueField(.eventSourceUserData, value: TANDRIX_MARK)
  e.post(tap: .cghidEventTap)
}

func pause(_ ms: Double) { usleep(useconds_t(ms * 1000)) }

func buttons(_ name: String?) -> (CGMouseButton, CGEventType, CGEventType) {
  switch name {
  case "right": return (.right, .rightMouseDown, .rightMouseUp)
  case "wheel", "middle": return (.center, .otherMouseDown, .otherMouseUp)
  default: return (.left, .leftMouseDown, .leftMouseUp)
  }
}

func move(_ p: CGPoint) {
  post(CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left))
}

func click(_ p: CGPoint, _ name: String?, _ count: Int) {
  let (button, down, up) = buttons(name)
  move(p)
  pause(30)
  for i in 1...max(1, min(count, 3)) {
    for type in [down, up] {
      let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: p, mouseButton: button)
      e?.setIntegerValueField(.mouseEventClickState, value: Int64(i))
      post(e)
      pause(20)
    }
    pause(40)
  }
}

func drag(_ path: [Point]) {
  guard let first = path.first else { return }
  let start = CGPoint(x: first.x, y: first.y)
  move(start)
  post(CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left))
  for p in path.dropFirst() {
    pause(16)
    post(CGEvent(mouseEventSource: source, mouseType: .leftMouseDragged, mouseCursorPosition: CGPoint(x: p.x, y: p.y), mouseButton: .left))
  }
  let end = path.last.map { CGPoint(x: $0.x, y: $0.y) } ?? start
  post(CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left))
}

func scroll(_ p: CGPoint, _ dx: Int32, _ dy: Int32) {
  move(p)
  pause(30)
  // The protocol scrolls down for positive y; Quartz scrolls content up for positive values.
  post(CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 2, wheel1: -dy, wheel2: -dx, wheel3: 0))
}

func type(_ text: String) {
  for chunk in Array(text.utf16).chunked(16) {
    for keyDown in [true, false] {
      let e = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: keyDown)
      e?.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
      post(e)
    }
    pause(12)
  }
}

let modifiers: [String: (CGKeyCode, CGEventFlags)] = [
  "cmd": (55, .maskCommand), "command": (55, .maskCommand), "meta": (55, .maskCommand),
  "super": (55, .maskCommand), "win": (55, .maskCommand),
  "shift": (56, .maskShift),
  "option": (58, .maskAlternate), "alt": (58, .maskAlternate), "opt": (58, .maskAlternate),
  "ctrl": (59, .maskControl), "control": (59, .maskControl),
  "fn": (63, .maskSecondaryFn),
]

let named: [String: CGKeyCode] = [
  "enter": 36, "return": 36, "tab": 48, "space": 49, "delete": 51, "backspace": 51,
  "esc": 53, "escape": 53, "forwarddelete": 117, "del": 117, "home": 115, "end": 119,
  "pageup": 116, "pagedown": 121, "left": 123, "arrowleft": 123, "right": 124, "arrowright": 124,
  "down": 125, "arrowdown": 125, "up": 126, "arrowup": 126,
  "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98, "f8": 100,
  "f9": 101, "f10": 109, "f11": 103, "f12": 111,
  "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "i": 34, "j": 38, "k": 40,
  "l": 37, "m": 46, "n": 45, "o": 31, "p": 35, "q": 12, "r": 15, "s": 1, "t": 17, "u": 32,
  "v": 9, "w": 13, "x": 7, "y": 16, "z": 6,
  "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25,
  "-": 27, "=": 24, "[": 33, "]": 30, ";": 41, "'": 39, ",": 43, ".": 47, "/": 44, "\\": 42, "`": 50,
]

enum InputError: Error { case unknownKey(String), bad(String) }

func press(_ keys: [String]) throws {
  var flags: CGEventFlags = []
  var mods: [CGKeyCode] = []
  var main: [CGKeyCode] = []
  for raw in keys {
    let k = raw.lowercased().replacingOccurrences(of: "_", with: "")
    if let (code, flag) = modifiers[k] { flags.insert(flag); mods.append(code) }
    else if let code = named[k] { main.append(code) }
    else { throw InputError.unknownKey(raw) }
  }
  for code in mods { post(CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)) }
  for code in main {
    for keyDown in [true, false] {
      let e = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: keyDown)
      e?.flags = flags
      post(e)
      pause(15)
    }
  }
  for code in mods.reversed() { post(CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)) }
}

extension Array {
  func chunked(_ n: Int) -> [[Element]] {
    stride(from: 0, to: count, by: n).map { Array(self[$0..<Swift.min($0 + n, count)]) }
  }
}

func run(_ c: Command) throws {
  let at = { () throws -> CGPoint in
    guard let x = c.x, let y = c.y else { throw InputError.bad("x and y are required") }
    return CGPoint(x: x, y: y)
  }
  switch c.op {
  case "move": move(try at())
  case "click": click(try at(), c.button, c.count ?? 1)
  case "drag": drag(c.path ?? [])
  case "scroll": scroll(try at(), c.dx ?? 0, c.dy ?? 0)
  case "type": type(c.text ?? "")
  case "keys": try press(c.keys ?? [])
  case "ping": break
  default: throw InputError.bad("unknown op \(c.op)")
  }
}

/** Whether the focused field is a password field (AXSecureTextField), so Tandrix never types there. */
func focusedIsSecure() -> Bool {
  let system = AXUIElementCreateSystemWide()
  var focused: CFTypeRef?
  guard AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
    let element = focused
  else { return false }
  for attr in [kAXSubroleAttribute, kAXRoleAttribute] {
    var value: CFTypeRef?
    if AXUIElementCopyAttributeValue(element as! AXUIElement, attr as CFString, &value) == .success,
      (value as? String) == "AXSecureTextField"
    {
      return true
    }
  }
  return false
}

func reply(_ ok: Bool, _ error: String? = nil, secure: Bool? = nil, app: String? = nil) {
  var out = ok ? "{\"ok\":true" : "{\"ok\":false,\"error\":\(String(reflecting: error ?? "failed"))"
  if let secure { out += ",\"secure\":\(secure)" }
  if let app { out += ",\"app\":\(String(reflecting: app))" }
  FileHandle.standardOutput.write((out + "}\n").data(using: .utf8)!)
}

setvbuf(stdout, nil, _IOLBF, 0)
while let line = readLine() {
  guard let data = line.data(using: .utf8), !line.isEmpty else { continue }
  do {
    let c = try JSONDecoder().decode(Command.self, from: data)
    if c.op == "focus" { reply(true, secure: focusedIsSecure()); continue }
    if c.op == "front" {
      reply(true, app: NSWorkspace.shared.frontmostApplication?.localizedName ?? "")
      continue
    }
    try run(c)
    reply(true)
  } catch {
    reply(false, "\(error)")
  }
}
