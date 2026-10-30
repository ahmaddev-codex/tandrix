// tandrix-wake: listens for "Tandrix" / "Hey Tandrix" / "Wake up Tandrix" entirely on this Mac,
// with Apple's on-device speech recognition. Nothing is sent anywhere: if this Mac can't recognise
// speech on device, it says so and exits rather than use a server. The Electron main process runs
// it only while the wake word is switched on, and reads one JSON line per event on stdout:
//   {"ready":true}                      listening
//   {"wake":true,"rest":"what to ask","voice":[...]}  heard the wake phrase (rest may be empty;
//                                       voice is the voiceprint of the last few seconds, if voiced)
//   {"sample":[...],"voiced":2.1}       a voice setup phrase, recorded between record start and stop
//   {"error":"..."}                     can't listen (then it exits)
// and takes one JSON command per line on stdin:
//   {"record":"start"} / {"record":"stop"}   record a voice setup phrase
// Voiceprints are computed here (voiceprint.swift) and never leave the Mac.
import AVFoundation
import Foundation
import Speech

/// TANDRIX_WAKE_DEBUG=1 prints what's heard to stderr (development only).
let debug = ProcessInfo.processInfo.environment["TANDRIX_WAKE_DEBUG"] != nil

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
    "\\b(?:(?:hey|hi|ok|okay|wake\\s*up)[\\s,]+)?(?:tandrix|tandrics|tandrex|tandrik|tantrix|tendrix|ten\\s+tricks|tan\\s+tricks|tan\\s*drix|sandrix|hendrix|handrix|trendix|candrix|tandreks)\\b[\\s,.!?]*(.*)$",
  options: [.caseInsensitive])

final class Listener {
  let recognizer: SFSpeechRecognizer
  let engine = AVAudioEngine()
  var request: SFSpeechAudioBufferRecognitionRequest?
  var task: SFSpeechRecognitionTask?
  /// How much of the current transcript was already acted on, so one phrase wakes once.
  var handled = 0
  var restartTimer: Timer?
  /// The wake phrase was heard; fires after a short pause unless more words keep coming.
  var pendingWake: Timer?
  /// Which recognition task is current.
  var generation = 0
  /// The last few seconds heard, for the voiceprint.
  let recent = Recent(seconds: 8)
  var resampler: Resampler?
  /// Where in `recent` the current recognition task's audio starts.
  var taskStart = 0

  init() {
    guard let r = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else {
      fail("no_recognizer")
    }
    guard r.supportsOnDeviceRecognition else { fail("on_device_unavailable") }
    recognizer = r
  }

  func start() {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    resampler = Resampler(from: format)
    input.installTap(onBus: 0, bufferSize: 2048, format: format) {
      [weak self] buffer, _ in
      guard let self else { return }
      self.request?.append(buffer)
      if let r = self.resampler { self.recent.append(r.convert(buffer)) }
    }
    engine.prepare()
    do { try engine.start() } catch { fail("microphone_unavailable") }
    begin()
    emit(["ready": true])
  }

  /// One recognition task; Apple ends them after about a minute, so they're renewed often.
  func begin() {
    // Callbacks from a task that has been replaced are ignored, so a cancel can't restart again.
    generation += 1
    let gen = generation
    pendingWake?.invalidate()
    task?.cancel()
    taskStart = recent.now
    let req = SFSpeechAudioBufferRecognitionRequest()
    req.requiresOnDeviceRecognition = true
    req.shouldReportPartialResults = true
    req.contextualStrings = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"]
    request = req
    handled = 0
    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      guard let self, gen == self.generation else { return }
      if let result {
        let text = result.bestTranscription.formattedString
        if debug { FileHandle.standardError.write("heard: \(text)\n".data(using: .utf8)!) }
        if text.count > self.handled {
          let fresh = String(text.dropFirst(self.handled))
          let range = NSRange(fresh.startIndex..., in: fresh)
          // Act on the live (partial) result: on a continuous stream a result is only final
          // when the task ends, a minute later. Once the name is heard, wait for a short pause
          // so "Tandrix, open Calendar" arrives whole, then answer and start listening afresh.
          if let m = wake.firstMatch(in: fresh, range: range) {
            // Where this phrase started, from the recogniser's word timings, so the voiceprint
            // hears just the phrase and not the silence or speech before it.
            let firstWord = result.bestTranscription.segments.first { $0.substringRange.location >= self.handled }
            let phraseStart = self.taskStart + Int(((firstWord?.timestamp ?? 0) - 0.15) * PRINT_RATE)
            let rest =
              Range(m.range(at: 1), in: fresh).map { String(fresh[$0]) }?
              .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            self.pendingWake?.invalidate()
            self.pendingWake = Timer.scheduledTimer(withTimeInterval: 0.9, repeats: false) {
              [weak self] _ in
              guard let self else { return }
              guard gen == self.generation else { return }
              self.handled = text.count
              // The phrase just said, from its first word to this short pause (at most 6 s).
              var event: [String: Any] = ["wake": true, "rest": rest]
              let phrase = self.recent.since(max(phraseStart, self.recent.now - Int(6 * PRINT_RATE)))
              if let p = Voiceprint.of(phrase) { event["voice"] = p.print }
              emit(event)
              // A fresh task, so the same words can't wake it twice.
              self.renew()
            }
          }
        }
        if result.isFinal {
          self.pendingWake?.invalidate()
          self.renew()
        }
      } else if error != nil {
        self.renew()
      }
    }
    restartTimer?.invalidate()
    restartTimer = Timer.scheduledTimer(withTimeInterval: 50, repeats: false) { [weak self] _ in
      self?.request?.endAudio()
    }
  }

  func command(_ line: String) {
    guard let data = line.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }
    switch obj["record"] as? String {
    case "start": recent.startRecording()
    case "stop":
      let samples = recent.stopRecording()
      if let p = Voiceprint.of(samples) {
        emit(["sample": p.print, "voiced": p.voiced])
      } else {
        emit(["sample": NSNull(), "reason": "too_short"])
      }
    default: break
    }
  }

  func renew() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.begin() }
  }
}

var signalSources: [DispatchSourceSignal] = []

// Tests: print the voiceprint of an audio file and exit.
if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--print" {
  emit(printOfFile(CommandLine.arguments[2]))
  exit(0)
}

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
// Commands from Tandrix; stop when it stops (stdin closes).
DispatchQueue.global().async {
  while let line = readLine() {
    DispatchQueue.main.async { listener?.command(line) }
  }
  exit(0)
}
RunLoop.main.run()
