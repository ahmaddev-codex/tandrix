// The voiceprint: how a voice sounds, as a short list of numbers, computed on this Mac only.
// Speech is cut into 25 ms frames; each frame's spectrum is folded onto the mel scale (how the ear
// hears pitch) and summarised as cepstral coefficients (MFCCs), which follow the shape of the
// speaker's vocal tract more than the words. The print is the mean and spread of those over the
// voiced frames. It tells one person from another in a quiet room or the TV; it is not a lock.
import Accelerate
import AVFoundation

let PRINT_RATE: Double = 16_000

enum Voiceprint {
  static let frame = 400  // 25 ms
  static let hop = 160  // 10 ms
  static let fftSize = 512
  static let mels = 26
  static let coeffs = 13
  static let filters: [[Float]] = melFilters()
  static let fft = vDSP.FFT(log2n: vDSP_Length(9), radix: .radix2, ofType: DSPSplitComplex.self)!
  static let window = vDSP.window(ofType: Float.self, usingSequence: .hamming, count: frame, isHalfWindow: false)

  /// The print of 16 kHz mono samples, and how many seconds of it were voiced; nil if too little.
  static func of(_ samples: [Float]) -> (print: [Float], voiced: Double)? {
    guard samples.count > frame else { return nil }
    var frames: [(energy: Float, cep: [Float])] = []
    var start = 0
    while start + frame <= samples.count {
      let chunk = Array(samples[start..<start + frame])
      frames.append(cepstrum(chunk))
      start += hop
    }
    // Voiced frames: within 30 dB of the loudest, and above a floor that silence never reaches.
    let loudest = frames.map(\.energy).max() ?? 0
    let kept = frames.filter { $0.energy > loudest - 3 && $0.energy > -6 }
    guard kept.count >= 40 else { return nil }  // under 0.4 s of voice
    var mean = [Float](repeating: 0, count: coeffs - 1)
    var spread = [Float](repeating: 0, count: coeffs - 1)
    for f in kept { for i in 0..<(coeffs - 1) { mean[i] += f.cep[i + 1] } }
    let n = Float(kept.count)
    for i in mean.indices { mean[i] /= n }
    for f in kept { for i in 0..<(coeffs - 1) { let d = f.cep[i + 1] - mean[i]; spread[i] += d * d } }
    for i in spread.indices { spread[i] = (spread[i] / n).squareRoot() }
    // A sinusoidal lifter, so the higher coefficients (finer vocal-tract detail) count as much as
    // the first, which mostly follows the microphone.
    let lifter = (1..<coeffs).map { 1 + 11 * sin(Float.pi * Float($0) / 22) }
    let lifted = mean.enumerated().map { $0.element * lifter[$0.offset] / 10 }
      + spread.enumerated().map { $0.element * lifter[$0.offset] / 10 }
    return (lifted, Double(kept.count) * Double(hop) / PRINT_RATE)
  }

  static func cepstrum(_ chunk: [Float]) -> (energy: Float, cep: [Float]) {
    var x = vDSP.multiply(chunk, window)
    x += [Float](repeating: 0, count: fftSize - frame)
    var real = [Float](repeating: 0, count: fftSize / 2)
    var imag = [Float](repeating: 0, count: fftSize / 2)
    var power = [Float](repeating: 0, count: fftSize / 2 + 1)
    real.withUnsafeMutableBufferPointer { r in
      imag.withUnsafeMutableBufferPointer { i in
        var split = DSPSplitComplex(realp: r.baseAddress!, imagp: i.baseAddress!)
        x.withUnsafeBytes { raw in
          vDSP_ctoz(raw.bindMemory(to: DSPComplex.self).baseAddress!, 2, &split, 1, vDSP_Length(fftSize / 2))
        }
        fft.forward(input: split, output: &split)
        // Packed: DC in real[0], Nyquist in imag[0].
        power[0] = split.realp[0] * split.realp[0]
        power[fftSize / 2] = split.imagp[0] * split.imagp[0]
        for k in 1..<(fftSize / 2) { power[k] = split.realp[k] * split.realp[k] + split.imagp[k] * split.imagp[k] }
      }
    }
    let energy = log10(max(power.reduce(0, +), 1e-10))
    let melLog = filters.map { f in log(max(zip(f, power).reduce(0) { $0 + $1.0 * $1.1 }, 1e-10)) }
    // DCT-II of the log mel energies.
    let cep = (0..<coeffs).map { k in
      melLog.enumerated().reduce(Float(0)) { $0 + $1.element * cos(Float.pi * Float(k) * (Float($1.offset) + 0.5) / Float(mels)) }
    }
    return (energy, cep)
  }

  static func melFilters() -> [[Float]] {
    let mel = { (hz: Double) in 2595 * log10(1 + hz / 700) }
    let hz = { (m: Double) in 700 * (pow(10, m / 2595) - 1) }
    let lo = mel(80), hi = mel(7600)
    let points = (0...(mels + 1)).map { hz(lo + (hi - lo) * Double($0) / Double(mels + 1)) }
    let bins = points.map { Int(($0 / PRINT_RATE) * Double(fftSize)) }
    return (1...mels).map { m in
      var f = [Float](repeating: 0, count: fftSize / 2 + 1)
      for k in bins[m - 1]..<bins[m] where bins[m] > bins[m - 1] { f[k] = Float(k - bins[m - 1]) / Float(bins[m] - bins[m - 1]) }
      for k in bins[m]..<bins[m + 1] where bins[m + 1] > bins[m] { f[k] = Float(bins[m + 1] - k) / Float(bins[m + 1] - bins[m]) }
      return f
    }
  }
}

/// Converts whatever the microphone or a file gives to 16 kHz mono floats.
final class Resampler {
  let converter: AVAudioConverter
  let out = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: PRINT_RATE, channels: 1, interleaved: false)!

  init?(from format: AVAudioFormat) {
    guard let c = AVAudioConverter(from: format, to: out) else { return nil }
    converter = c
  }

  func convert(_ buffer: AVAudioPCMBuffer) -> [Float] {
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * PRINT_RATE / buffer.format.sampleRate) + 64
    guard let dest = AVAudioPCMBuffer(pcmFormat: out, frameCapacity: capacity) else { return [] }
    var fed = false
    var error: NSError?
    converter.convert(to: dest, error: &error) { _, status in
      if fed {
        status.pointee = .noDataNow
        return nil
      }
      fed = true
      status.pointee = .haveData
      return buffer
    }
    guard let data = dest.floatChannelData else { return [] }
    return Array(UnsafeBufferPointer(start: data[0], count: Int(dest.frameLength)))
  }
}

/// The last few seconds heard, at 16 kHz, so a wake phrase can be checked against the print.
final class Recent {
  private var samples: [Float] = []
  /// Samples heard since the helper started; `samples` ends at this count.
  private(set) var total = 0
  private let keep: Int
  private let lock = NSLock()
  /// Samples being collected for a voice setup phrase, when one is recording.
  private var recording: [Float]?

  init(seconds: Double) { keep = Int(seconds * PRINT_RATE) }

  func append(_ s: [Float]) {
    lock.lock()
    defer { lock.unlock() }
    samples += s
    total += s.count
    if samples.count > keep { samples.removeFirst(samples.count - keep) }
    recording? += s
  }

  /// The samples from absolute position `from` (in `total` terms) to now, as far as still kept.
  func since(_ from: Int) -> [Float] {
    lock.lock()
    defer { lock.unlock() }
    let back = min(max(total - from, 0), samples.count)
    return Array(samples.suffix(back))
  }

  var now: Int {
    lock.lock()
    defer { lock.unlock() }
    return total
  }

  func startRecording() {
    lock.lock()
    recording = []
    lock.unlock()
  }

  func stopRecording() -> [Float] {
    lock.lock()
    defer { lock.unlock() }
    let r = recording ?? []
    recording = nil
    return r
  }
}

/// The print of an audio file (for tests): `tandrix-wake --print file.aiff`.
func printOfFile(_ path: String) -> [String: Any] {
  guard let file = try? AVAudioFile(forReading: URL(fileURLWithPath: path)),
    let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
    (try? file.read(into: buffer)) != nil,
    let resampler = Resampler(from: file.processingFormat)
  else { return ["error": "unreadable"] }
  guard let p = Voiceprint.of(resampler.convert(buffer)) else { return ["error": "too_short"] }
  return ["print": p.print, "voiced": p.voiced]
}
