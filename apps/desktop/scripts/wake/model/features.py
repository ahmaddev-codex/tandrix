"""
The speech features the wake-word model listens to: openWakeWord's melspectrogram and Google's
speech embedding (fixtures/wake/models). 16 kHz audio becomes one 96-number embedding every 80 ms;
the detector looks at the last 16 (1.28 s of embeddings, about 2 s of audio).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf

ROOT = Path(__file__).resolve().parents[5]
WAKE = ROOT / "fixtures" / "wake"
MODELS = WAKE / "models"
RATE = 16_000
# Melspectrogram frames per embedding, frames between embeddings, embeddings per decision.
MEL_WINDOW = 76
MEL_STEP = 8
FRAMES = 16
# Audio arrives 80 ms at a time; each piece, with 30 ms before it, gives 8 mel frames.
CHUNK = 1280
CONTEXT = 480
# Audio for one decision: 25 pieces (200 frames), enough for 16 embeddings.
WINDOW_SAMPLES = 25 * CHUNK


def _session(name: str) -> ort.InferenceSession:
    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 1
    opts.intra_op_num_threads = 4
    return ort.InferenceSession(str(MODELS / name), opts, providers=["CPUExecutionProvider"])


class Featurizer:
    def __init__(self) -> None:
        import torch

        from net import MelSpec

        self.torch = torch
        torch.set_num_threads(6)
        self.mel = MelSpec().eval()
        self.emb = _session("embedding_model.onnx")

    def mels(self, audio: np.ndarray) -> np.ndarray:
        """(batch, samples) int16-scaled floats → (batch, frames, 32), as heard live: 80 ms at a
        time, each piece with the 30 ms before it (silence before the start)."""
        x = np.atleast_2d(audio).astype(np.float32)
        b, n = x.shape
        pieces = n // CHUNK
        padded = np.concatenate([np.zeros((b, CONTEXT), np.float32), x[:, : pieces * CHUNK]], 1)
        idx = np.arange(pieces)[:, None] * CHUNK + np.arange(CHUNK + CONTEXT)[None]
        chunks = padded[:, idx].reshape(-1, CHUNK + CONTEXT)
        with self.torch.no_grad():
            outs = [
                self.mel(self.torch.from_numpy(chunks[i : i + 8192])).numpy()
                for i in range(0, len(chunks), 8192)
            ]
        return np.concatenate(outs).reshape(b, pieces * 8, 32)

    def embed_mels(self, mels: np.ndarray) -> np.ndarray:
        """(batch, frames, 32) → (batch, n, 96): one each 8 frames, over the 76 before it."""
        b, t, _ = mels.shape
        ends = list(range(MEL_WINDOW, t + 1, MEL_STEP))
        # Aligned to the end, as live: an embedding after every piece of audio.
        ends = [e + (t - ends[-1]) for e in ends] if ends else []
        if not ends:
            return np.zeros((b, 0, 96), np.float32)
        wins = np.stack([mels[:, e - MEL_WINDOW : e] for e in ends], axis=1)
        flat = wins.reshape(-1, MEL_WINDOW, 32, 1).astype(np.float32)
        outs = [
            self.emb.run(None, {"input_1": flat[i : i + 2048]})[0]
            for i in range(0, len(flat), 2048)
        ]
        return np.concatenate(outs).reshape(b, len(ends), 96)

    def clips(self, audio: np.ndarray, batch: int = 256) -> np.ndarray:
        """(n, WINDOW_SAMPLES) → (n, 16, 96): one decision's features per clip, at its end."""
        out = []
        for i in range(0, len(audio), batch):
            e = self.embed_mels(self.mels(audio[i : i + batch]))
            out.append(e[:, -FRAMES:])
        return np.concatenate(out) if out else np.zeros((0, FRAMES, 96), np.float32)

    def stream(self, audio: np.ndarray) -> np.ndarray:
        """A long recording → (n, 96), one embedding every 80 ms, exactly as heard live."""
        out = []
        # Ten minutes at a time, each with the 30 ms and 76 frames before it.
        step = 10 * 60 * RATE // CHUNK * CHUNK
        keep = (MEL_WINDOW // 8 + 1) * CHUNK
        for at in range(0, len(audio), step):
            lead = min(at, keep)
            e = self.embed_mels(self.mels(audio[at - lead : at + step][None]))[0]
            # Drop the one that ends where the lead does: the previous piece has it.
            out.append(e[lead // CHUNK - 9 :] if at else e)
        return np.concatenate(out) if out else np.zeros((0, 96), np.float32)


def load(path: Path | str) -> np.ndarray:
    """Any 16 kHz mono file → int16-scaled float32."""
    x, sr = sf.read(str(path), dtype="int16", always_2d=True)
    if sr != RATE:
        raise ValueError(f"{path}: {sr} Hz, expected {RATE}")
    return x[:, 0].astype(np.float32)


def windows(emb: np.ndarray, stride: int = 1) -> np.ndarray:
    """(n, 96) → (m, 16, 96): every decision along a stream."""
    if len(emb) < FRAMES:
        return np.zeros((0, FRAMES, 96), np.float32)
    idx = np.arange(0, len(emb) - FRAMES + 1, stride)
    return np.stack([emb[i : i + FRAMES] for i in idx])
