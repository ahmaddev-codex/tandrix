// VO1 spike: the wake-word detectors, run over a recorded stream instead of the microphone so they
// can be compared on the same audio (apps/api/scripts/wake-sets.ts makes the streams; scripts/
// wake-spike.ts scores them). Only with `--wake-eval`; the helper's normal work never runs this.
//   tandrix-wake --wake-eval <wav> <sf|analyzer|kws:<model.mlmodelc>> [speed]
// One JSON line per wake: {"wake":true,"at":12.34} (seconds into the stream, by the audio's own
// clock), then {"done":true,"seconds":…}. For kws, every window's score: {"score":0.93,"at":…}.
import AVFoundation
import CoreML
import Foundation
import SoundAnalysis
import Speech

/// The stream, as 16 kHz mono Float32, in 100 ms pieces.
func streamPieces(_ path: String) -> [AVAudioPCMBuffer] {
  guard let file = try? AVAudioFile(forReading: URL(fileURLWithPath: path)),
    let pcm = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
    (try? file.read(into: pcm)) != nil
  else { fail("unreadable") }
  let src = pcm.floatChannelData![0]
  var out: [AVAudioPCMBuffer] = []
  let piece = 1600
  var at = 0
  while at < Int(pcm.frameLength) {
    let n = min(piece, Int(pcm.frameLength) - at)
    let b = AVAudioPCMBuffer(pcmFormat: hearFormat, frameCapacity: AVAudioFrameCount(n))!
    b.frameLength = AVAudioFrameCount(n)
    for i in 0..<n { b.floatChannelData![0][i] = src[at + i] }
    out.append(b)
    at += n
  }
  return out
}

/// A language model that knows Tandrix: its pronunciation (/ˈtændrɪks/) and the wake phrases, so
/// the recogniser writes "Tandrix" rather than the nearest real word ("Hendrix", "10 minutes").
func wakeLanguageModel() async throws -> SFSpeechLanguageModel.Configuration {
  let dir = FileManager.default.temporaryDirectory.appendingPathComponent("tandrix-wake-lm")
  try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let data = SFCustomLanguageModelData(
    locale: Locale(identifier: "en_US"), identifier: "app.tandrix.wake", version: "1.0"
  ) {
    SFCustomLanguageModelData.CustomPronunciation(grapheme: "Tandrix", phonemes: ["t { n d r I k s"])
    SFCustomLanguageModelData.PhraseCount(phrase: "Hey Tandrix", count: 1000)
    SFCustomLanguageModelData.PhraseCount(phrase: "Wake up Tandrix", count: 1000)
    SFCustomLanguageModelData.PhraseCount(phrase: "Hey Tandrix what's on my screen", count: 100)
    SFCustomLanguageModelData.PhraseCount(phrase: "Tandrix", count: 300)
  }
  let asset = dir.appendingPathComponent("wake.bin")
  try await data.export(to: asset)
  let config = SFSpeechLanguageModel.Configuration(
    languageModel: dir.appendingPathComponent("wake.lm"), vocabulary: dir.appendingPathComponent("wake.vocab"))
  try await SFSpeechLanguageModel.prepareCustomLanguageModel(for: asset, configuration: config)
  return config
}

/// Today's detector (main.swift's Listener), on the stream's clock: partial results, the wake
/// pattern, a 0.9 s pause before it counts, and a fresh recognition task every 50 s with 0.2 s of
/// audio lost each time.
final class LegacySpike {
  let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
  var request: SFSpeechAudioBufferRecognitionRequest?
  var task: SFSpeechRecognitionTask?
  var handled = 0
  var pendingAt: Double?
  var pendingText = 0
  var generation = 0
  var clock = 0.0
  var taskStart = 0.0
  var renewing: Double?
  /// With the Tandrix language model (the "sflm" engine).
  var model: SFSpeechLanguageModel.Configuration?

  func begin() {
    generation += 1
    let gen = generation
    task?.cancel()
    pendingAt = nil
    let req = SFSpeechAudioBufferRecognitionRequest()
    req.requiresOnDeviceRecognition = true
    req.shouldReportPartialResults = true
    req.contextualStrings = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"]
    if let model { req.customizedLanguageModel = model }
    request = req
    handled = 0
    taskStart = clock
    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      DispatchQueue.main.async {
        guard let self, gen == self.generation else { return }
        if let result {
          let text = result.bestTranscription.formattedString
          if text.count > self.handled {
            let fresh = String(text.dropFirst(self.handled))
            // What was heard since the last wake, for matching rules tried offline.
            let first = result.bestTranscription.segments.first { $0.substringRange.location >= self.handled }
            emit([
              "heard": fresh, "from": ((self.taskStart + (first?.timestamp ?? 0)) * 1000).rounded() / 1000,
              "final": result.isFinal, "at": (self.clock * 1000).rounded() / 1000,
            ])
            if wake.firstMatch(in: fresh, range: NSRange(fresh.startIndex..., in: fresh)) != nil {
              self.pendingAt = self.clock + 0.9
              self.pendingText = text.count
            }
          }
          if result.isFinal { self.renewSoon() }
        } else if error != nil {
          self.renewSoon()
        }
      }
    }
  }

  func renewSoon() {
    if renewing == nil { renewing = clock + 0.2 }
  }

  func feed(_ b: AVAudioPCMBuffer) {
    clock += Double(b.frameLength) / HEAR_RATE
    if let at = pendingAt, clock >= at {
      pendingAt = nil
      handled = pendingText
      emit(["wake": true, "at": (clock * 1000).rounded() / 1000])
      renewSoon()
    }
    if clock - taskStart >= 50 {
      request?.endAudio()
      renewSoon()
    }
    if let at = renewing {
      // The gap: audio while the next task starts is lost.
      if clock < at { return }
      renewing = nil
      begin()
    }
    request?.append(b)
  }
}

/// The newer transcriber, one continuous task: a wake as soon as the phrase shows in its
/// results, once per phrase (per result range).
@available(macOS 26.0, *)
final class AnalyzerSpike {
  let transcriber = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .progressiveTranscription)
  var analyzer: SpeechAnalyzer!
  var feedIn: AsyncStream<AnalyzerInput>.Continuation!
  var clock = 0.0
  var fired: [Double] = []
  var reading: Task<Void, Never>?
  var format: AVAudioFormat = hearFormat
  var converter: AVAudioConverter?

  func start() async {
    // The transcriber takes its own format (16-bit), as hear.swift converts to.
    if let f = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]), f != hearFormat {
      format = f
      converter = AVAudioConverter(from: hearFormat, to: f)
    }
    analyzer = SpeechAnalyzer(modules: [transcriber])
    let (input, cont) = AsyncStream<AnalyzerInput>.makeStream()
    feedIn = cont
    let ctx = AnalysisContext()
    ctx.contextualStrings[.general] = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"]
    try? await analyzer.setContext(ctx)
    // start returns only when the input ends, so it runs alongside the feeding.
    let a = analyzer!
    Task { try? await a.start(inputSequence: input) }
    let t = transcriber
    reading = Task { @MainActor [weak self] in
      do {
        for try await r in t.results {
          guard let self else { return }
          let text = String(r.text.characters)
          let start = r.range.start.seconds
          // Everything heard, for matching rules tried offline (scripts/wake/score.ts).
          emit([
            "heard": text, "from": (start * 1000).rounded() / 1000,
            "final": r.isFinal, "at": (self.clock * 1000).rounded() / 1000,
          ])
          guard wake.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil else { continue }
          // One wake per stretch of speech: volatile results for the same range repeat it.
          if self.fired.contains(where: { abs($0 - start) < 1.0 }) { continue }
          self.fired.append(start)
          emit(["wake": true, "at": (self.clock * 1000).rounded() / 1000])
        }
      } catch {}
    }
  }

  func feed(_ b: AVAudioPCMBuffer) {
    clock += Double(b.frameLength) / HEAR_RATE
    guard let converter else {
      feedIn.yield(AnalyzerInput(buffer: b))
      return
    }
    let out = AVAudioPCMBuffer(
      pcmFormat: format,
      frameCapacity: AVAudioFrameCount(Double(b.frameLength) * format.sampleRate / HEAR_RATE) + 16)!
    var given = false
    converter.convert(to: out, error: nil) { _, status in
      if given {
        status.pointee = .noDataNow
        return nil
      }
      given = true
      status.pointee = .haveData
      return b
    }
    if out.frameLength > 0 { feedIn.yield(AnalyzerInput(buffer: out)) }
  }

  func finish() async {
    feedIn.finish()
    try? await analyzer.finalizeAndFinishThroughEndOfInput()
    await reading?.value
  }
}

/// A sound classifier trained on the wake phrase (Create ML): every window's "wake" score.
final class ClassifierSpike: NSObject, SNResultsObserving {
  let analyzer = SNAudioStreamAnalyzer(format: hearFormat)
  var frames: AVAudioFramePosition = 0

  init(model: String) {
    super.init()
    guard let ml = try? MLModel(contentsOf: URL(fileURLWithPath: model)),
      let req = try? SNClassifySoundRequest(mlModel: ml)
    else { fail("no_model") }
    req.windowDuration = CMTime(seconds: 1.5, preferredTimescale: 16000)
    req.overlapFactor = 0.75
    try? analyzer.add(req, withObserver: self)
  }

  func feed(_ b: AVAudioPCMBuffer) {
    analyzer.analyze(b, atAudioFramePosition: frames)
    frames += AVAudioFramePosition(b.frameLength)
  }

  func request(_ request: SNRequest, didProduce result: SNResult) {
    guard let r = result as? SNClassificationResult else { return }
    let score = r.classification(forIdentifier: "wake")?.confidence ?? 0
    let end = r.timeRange.start.seconds + r.timeRange.duration.seconds
    emit(["score": (score * 1000).rounded() / 1000, "at": (end * 1000).rounded() / 1000])
  }
}

func runWakeEval(_ path: String, engine: String, speed: Double) {
  let pieces = streamPieces(path)
  let pause = UInt64(100_000_000 / max(0.1, speed))
  Task { @MainActor in
    let started = Date()
    if engine == "sf" || engine == "sflm" {
      let s = LegacySpike()
      if engine == "sflm" {
        do { s.model = try await wakeLanguageModel() } catch { fail("language_model: \(error)") }
      }
      s.begin()
      for b in pieces {
        s.feed(b)
        try? await Task.sleep(nanoseconds: pause)
      }
      // Let a phrase at the very end count.
      for _ in 0..<12 {
        s.feed(AVAudioPCMBuffer(pcmFormat: hearFormat, frameCapacity: 1600).map { $0.frameLength = 1600; return $0 }!)
        try? await Task.sleep(nanoseconds: pause)
      }
    } else if engine == "analyzer", #available(macOS 26.0, *) {
      let s = AnalyzerSpike()
      await s.start()
      for b in pieces {
        s.feed(b)
        try? await Task.sleep(nanoseconds: pause)
      }
      await s.finish()
    } else if engine.hasPrefix("kws:") {
      let s = ClassifierSpike(model: String(engine.dropFirst(4)))
      for b in pieces { s.feed(b) }
      s.analyzer.completeAnalysis()
    } else {
      fail("unknown_engine")
    }
    emit(["done": true, "seconds": Date().timeIntervalSince(started)])
    exit(0)
  }
}
