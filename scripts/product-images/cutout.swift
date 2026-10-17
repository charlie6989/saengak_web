// Usage: cutout <input> <output.png> [all|largest|i,j]
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: cutout in out [all|largest|indices]"); exit(2) }
let url = URL(fileURLWithPath: args[1])
let mode = args.count > 3 ? args[3] : "all"
guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read"); exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([req])
guard let obs = req.results?.first else { print("no foreground"); exit(3) }
var set = obs.allInstances
if mode == "largest" || mode.contains(",") || Int(mode) != nil {
  // compute instance areas
  let labels = obs.instanceMask
  CVPixelBufferLockBaseAddress(labels, .readOnly)
  let w = CVPixelBufferGetWidth(labels), h = CVPixelBufferGetHeight(labels), rb = CVPixelBufferGetBytesPerRow(labels)
  let base = CVPixelBufferGetBaseAddress(labels)!.assumingMemoryBound(to: UInt8.self)
  var counts = [Int: Int]()
  for y in 0..<h { for x in 0..<w { let v = Int(base[y*rb+x]); if v > 0 { counts[v, default: 0] += 1 } } }
  CVPixelBufferUnlockBaseAddress(labels, .readOnly)
  let sorted = counts.sorted { $0.value > $1.value }
  print("instances:", sorted.map { "\($0.key):\($0.value)" }.joined(separator: " "))
  if mode == "largest" { set = IndexSet(integer: sorted[0].key) }
  else { set = IndexSet(mode.split(separator: ",").compactMap { Int($0) }) }
} else { print("instances:", obs.allInstances.map { String($0) }.joined(separator: ",")) }
let maskBuf = try obs.generateScaledMaskForImage(forInstances: set, from: handler)
let ciImg = CIImage(cgImage: cg)
let mask = CIImage(cvPixelBuffer: maskBuf)
let f = CIFilter.blendWithMask()
f.inputImage = ciImg
f.backgroundImage = CIImage.empty().cropped(to: ciImg.extent)
f.maskImage = mask
let ctx = CIContext()
let out = f.outputImage!
guard let outCG = ctx.createCGImage(out, from: ciImg.extent, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else { exit(4) }
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, outCG, nil)
CGImageDestinationFinalize(dest)
print("ok", outCG.width, outCG.height)
