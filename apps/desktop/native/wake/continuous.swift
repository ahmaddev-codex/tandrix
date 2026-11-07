// The wake word without gaps (VO2), chosen in the VO1 spike (docs/engineering/spikes.md): one
// SpeechTranscriber task that runs as long as the wake word is on, so nothing is lost to the old
// recogniser's restarts, and the name is matched by how it sounds, not by a list of spellings.
// Two events: {"heard":true} the moment the name shows (the panel chimes), then the wake itself
// once the user pauses, with what they said after the name and the phrase's voiceprint.
import AVFoundation
import Foundation
import Speech

/// The wake phrase by sound (scripts/wake/match.ts is the same rule, for the spike's scorer):
/// "hey" or "wake up" (or "hi", "okay") then a word that sounds like Tandrix, or two run together;
/// or "Tandrix" itself, spelled right, to open a sentence.
enum WakeRule {
  /// The name to listen for, by sound: Tandrix unless the user chose another (VO6).
  static var name = soundOf("Tandrix")

  /// A name the user chose: letters only, one word, 3 to 20 of them; anything else is ignored.
  static func setName(_ word: String) {
    let w = word.trimmingCharacters(in: .whitespaces)
    guard (3...20).contains(w.count), w.allSatisfy({ $0.isLetter }) else { return }
    name = soundOf(w)
    nameWord = w
  }

  static func soundOf(_ word: String) -> String {
    var s = word.lowercased().filter { $0 >= "a" && $0 <= "z" }
    if s.hasPrefix("ch") { s = "t" + s.dropFirst(2) }
    for end in ["ggs", "gs", "cks", "cs", "x", "ks"] where s.hasSuffix(end) {
      s = String(s.dropLast(end.count)) + "ks"
      break
    }
    return s.replacingOccurrences(of: "ck", with: "k")
  }

  static func distance(_ a: String, _ b: String) -> Int {
    let a = Array(a), b = Array(b)
    if a.isEmpty { return b.count }
    if b.isEmpty { return a.count }
    var prev = Array(0...b.count)
    for i in 1...a.count {
      var cur = [i] + Array(repeating: 0, count: b.count)
      for j in 1...b.count {
        cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
      }
      prev = cur
    }
    return prev[b.count]
  }

  /// Within `slack` letters of the name, and nearly as long; a short name gets less slack
  /// ("Max" ±2 would be nearly any short word).
  static func soundsLikeName(_ word: String, slack: Int) -> Bool {
    let s = soundOf(word)
    let allowed = min(slack, name.count / 3)
    return s.count >= max(3, name.count - 3) && distance(s, name) <= allowed
  }

  /// Consonants only, after the first letter, with spelling folded to sound: "Hey Tandrix",
  /// "Hate and Rex" and "Haitian tricks" all come close to "htndrks". Recognisers often run
  /// "hey" into the name, so the whole phrase is compared this way too.
  static func skeleton(_ text: String) -> String {
    var s = text.lowercased().filter { $0 >= "a" && $0 <= "z" }
    for (from, to) in [("ck", "k"), ("x", "ks"), ("ph", "f"), ("ch", "t"), ("c", "k")] {
      s = s.replacingOccurrences(of: from, with: to)
    }
    guard let first = s.first else { return "" }
    return String(first) + s.dropFirst().filter { !"aeiouy".contains($0) }
  }

  static var phrases: [String] { ["hey", "wakeup"].map { skeleton($0) + skeleton("b" + nameWord).dropFirst() } }
  /// The name as the user spells it, for the phrase check.
  static var nameWord = "Tandrix"

  static let numbers = [
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
    "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve",
    "20": "twenty", "100": "hundred",
  ]

  /// Numbers as words: recognisers write the "Tan" of Tandrix as "10" ("Wake up 10 breaks").
  static func spelledOut(_ text: String) -> String {
    let re = try! NSRegularExpression(pattern: "\\b\\d+\\b")
    var out = text
    for m in re.matches(in: text, range: NSRange(location: 0, length: (text as NSString).length)).reversed() {
      let n = (text as NSString).substring(with: m.range)
      if let w = numbers[n], let r = Range(m.range, in: out) { out.replaceSubrange(r, with: w) }
    }
    return out
  }

  /// Whether the text holds the wake phrase, and what was said after the name.
  static func match(_ raw: String, slack: Int = 2) -> (woke: Bool, rest: String) {
    let text = spelledOut(raw)
    let ns = text as NSString
    let words = (try! NSRegularExpression(pattern: "[A-Za-z']+"))
      .matches(in: text, range: NSRange(location: 0, length: ns.length))
      .map { (word: ns.substring(with: $0.range).lowercased(), range: $0.range) }
    func rest(after i: Int) -> String {
      let end = words[i].range.location + words[i].range.length
      return ns.substring(from: end)
        .trimmingCharacters(in: CharacterSet(charactersIn: " ,.!?;:-–—").union(.whitespacesAndNewlines))
    }
    // The name on its own, anywhere, heard nearly right ("Tandrix", "Tendrix"; not "Hendrix").
    if let i = words.firstIndex(where: { soundsLikeName($0.word, slack: 1) }) { return (true, rest(after: i)) }
    // The whole phrase by its consonants, over two to four words ("Hate and Rex"); never one word
    // alone ("Hendrix" is a name people say).
    let targets = phrases
    for i in words.indices {
      var joined = ""
      for j in i..<min(words.count, i + 4) {
        joined += words[j].word
        let k = skeleton(joined)
        // One letter off "hey Tandrix"; two off the longer "wake up Tandrix" ("We got tandrakes").
        if j > i, targets.contains(where: { k.count >= $0.count - 1 && distance(k, $0) <= ($0.count >= 9 ? 2 : 1) }) {
          return (true, rest(after: j))
        }
      }
    }
    for i in words.indices {
      let lead = words[i].word == "wake" && i + 1 < words.count && words[i + 1].word == "up"
        ? 2 : ["hey", "he", "hi", "ok", "okay"].contains(words[i].word) ? 1 : 0
      guard lead > 0, i + lead < words.count else { continue }
      let a = i + lead
      if soundsLikeName(words[a].word, slack: slack) { return (true, rest(after: a)) }
      if a + 1 < words.count, soundsLikeName(words[a].word + words[a + 1].word, slack: slack) {
        return (true, rest(after: a + 1))
      }
    }
    return (false, "")
  }
}

@available(macOS 26.0, *)
final class ContinuousListener: WakeListening {
  var mic: Mic?
  let recent = Recent(seconds: 8)
  /// Partial results as they form, and sooner (fastResults), for the earliest "heard".
  let transcriber = SpeechTranscriber(
    locale: Locale(identifier: "en-US"), transcriptionOptions: [],
    reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
  var feed: AsyncStream<AnalyzerInput>.Continuation?
  var format = hearFormat
  var converter: AVAudioConverter?
  /// Where in `recent` the analysis began, so a result's audio time finds its samples.
  var startIndex = 0
  /// The phrase heard and waiting for a pause: its start (seconds into the analysis), text, and
  /// when it last changed.
  var pending: (start: Double, text: String, changed: Date)?
  /// Phrases already acted on, by start, so one phrase wakes once.
  var done: [Double] = []

  /// The newer transcriber, with its English model on this Mac.
  static func ready() async -> Bool {
    guard SpeechTranscriber.isAvailable else { return false }
    let t = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .progressiveTranscription)
    return await AssetInventory.status(forModules: [t]) == .installed
  }

  func start() async {
    if let f = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]), f != hearFormat {
      format = f
      converter = AVAudioConverter(from: hearFormat, to: f)
    }
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let (input, cont) = AsyncStream<AnalyzerInput>.makeStream()
    feed = cont
    let ctx = AnalysisContext()
    ctx.contextualStrings[.general] = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"]
    try? await analyzer.setContext(ctx)
    // start returns only when the input ends: it runs alongside.
    Task { try? await analyzer.start(inputSequence: input) }

    startIndex = recent.now
    // Tests: TANDRIX_WAKE_FILE plays a 16 kHz WAV in place of the microphone, at real speed.
    if let file = ProcessInfo.processInfo.environment["TANDRIX_WAKE_FILE"] {
      let pieces = streamPieces(file)
      Task { @MainActor [weak self] in
        for b in pieces {
          guard let self else { return }
          let samples = Array(UnsafeBufferPointer(start: b.floatChannelData![0], count: Int(b.frameLength)))
          self.recent.append(samples)
          self.push(samples)
          try? await Task.sleep(nanoseconds: 100_000_000)
        }
      }
    } else {
      let mic = Mic { [weak self] _, samples in
        self?.recent.append(samples)
        self?.push(samples)
      }
      guard mic.start() else { fail("microphone_unavailable") }
      self.mic = mic
    }

    let results = transcriber.results
    Task { @MainActor [weak self] in
      do {
        for try await r in results {
          self?.handle(text: String(r.text.characters), start: r.range.start.seconds, final: r.isFinal)
        }
      } catch {}
    }
    // The phrase's final result says it's been said in full; if none comes, two seconds without a
    // change does. (Firing sooner cut questions short: "Hey Tandrix, what's on…".)
    Task { @MainActor [weak self] in
      while let self {
        if let p = self.pending, Date().timeIntervalSince(p.changed) > 2 { self.fire() }
        try? await Task.sleep(nanoseconds: 100_000_000)
      }
    }
    emit(["ready": true, "engine": "continuous"])
  }

  /// 16 kHz samples to the transcriber, in its format.
  func push(_ samples: [Float]) {
    guard !samples.isEmpty,
      let b = AVAudioPCMBuffer(pcmFormat: hearFormat, frameCapacity: AVAudioFrameCount(samples.count))
    else { return }
    b.frameLength = AVAudioFrameCount(samples.count)
    samples.withUnsafeBufferPointer { b.floatChannelData![0].update(from: $0.baseAddress!, count: samples.count) }
    guard let converter else {
      feed?.yield(AnalyzerInput(buffer: b))
      return
    }
    guard let out = AVAudioPCMBuffer(
      pcmFormat: format,
      frameCapacity: AVAudioFrameCount(Double(samples.count) * format.sampleRate / HEAR_RATE) + 16)
    else { return }
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
    if out.frameLength > 0 { feed?.yield(AnalyzerInput(buffer: out)) }
  }

  func handle(text: String, start: Double, final: Bool) {
    if debug { FileHandle.standardError.write("heard: \(text)\n".data(using: .utf8)!) }
    if done.contains(where: { abs($0 - start) < 1 }) { return }
    // One phrase waits at a time: while it does, what's heard is that phrase as it grows (the
    // recogniser may move its start as it revises).
    if let p = pending, abs(p.start - start) < 1 || WakeRule.match(text).woke {
      if text != p.text { pending = (p.start, text, Date()) }
      if final { fire() }
      return
    }
    guard WakeRule.match(text).woke else { return }
    pending = (start, text, Date())
    // At once: the panel chimes while the user is still talking.
    emit(["heard": true])
    if final { fire() }
  }

  func fire() {
    guard let p = pending else { return }
    pending = nil
    done.append(p.start)
    if done.count > 50 { done.removeFirst(done.count - 50) }
    var event: [String: Any] = ["wake": true, "rest": WakeRule.match(p.text).rest]
    // The phrase's voice: from its start (a beat before) to now, at most 6 s.
    let from = startIndex + Int((p.start - 0.15) * PRINT_RATE)
    let phrase = recent.since(max(from, recent.now - Int(6 * PRINT_RATE)))
    if let print = Voiceprint.of(phrase) { event["voice"] = print.print }
    emit(event)
  }

  func command(_ line: String) {
    guard let data = line.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }
    if let name = obj["name"] as? String { WakeRule.setName(name) }
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
}
