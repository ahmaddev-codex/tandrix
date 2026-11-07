"""
Which words wake the detector: each wake phrase and each sound-alike said by the held-out test
voices (never trained on), in quiet, with the detector's highest score over it.

    .venv/bin/python -I diag.py [threshold]
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent))
from features import CHUNK, RATE, WAKE, Featurizer, load, windows  # noqa: E402
from net import Detector  # noqa: E402

VOICES = ["Karen", "Moira", "Tessa", "Tara", "Grandpa (English (UK))", "Rocko (English (US))"]
WAKES = ["Tandrix", "Hey Tandrix", "Okay Tandrix", "Wake up Tandrix", "Hey Tandrix, open Mail"]
NEAR = [
    "Hey Hendrix", "Hendrix", "Tandy", "Tantrum", "Sandra", "Hey Sandra", "Kendrick", "Patrick",
    "Cedric", "Hand tricks", "Ten tricks", "Ten drinks", "Tan trucks", "Matrix", "Hey Trixie",
    "Tandem", "Tundra", "Fantastic", "Hey Siri", "Okay Google", "Wake up Tom", "Hey Trent",
    "Hey Tanya", "Sandra and Rick", "Tandoori chicken", "Hand drills", "Hey there", "Andrex",
    "Hey Hendricks", "The tango class", "Ten to six", "Candid", "Dandruff", "Tan tricks",
]


def say(voice: str, text: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "s.wav"
        subprocess.run(
            ["say", "-v", voice, "--file-format=WAVE", "--data-format=LEI16@16000", "-o", str(f), text],
            check=True,
        )
        return load(f)


def main() -> None:
    th = float(sys.argv[1]) if len(sys.argv) > 1 else 0.98
    f = Featurizer()
    m = Detector()
    m.load_state_dict(torch.load(WAKE / "model" / "detector.pt", map_location="cpu"))
    m.eval()

    def peak(x: np.ndarray) -> float:
        pad = np.zeros(RATE, np.float32)
        a = np.concatenate([pad, pad, x, pad])
        a = a[: len(a) // CHUNK * CHUNK]
        w = windows(f.stream(a))
        with torch.no_grad():
            return float(torch.sigmoid(m(torch.from_numpy(w))).max())

    for title, phrases in (("wake", WAKES), ("near", NEAR)):
        print(f"\n{title} (highest score per voice; * = over {th})")
        for p in phrases:
            s = [peak(say(v, p)) for v in VOICES]
            hits = sum(v >= th for v in s)
            marks = " ".join(f"{v:.2f}{'*' if v >= th else ' '}" for v in s)
            print(f"  {p:<24} {hits}/{len(s)}  {marks}")


if __name__ == "__main__":
    main()
