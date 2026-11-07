// The microphone for the wake word, kept running. macOS stops an audio engine whenever the input
// changes (Tandrix's own panel starts recording a question with echo cancellation, another app
// takes the mic, a headset is plugged in) and nothing starts it again: the wake word would go deaf
// after the first spoken question. So a change restarts it, and so does three seconds with no
// audio at all.
import AVFoundation
import Foundation

final class Mic {
  let engine = AVAudioEngine()
  /// Each piece of audio: as the mic gives it, and at 16 kHz mono.
  let onAudio: (AVAudioPCMBuffer, [Float]) -> Void
  /// The mic restarted (its format may have changed).
  var onRestart: (() -> Void)?
  private var resampler: Resampler?
  private let lock = NSLock()
  private var lastAudio = Date()
  private var observer: NSObjectProtocol?
  private var watchdog: DispatchSourceTimer?

  init(onAudio: @escaping (AVAudioPCMBuffer, [Float]) -> Void) {
    self.onAudio = onAudio
  }

  /// Starts listening; false when the microphone can't be used.
  func start() -> Bool {
    guard (try? install()) != nil else { return false }
    observer = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
    ) { [weak self] _ in self?.restart("the input changed") }
    let timer = DispatchSource.makeTimerSource(queue: .main)
    timer.schedule(deadline: .now() + 1, repeating: 1)
    timer.setEventHandler { [weak self] in
      guard let self else { return }
      self.lock.lock()
      let quiet = Date().timeIntervalSince(self.lastAudio)
      self.lock.unlock()
      if quiet > 3 { self.restart("no audio for \(Int(quiet)) s") }
    }
    timer.resume()
    watchdog = timer
    return true
  }

  private func install() throws {
    let input = engine.inputNode
    input.removeTap(onBus: 0)
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw MicError.noInput }
    guard let resampler = Resampler(from: format) else { throw MicError.noInput }
    self.resampler = resampler
    input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
      guard let self else { return }
      self.lock.lock()
      self.lastAudio = Date()
      self.lock.unlock()
      self.onAudio(buffer, resampler.convert(buffer))
    }
    engine.prepare()
    try engine.start()
    lock.lock()
    lastAudio = Date()
    lock.unlock()
  }

  private func restart(_ why: String) {
    if debug { FileHandle.standardError.write("mic restart: \(why)\n".data(using: .utf8)!) }
    engine.stop()
    // Tried again by the watchdog in a few seconds if the input isn't ready yet.
    if (try? install()) != nil { onRestart?() }
    lock.lock()
    lastAudio = Date()
    lock.unlock()
  }

  enum MicError: Error { case noInput }
}
