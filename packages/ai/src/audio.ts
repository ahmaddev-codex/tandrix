// WAV checks before a transcription call: Muse Voice Transcribe takes a RIFF/WAVE container with
// mono, 16-bit integer PCM at 16 or 24 kHz. Anything else is refused here, not by a paid call.

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

export type WavCheck = { ok: true; info: WavInfo } | { ok: false; reason: string };

const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n));

export function wavInfo(bytes: Uint8Array): WavCheck {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") {
    return { ok: false, reason: "not a WAV file" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt: (Omit<WavInfo, "durationMs"> & { format: number; blockAlign: number }) | null = null;
  let dataBytes: number | null = null;
  // Walk the chunks: recorders add their own (LIST, FLLR) before data.
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = ascii(bytes, at, 4);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt " && size >= 16) {
      fmt = {
        format: view.getUint16(at + 8, true),
        channels: view.getUint16(at + 10, true),
        sampleRate: view.getUint32(at + 12, true),
        blockAlign: view.getUint16(at + 20, true),
        bitsPerSample: view.getUint16(at + 22, true),
      };
    } else if (id === "data") {
      dataBytes = Math.min(size, bytes.length - at - 8);
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (!fmt || dataBytes === null) return { ok: false, reason: "WAV has no format or audio data" };
  if (fmt.format !== 1) return { ok: false, reason: "WAV isn't plain PCM" };
  if (fmt.channels !== 1) return { ok: false, reason: "WAV must be mono" };
  if (fmt.bitsPerSample !== 16) return { ok: false, reason: "WAV must be 16-bit" };
  if (fmt.sampleRate !== 16000 && fmt.sampleRate !== 24000) {
    return { ok: false, reason: "WAV must be 16 or 24 kHz" };
  }
  return {
    ok: true,
    info: {
      sampleRate: fmt.sampleRate,
      channels: fmt.channels,
      bitsPerSample: fmt.bitsPerSample,
      durationMs: Math.round((dataBytes / fmt.blockAlign / fmt.sampleRate) * 1000),
    },
  };
}
