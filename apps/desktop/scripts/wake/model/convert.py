"""
Converts the trained detector to Core ML for the Mac's wake helper (native/wake): one call each
80 ms of audio, stateless, the helper keeping what came before.

    .venv/bin/python -I convert.py   # → fixtures/wake/model/TandrixWake.mlpackage

Inputs:  audio  (1, 1760)    the newest 80 ms with the 30 ms before it, int16-scaled floats
         mels   (1, 68, 32)  the 68 mel frames before this piece's 8
         embs   (1, 15, 96)  the 15 embeddings before this piece's one
Outputs: frames (1, 8, 32)   this piece's mel frames, to keep
         emb    (1, 96)      this piece's embedding, to keep
         score  (1,)         the chance "Tandrix" has just been said
"""

from __future__ import annotations

import sys
from pathlib import Path

import coremltools as ct
import numpy as np
import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).parent))
from features import CHUNK, CONTEXT, FRAMES, MEL_WINDOW, WAKE, Featurizer, load, windows  # noqa: E402
from net import Detector, MelSpec, embedding  # noqa: E402

OUT = WAKE / "model" / "TandrixWake.mlpackage"


def _register_broadcast_to() -> None:
    """The converted embedding model uses broadcast_to, which coremltools doesn't know: a tile."""
    from coremltools.converters.mil import Builder as mb
    from coremltools.converters.mil.frontend.torch.ops import _get_inputs
    from coremltools.converters.mil.frontend.torch.torch_op_registry import register_torch_op

    @register_torch_op(override=True)
    def broadcast_to(context, node):
        x, shape = _get_inputs(context, node, expected=2)
        want = [int(v) for v in shape.val]
        have = list(x.shape)
        while len(have) < len(want):
            x = mb.expand_dims(x=x, axes=[0])
            have = [1, *have]
        reps = [w // h if h != w else 1 for w, h in zip(want, have)]
        context.add(mb.tile(x=x, reps=reps, name=node.name))


_register_broadcast_to()


class Step(nn.Module):
    def __init__(self, detector: Detector) -> None:
        super().__init__()
        self.mel = MelSpec()
        self.emb = embedding()
        self.det = detector

    def forward(self, audio, mels, embs):
        frames = self.mel(audio)
        window = torch.cat([mels, frames], dim=1)[:, -MEL_WINDOW:]
        emb = self.emb(window.unsqueeze(-1)).reshape(1, 96)
        seq = torch.cat([embs, emb.unsqueeze(1)], dim=1)
        score = torch.sigmoid(self.det(seq))
        return frames, emb, score


def main() -> None:
    det = Detector()
    det.load_state_dict(torch.load(WAKE / "model" / "detector.pt", map_location="cpu"))
    step = Step(det).eval()
    ex = (
        torch.zeros(1, CHUNK + CONTEXT),
        torch.zeros(1, MEL_WINDOW - 8, 32),
        torch.zeros(1, FRAMES - 1, 96),
    )
    traced = torch.jit.trace(step, ex)
    ml = ct.convert(
        traced,
        inputs=[
            ct.TensorType("audio", shape=ex[0].shape),
            ct.TensorType("mels", shape=ex[1].shape),
            ct.TensorType("embs", shape=ex[2].shape),
        ],
        outputs=[ct.TensorType("frames"), ct.TensorType("emb"), ct.TensorType("score")],
        minimum_deployment_target=ct.target.macOS14,
        compute_precision=ct.precision.FLOAT32,
        compute_units=ct.ComputeUnit.CPU_AND_NE,
    )
    ml.short_description = 'Tandrix wake word: the chance "Tandrix" has just been said, each 80 ms.'
    ml.save(str(OUT))
    print(f"saved {OUT}")
    check(ml, step)


def check(ml, step: Step) -> None:
    """The converted model, run live over a test stream, against the trained one."""
    f = Featurizer()
    audio = load(WAKE / "quiet.wav")[: 16000 * 60]
    audio = audio[: len(audio) // CHUNK * CHUNK]
    want = []
    emb = f.stream(audio)
    with torch.no_grad():
        want = torch.sigmoid(step.det(torch.from_numpy(windows(emb)))).numpy()
    mels = np.zeros((1, MEL_WINDOW - 8, 32), np.float32)
    embs = np.zeros((1, FRAMES - 1, 96), np.float32)
    padded = np.concatenate([np.zeros(CONTEXT, np.float32), audio])
    got = []
    for k in range(len(audio) // CHUNK):
        piece = padded[k * CHUNK : k * CHUNK + CHUNK + CONTEXT][None]
        out = ml.predict({"audio": piece, "mels": mels, "embs": embs})
        mels = np.concatenate([mels, out["frames"]], 1)[:, -(MEL_WINDOW - 8) :]
        embs_next = np.concatenate([embs, out["emb"][:, None]], 1)
        # Live, the first windows are padded with silence; compare once the history is real.
        if k >= MEL_WINDOW // 8 + FRAMES:
            got.append(float(out["score"].reshape(-1)[0]))
        embs = embs_next[:, -(FRAMES - 1) :]
    # Live window k covers embeddings ending at piece k; the trained stream starts at piece 9.
    first = MEL_WINDOW // 8 + FRAMES - (FRAMES + 8)
    ref = want[first : first + len(got)]
    diff = np.abs(np.array(got) - ref)
    print(f"live vs trained: {len(got)} windows, max diff {diff.max():.4f}, mean {diff.mean():.5f}; wakes (score > 0.9): live {int((np.array(got) > 0.9).sum())}, trained {int((ref > 0.9).sum())}")


if __name__ == "__main__":
    main()
