// VO1 spike: trains a wake-phrase sound classifier with Create ML on the synthetic training clips
// (fixtures/wake/train: pos = "wake", neg = "other"), then compiles it for SoundAnalysis.
//   swift apps/desktop/scripts/wake/train.swift [fixtures/wake] [train2]
// With a second argument, that folder's wake/ and other/ clips (wake-sets.ts --train-more).
import CreateML
import CoreML
import Foundation

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "fixtures/wake")
func wavs(_ dir: String) -> [URL] {
  ((try? FileManager.default.contentsOfDirectory(at: root.appendingPathComponent(dir), includingPropertiesForKeys: nil)) ?? [])
    .filter { $0.pathExtension == "wav" }
}
let set = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : nil
let data: [String: [URL]] = set.map { ["wake": wavs("\($0)/wake"), "other": wavs("\($0)/other")] }
  ?? ["wake": wavs("train/pos"), "other": wavs("train/neg")]
print("training on \(data["wake"]!.count) wake, \(data["other"]!.count) other clips")
let started = Date()
let params = MLSoundClassifier.ModelParameters(
  validation: .split(strategy: .automatic), maxIterations: 60, overlapFactor: 0.5)
let model = try MLSoundClassifier(trainingData: .filesByLabel(data), parameters: params)
print("trained in \(Int(Date().timeIntervalSince(started))) s; training accuracy \(String(format: "%.1f", (1 - model.trainingMetrics.classificationError) * 100))%, validation \(String(format: "%.1f", (1 - model.validationMetrics.classificationError) * 100))%")
let out = root.appendingPathComponent("wake.mlmodel")
try model.write(to: out)
let compiled = try MLModel.compileModel(at: out)
let dest = root.appendingPathComponent("wake.mlmodelc")
try? FileManager.default.removeItem(at: dest)
try FileManager.default.moveItem(at: compiled, to: dest)
print("wrote \(dest.path)")
