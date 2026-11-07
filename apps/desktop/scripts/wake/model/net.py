"""
The whole wake-word detector as PyTorch modules, so it trains here and converts to Core ML for the
Mac: openWakeWord's melspectrogram and Google's speech embedding (weights read from their ONNX
files) and Tandrix's own small classifier on top.

The melspectrogram is rebuilt rather than converted: its ONNX graph floors quiet sounds 80 dB
below the loudest sound in the whole batch, so a batch of pieces gave different numbers from one
piece heard live. Here the floor is per piece, as live.
"""

from __future__ import annotations

import numpy as np
import onnx
import torch
from onnx import numpy_helper
from onnx2torch import convert
from torch import nn

from features import MODELS


def _constants(model: onnx.ModelProto) -> dict[str, np.ndarray]:
    out = {i.name: numpy_helper.to_array(i) for i in model.graph.initializer}
    for n in model.graph.node:
        if n.op_type == "Constant":
            out[n.output[0]] = numpy_helper.to_array(n.attribute[0].t)
    return out


class MelSpec(nn.Module):
    """(batch, samples) int16-scaled audio → (batch, frames, 32), each piece floored on its own."""

    def __init__(self) -> None:
        super().__init__()
        m = onnx.load(str(MODELS / "melspectrogram.onnx"))
        c = _constants(m)
        nodes = {n.op_type + ":" + n.output[0]: n for n in m.graph.node}

        def const(op: str, out: str, k: int) -> float:
            return float(c[nodes[f"{op}:{out}"].input[k]])

        self.register_buffer("real", torch.tensor(c["0.stft.conv_real.weight"]))
        self.register_buffer("imag", torch.tensor(c["0.stft.conv_imag.weight"]))
        self.register_buffer("melW", torch.tensor(c["1.melW"]))
        self.amin = const("Clip", "onnx::Log_24", 1)
        self.amax = const("Clip", "onnx::Log_24", 2)
        self.mul = const("Mul", "onnx::Div_27", 1)
        self.div = const("Div", "onnx::Sub_29", 1)
        self.ref = const("Sub", "onnx::ReduceMax_31", 1)
        self.top = const("Sub", "onnx::Cast_34", 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.unsqueeze(1)
        re = nn.functional.conv1d(x, self.real, stride=160).transpose(1, 2)
        im = nn.functional.conv1d(x, self.imag, stride=160).transpose(1, 2)
        mel = (re * re + im * im) @ self.melW
        db = torch.log(mel.clamp(self.amin, self.amax)) * self.mul / self.div - self.ref
        floor = db.amax(dim=(1, 2), keepdim=True) - self.top
        return torch.maximum(db, floor) / 10.0 + 2.0


def embedding() -> nn.Module:
    """(n, 76, 32, 1) → (n, 1, 1, 96): Google's speech embedding, converted as is."""
    return convert(onnx.load(str(MODELS / "embedding_model.onnx")))


class Detector(nn.Module):
    """(batch, 16, 96) embeddings → the chance that "Tandrix" has just been said."""

    def __init__(self, width: int = 128) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.1),
            nn.Linear(16 * 96, width),
            nn.LayerNorm(width),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(width, width),
            nn.LayerNorm(width),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(width, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)
