// The text on a screenshot and exactly where it is, read on this Mac (Apple's Vision, on device):
// so Tandrix can underline, box or highlight the very words, line of code or formula it's
// explaining, instead of the model's rough box round them.
//   tandrix-text <image>          → one JSON line: {"width":…,"height":…,"lines":[…]}
// Each line: {"text":"…","box":[x,y,w,h],"chars":[[x,w],…]}: its box in image pixels (top-left
// origin) and, per character, where it starts and how wide it is, so part of a line can be found.
import AppKit
import Foundation
import Vision

func fail(_ why: String) -> Never {
  FileHandle.standardError.write("\(why)\n".data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count >= 2, let image = NSImage(contentsOfFile: args[1]),
  let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else { fail("usage: tandrix-text <image>") }
let W = Double(cg.width)
let H = Double(cg.height)

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
// Code and formulas aren't dictionary words: read them as written.
request.usesLanguageCorrection = false
request.minimumTextHeight = 0
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
do { try handler.perform([request]) } catch { fail("vision: \(error)") }

var lines: [[String: Any]] = []
for obs in request.results ?? [] {
  guard let top = obs.topCandidates(1).first else { continue }
  let text = top.string
  let r = obs.boundingBox
  let x: Double = Double(r.minX) * W
  let y: Double = (1 - Double(r.maxY)) * H
  let w: Double = Double(r.width) * W
  let h: Double = Double(r.height) * H
  let box: [Double] = [x, y, w, h].map { ($0 * 10).rounded() / 10 }
  var chars: [[Double]] = []
  var i = text.startIndex
  while i < text.endIndex {
    let next = text.index(after: i)
    if let b = try? top.boundingBox(for: i..<next)?.boundingBox {
      let cx: Double = (Double(b.minX) * W * 10).rounded() / 10
      let cw: Double = (Double(b.width) * W * 10).rounded() / 10
      chars.append([cx, cw])
    } else {
      chars.append([box[0], 0])
    }
    i = next
  }
  lines.append(["text": text, "box": box, "chars": chars])
}
let out: [String: Any] = ["width": W, "height": H, "lines": lines]
let data = try! JSONSerialization.data(withJSONObject: out)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
