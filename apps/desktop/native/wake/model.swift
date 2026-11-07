// The dedicated wake-word model (scripts/wake/model): fires as "Tandrix" ends, said alone or after
// "Hey", "Okay" or "Wake up". It hears the word itself, so it doesn't depend on a speech recogniser
// knowing a made-up name. One Core ML call each 80 ms; this keeps what each call needs from the
// ones before (the last mel frames and embeddings).
import CoreML
import Foundation

final class WakeModel {
  static let chunk = 1280  // 80 ms at 16 kHz
  static let context = 480  // the 30 ms before each piece
  private let model: MLModel
  private var pending: [Float] = []
  private var tail = [Float](repeating: 0, count: WakeModel.context)
  private let mels: MLMultiArray
  private let embs: MLMultiArray
  private let audio: MLMultiArray
  /// Pieces heard since the start, so a score's time is known.
  private(set) var pieces = 0
  /// The score that wakes, and how many pieces in a row must reach it.
  let threshold: Float
  let inARow: Int
  private var run = 0
  private var lastWake = -1000
  /// Woke, at this many seconds of audio (the end of the piece that crossed).
  var onWake: ((Double, Float) -> Void)?

  init?(url: URL, threshold: Float, inARow: Int) {
    let config = MLModelConfiguration()
    config.computeUnits = .cpuAndNeuralEngine
    guard let m = try? MLModel(contentsOf: url, configuration: config),
      let mels = try? MLMultiArray(shape: [1, 68, 32], dataType: .float32),
      let embs = try? MLMultiArray(shape: [1, 15, 96], dataType: .float32),
      let audio = try? MLMultiArray(shape: [1, NSNumber(value: WakeModel.chunk + WakeModel.context)], dataType: .float32)
    else { return nil }
    model = m
    self.mels = mels
    self.embs = embs
    self.audio = audio
    self.threshold = threshold
    self.inARow = inARow
    for a in [mels, embs] { for i in 0..<a.count { a[i] = 0 } }
  }

  /// Chosen on the test sets (docs/engineering/spikes.md): the most wakes caught while staying
  /// under the false-wake budget.
  static let defaultThreshold: Float = 0.9
  static let defaultInARow = 1

  /// The model shipped beside the helper.
  static func bundled(threshold: Float, inARow: Int) -> WakeModel? {
    let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
    let url = exe.deletingLastPathComponent().appendingPathComponent("TandrixWake.mlmodelc")
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return WakeModel(url: url, threshold: threshold, inARow: inARow)
  }

  /// 16 kHz samples in [-1, 1], any amount.
  func feed(_ samples: [Float]) {
    pending.append(contentsOf: samples)
    while pending.count >= WakeModel.chunk {
      let piece = Array(pending.prefix(WakeModel.chunk))
      pending.removeFirst(WakeModel.chunk)
      step(piece)
    }
  }

  private func step(_ piece: [Float]) {
    // The model takes int16-scaled audio, as it was trained.
    let ptr = audio.dataPointer.assumingMemoryBound(to: Float.self)
    for i in 0..<WakeModel.context { ptr[i] = tail[i] }
    for i in 0..<WakeModel.chunk { ptr[WakeModel.context + i] = piece[i] * 32767 }
    tail = Array(piece.suffix(WakeModel.context)).map { $0 * 32767 }
    pieces += 1
    guard
      let input = try? MLDictionaryFeatureProvider(dictionary: [
        "audio": MLFeatureValue(multiArray: audio),
        "mels": MLFeatureValue(multiArray: mels),
        "embs": MLFeatureValue(multiArray: embs),
      ]),
      let out = try? model.prediction(from: input),
      let frames = out.featureValue(for: "frames")?.multiArrayValue,
      let emb = out.featureValue(for: "emb")?.multiArrayValue,
      let score = out.featureValue(for: "score")?.multiArrayValue
    else { return }
    shift(mels, by: 8 * 32, adding: frames)
    shift(embs, by: 96, adding: emb)
    // The first 25 pieces (2 s) are still filling the history with silence.
    guard pieces > 25 else { return }
    let s = score[0].floatValue
    run = s >= threshold ? run + 1 : 0
    // Once per phrase: not again within two seconds.
    if run >= inARow && pieces - lastWake > 25 {
      lastWake = pieces
      onWake?(Double(pieces * WakeModel.chunk) / 16_000, s)
    }
  }

  /// Drops the oldest `by` numbers of `a` and appends `adding` (all of it, `by` numbers).
  private func shift(_ a: MLMultiArray, by: Int, adding: MLMultiArray) {
    let p = a.dataPointer.assumingMemoryBound(to: Float.self)
    let n = a.count
    p.update(from: p + by, count: n - by)
    let q = adding.dataPointer.assumingMemoryBound(to: Float.self)
    (p + n - by).update(from: q, count: by)
  }
}
