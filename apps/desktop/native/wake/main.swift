// tandrix-wake: listens for "Tandrix" / "Hey Tandrix" / "Wake up Tandrix" entirely on this Mac,
// with Apple's on-device speech recognition. Nothing is sent anywhere: if this Mac can't recognise
// speech on device, it says so and exits rather than use a server. The Electron main process runs
// it only while the wake word is switched on, and reads one JSON line per event on stdout:
//   {"ready":true}                      listening
//   {"wake":true,"rest":"what to ask"}  heard the wake phrase (rest may be empty)
//   {"error":"..."}                     can't listen (then it exits)
import AVFoundation
import Foundation
import Speech

func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj),
    let line = String(data: data, encoding: .utf8)
  else { return }
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

func fail(_ message: String) -> Never {
  emit(["error": message])
  exit(1)
}

/// The wake phrase and what follows it, matching how recognisers spell an unusual name.
let wake = try! NSRegularExpression(
  pattern:
    "\\b(?:(?:hey|hi|ok|okay|wake\\s*up)[\\s,]+)?(?:tandrix|tandrics|tandrex|tandrik|tantrix|tendrix|ten\\s+tricks|tan\\s+tricks|sandrix)\\b[\\s,.!?]*(.*)$",
  options: [.caseInsensitive])

final class Listener {
  let recognizer: SFSpeechRecognizer
  let engine = AVAudioEngine()
  var request: SFSpeechAudioBufferRecognitionRequest?
  var task: SFSpeechRecognitionTask?
  /// How much of the current transcript was already acted on, so one phrase wakes once.
  var handled = 0
  var restartTimer: Timer?

  init() {
    guard let r = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else {
      fail("no_recognizer")
    }
    guard r.supportsOnDeviceRecognition else { fail("on_device_unavailable") }
    recognizer = r
  }

  func start() {
    let input = engine.inputNode
    input.installTap(onBus: 0, bufferSize: 2048, format: input.outputFormat(forBus: 0)) {
      [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    engine.prepare()
    do { try engine.start() } catch { fail("microphone_unavailable") }
    begin()
    emit(["ready": true])
  }

  /// One recognition task; Apple ends them after about a minute, so they're renewed often.
  func begin() {
    task?.cancel()
    let req = SFSpeechAudioBufferRecognitionRequest()
    req.requiresOnDeviceRecognition = true
    req.shouldReportPartialResults = true
    req.contextualStrings = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"]
    request = req
    handled = 0
    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      guard let self else { return }
      if let result {
        let text = result.bestTranscription.formattedString
        if text.count > self.handled {
          let fresh = String(text.dropFirst(self.handled))
          let range = NSRange(fresh.startIndex..., in: fresh)
          // Only a finished phrase counts, so "Tandrix, open Calendar" arrives whole.
          if result.isFinal, let m = wake.firstMatch(in: fresh, range: range) {
            let rest =
              Range(m.range(at: 1), in: fresh).map { String(fresh[$0]) }?
              .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            self.handled = text.count
            emit(["wake": true, "rest": rest])
          }
        }
        if result.isFinal { self.renew() }
      } else if error != nil {
        self.renew()
      }
    }
    restartTimer?.invalidate()
    restartTimer = Timer.scheduledTimer(withTimeInterval: 50, repeats: false) { [weak self] _ in
      self?.request?.endAudio()
    }
  }

  func renew() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.begin() }
  }
}

var signalSources: [DispatchSourceSignal] = []

/// macOS asks for speech and microphone access on behalf of the "responsible" app: whatever
/// launched Tandrix (in dev, the editor or terminal), whose Info.plist lacks the usage strings, so
/// the request aborts. Re-launch once disclaiming that, so this helper answers for itself with the
/// Info.plist embedded in it. Stdio is inherited, so the parent still reads the same pipe.
typealias DisclaimFn = @convention(c) (UnsafeMutablePointer<posix_spawnattr_t?>, Int32) -> Int32
if ProcessInfo.processInfo.environment["TANDRIX_WAKE_SELF"] == nil,
  let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "responsibility_spawnattrs_setdisclaim")
{
  let disclaim = unsafeBitCast(sym, to: DisclaimFn.self)
  var attr: posix_spawnattr_t?
  posix_spawnattr_init(&attr)
  _ = disclaim(&attr, 1)
  setenv("TANDRIX_WAKE_SELF", "1", 1)
  let path = CommandLine.arguments[0]
  var argv: [UnsafeMutablePointer<CChar>?] = [strdup(path), nil]
  var pid: pid_t = 0
  if posix_spawn(&pid, path, nil, &attr, &argv, environ) == 0 {
    // Pass a stop on to the child, then exit as it does.
    for sig in [SIGTERM, SIGINT] {
      signal(sig, SIG_IGN)
      let source = DispatchSource.makeSignalSource(signal: sig)
      source.setEventHandler { kill(pid, sig) }
      source.resume()
      signalSources.append(source)
    }
    DispatchQueue.global().async {
      var status: Int32 = 0
      waitpid(pid, &status, 0)
      exit((status >> 8) & 0xff)
    }
    RunLoop.main.run()
  }
}

setvbuf(stdout, nil, _IOLBF, 0)
var listener: Listener?
SFSpeechRecognizer.requestAuthorization { status in
  DispatchQueue.main.async {
    guard status == .authorized else { fail("speech_not_allowed") }
    listener = Listener()
    listener?.start()
  }
}
// Stop when Tandrix stops (stdin closes).
DispatchQueue.global().async {
  while readLine() != nil {}
  exit(0)
}
RunLoop.main.run()
