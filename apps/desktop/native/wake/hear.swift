// Hearing a question on this Mac (SP2): the question's audio, streamed in as the user talks, is
// recognised on the device, so letting go gives its text in a moment instead of an upload and a
// server transcription. Nothing is sent anywhere. Run as `tandrix-wake --hear`, reading one JSON
// command per line on stdin:
//   {"begin":1,"words":["Tandrix"],"own":2}  a new question (words: names to favour; own: how
//                                    many are the user's own, which only the older recogniser
//                                    honours, so it hears those questions)
//   {"audio":"<base64>"}             16 kHz mono 16-bit little-endian PCM, as it's recorded
//   {"end":1}                        the user let go: give the text
//   {"cancel":1}                     throw the question away
// and writing one JSON line per event on stdout:
//   {"ready":true,"engine":"analyzer"}
//   {"partial":1,"text":"open cal"}  what's heard so far
//   {"heard":1,"text":"Open Calendar.","ms":180}  ms: from end to the text
//   {"error":"..."}                  can't hear on this Mac (then it exits)
// `tandrix-wake --hear-file <wav> [sf|analyzer]` prints the text of a file, for the bench.
import AVFoundation
import Foundation
import Speech

let HEAR_RATE = 16_000.0
let hearFormat = AVAudioFormat(standardFormatWithSampleRate: HEAR_RATE, channels: 1)!

/// 16-bit PCM bytes as a buffer the recognisers take.
func pcmBuffer(_ bytes: Data) -> AVAudioPCMBuffer? {
  let frames = bytes.count / 2
  guard frames > 0, let buf = AVAudioPCMBuffer(pcmFormat: hearFormat, frameCapacity: AVAudioFrameCount(frames))
  else { return nil }
  buf.frameLength = AVAudioFrameCount(frames)
  let out = buf.floatChannelData![0]
  bytes.withUnsafeBytes { raw in
    let s = raw.bindMemory(to: Int16.self)
    for i in 0..<frames { out[i] = Float(Int16(littleEndian: s[i])) / 32768 }
  }
  return buf
}

/// One question being recognised.
protocol Hearing: AnyObject {
  func append(_ buffer: AVAudioPCMBuffer)
  /// The final text, once the audio has ended.
  func finish() async -> String
  func cancel()
}

/// The older recogniser (SFSpeechRecognizer), on the device only.
final class LegacyHearing: Hearing {
  let request = SFSpeechAudioBufferRecognitionRequest()
  var task: SFSpeechRecognitionTask?
  var latest = ""
  var done: CheckedContinuation<String, Never>?
  var finished = false

  init(recognizer: SFSpeechRecognizer, words: [String], partial: @escaping (String) -> Void) {
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = true
    request.contextualStrings = words
    request.addsPunctuation = true
    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      if let result {
        self.latest = result.bestTranscription.formattedString
        if result.isFinal { self.resolve() } else { partial(self.latest) }
      } else if error != nil {
        self.resolve()
      }
    }
  }

  func resolve() {
    finished = true
    done?.resume(returning: latest)
    done = nil
  }

  func append(_ buffer: AVAudioPCMBuffer) { request.append(buffer) }

  func finish() async -> String {
    request.endAudio()
    if finished { return latest }
    return await withCheckedContinuation { c in
      done = c
      // A final result that never comes: what was heard so far.
      DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in self?.resolve() }
    }
  }

  func cancel() {
    task?.cancel()
    resolve()
  }
}

/// The newer on-device transcriber (SpeechAnalyzer), macOS 26 and later.
@available(macOS 26.0, *)
final class AnalyzerHearing: Hearing {
  let transcriber: SpeechTranscriber
  let analyzer: SpeechAnalyzer
  let input: AsyncStream<AnalyzerInput>
  let feed: AsyncStream<AnalyzerInput>.Continuation
  let format: AVAudioFormat
  let converter: AVAudioConverter?
  var finals: [String] = []
  var volatile = ""
  var reading: Task<Void, Never>?

  init(transcriber: SpeechTranscriber, format: AVAudioFormat, words: [String], partial: @escaping (String) -> Void) {
    self.transcriber = transcriber
    self.format = format
    converter = format == hearFormat ? nil : AVAudioConverter(from: hearFormat, to: format)
    analyzer = SpeechAnalyzer(modules: [transcriber])
    (input, feed) = AsyncStream<AnalyzerInput>.makeStream()
    let context = AnalysisContext()
    context.contextualStrings[.general] = words
    let analyzer = self.analyzer
    let input = self.input
    Task {
      try? await analyzer.setContext(context)
      try? await analyzer.start(inputSequence: input)
    }
    reading = Task { [weak self] in
      do {
        for try await r in transcriber.results {
          guard let self else { return }
          let text = String(r.text.characters)
          if r.isFinal {
            self.finals.append(text)
            self.volatile = ""
          } else {
            self.volatile = text
          }
          partial(self.joined)
        }
      } catch {}
    }
  }

  var joined: String {
    (finals + [volatile]).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  func append(_ buffer: AVAudioPCMBuffer) {
    guard let converter else {
      feed.yield(AnalyzerInput(buffer: buffer))
      return
    }
    let ratio = format.sampleRate / HEAR_RATE
    guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16)
    else { return }
    var given = false
    converter.convert(to: out, error: nil) { _, status in
      if given {
        status.pointee = .noDataNow
        return nil
      }
      given = true
      status.pointee = .haveData
      return buffer
    }
    if out.frameLength > 0 { feed.yield(AnalyzerInput(buffer: out)) }
  }

  func finish() async -> String {
    feed.finish()
    try? await analyzer.finalizeAndFinishThroughEndOfInput()
    await reading?.value
    return joined
  }

  func cancel() {
    feed.finish()
    reading?.cancel()
    let analyzer = self.analyzer
    Task { await analyzer.cancelAndFinishNow() }
  }
}

/// Makes a Hearing with the engine chosen at start: the newer transcriber where it's installed,
/// else the older recogniser.
final class Hearer {
  enum Engine: String { case sf, analyzer }
  let engine: Engine
  let legacy: SFSpeechRecognizer?
  var analyzerFormat: AVAudioFormat?

  init(prefer: Engine?) async {
    legacy = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    if prefer != .sf, #available(macOS 26.0, *), await Hearer.analyzerReady() {
      let t = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .progressiveTranscription)
      analyzerFormat = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [t])
      engine = analyzerFormat == nil ? .sf : .analyzer
    } else {
      engine = .sf
    }
  }

  /// The transcriber's English model is on this Mac (it downloads once, from Apple).
  @available(macOS 26.0, *)
  static func analyzerReady() async -> Bool {
    guard SpeechTranscriber.isAvailable else { return false }
    let t = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .progressiveTranscription)
    switch await AssetInventory.status(forModules: [t]) {
    case .installed: return true
    case .supported, .downloading:
      // Ask for it in the background; this question uses the older recogniser.
      Task { try? await AssetInventory.assetInstallationRequest(supporting: [t])?.downloadAndInstall() }
      return false
    default: return false
    }
  }

  var usable: Bool { engine == .analyzer || (legacy?.supportsOnDeviceRecognition ?? false) }

  func begin(words: [String], own: Bool = false, partial: @escaping (String) -> Void) -> Hearing? {
    // SpeechTranscriber ignores contextual strings (VO5 bench: 5 of 27 names right with or
    // without them; SFSpeechRecognizer 4 → 12), so the user's own words go to the older one.
    if engine == .analyzer, !own || !(legacy?.supportsOnDeviceRecognition ?? false),
      #available(macOS 26.0, *), let f = analyzerFormat
    {
      let t = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .progressiveTranscription)
      return AnalyzerHearing(transcriber: t, format: f, words: words, partial: partial)
    }
    guard let r = legacy, r.supportsOnDeviceRecognition else { return nil }
    return LegacyHearing(recognizer: r, words: words, partial: partial)
  }
}

/// `--hear`: questions from Tandrix on stdin, their text on stdout.
func runHearing() {
  Task { @MainActor in
    let hearer = await Hearer(prefer: nil)
    guard hearer.usable else { fail("on_device_unavailable") }
    var current: (id: Int, hearing: Hearing)?
    emit(["ready": true, "engine": hearer.engine.rawValue])
    DispatchQueue.global().async {
      while let line = readLine() {
        guard let data = line.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { continue }
        DispatchQueue.main.async {
          if let id = obj["begin"] as? Int {
            current?.hearing.cancel()
            let words = (obj["words"] as? [String])?.prefix(100).map { String($0.prefix(60)) } ?? []
            let own = (obj["own"] as? Int ?? 0) > 0
            if let h = hearer.begin(words: words, own: own, partial: { text in emit(["partial": id, "text": text]) }) {
              current = (id, h)
            } else {
              current = nil
              emit(["heard": id, "text": "", "ms": 0])
            }
          } else if let b64 = obj["audio"] as? String, let bytes = Data(base64Encoded: b64),
            let buf = pcmBuffer(bytes)
          {
            current?.hearing.append(buf)
          } else if let id = obj["end"] as? Int {
            guard let c = current, c.id == id else { return emit(["heard": id, "text": "", "ms": 0]) }
            current = nil
            let started = Date()
            Task { @MainActor in
              let text = await c.hearing.finish()
              emit(["heard": id, "text": text, "ms": Int(Date().timeIntervalSince(started) * 1000)])
            }
          } else if let id = obj["cancel"] as? Int, current?.id == id {
            current?.hearing.cancel()
            current = nil
          }
        }
      }
      exit(0)
    }
  }
}

/// `--hear-file <wav> [engine]`: the file streamed in as if spoken, then its text.
func runHearFile(_ path: String, engine: String?) {
  Task { @MainActor in
    let hearer = await Hearer(prefer: engine.flatMap(Hearer.Engine.init(rawValue:)))
    guard let file = try? AVAudioFile(forReading: URL(fileURLWithPath: path)),
      let pcm = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
      (try? file.read(into: pcm)) != nil
    else { fail("unreadable") }
    // To 16 kHz 16-bit, as the panel sends it.
    let conv = AVAudioConverter(from: file.processingFormat, to: hearFormat)!
    let out = AVAudioPCMBuffer(pcmFormat: hearFormat, frameCapacity: AVAudioFrameCount(Double(file.length) * HEAR_RATE / file.processingFormat.sampleRate) + 16)!
    var given = false
    conv.convert(to: out, error: nil) { _, s in
      if given { s.pointee = .endOfStream; return nil }
      given = true
      s.pointee = .haveData
      return pcm
    }
    var bytes = Data(count: Int(out.frameLength) * 2)
    bytes.withUnsafeMutableBytes { raw in
      let d = raw.bindMemory(to: Int16.self)
      for i in 0..<Int(out.frameLength) {
        d[i] = Int16(max(-1, min(1, out.floatChannelData![0][i])) * 32767).littleEndian
      }
    }
    // TANDRIX_HEAR_WORDS: the user's own words, comma-separated (VO5 bench).
    let own = (ProcessInfo.processInfo.environment["TANDRIX_HEAR_WORDS"] ?? "")
      .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    guard let h = hearer.begin(words: ["Tandrix", "Hey Tandrix", "Wake up Tandrix"] + own, own: !own.isEmpty, partial: { _ in }) else {
      fail("on_device_unavailable")
    }
    // In 100 ms pieces, at about the pace it was said, so it's heard as it would be live.
    let piece = Int(HEAR_RATE / 10) * 2
    var at = 0
    while at < bytes.count {
      if let b = pcmBuffer(bytes.subdata(in: at..<min(bytes.count, at + piece))) { h.append(b) }
      at += piece
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    let started = Date()
    let text = await h.finish()
    emit(["text": text, "ms": Int(Date().timeIntervalSince(started) * 1000), "engine": hearer.engine.rawValue])
    exit(0)
  }
}
