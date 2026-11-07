"""
Trains Tandrix's wake-word detector: fires as "Tandrix" ends, alone or after "Hey", "Okay",
"Wake up"; stays quiet for everything else. On this Mac only; nothing is sent anywhere.

    cd apps/desktop/scripts/wake/model
    .venv/bin/python -I train.py prepare   # features for every clip and recording, cached
    .venv/bin/python -I train.py train     # the detector, scored on the held-out test voices
    .venv/bin/python -I train.py eval      # score a trained detector again

Data (fixtures/wake, git-ignored):
- model/pos, model/near, model/speech: synthetic voices (apps/api/scripts/wake-sets.ts --model-set),
  the eight test voices held out
- librispeech/: 11 hours of people reading aloud (real voices, real microphones)
- oww-train/acav100m_part.npy: openWakeWord's precomputed features of real-world audio (speech,
  music, noise, many languages), the first ~175 hours
- oww-eval/validation_set_features.npy: 11 hours of dinner parties, conversation and music, only
  for counting false wakes
- quiet.wav, talk.wav, negatives.wav: the test streams the current listener is scored on
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from scipy.signal import fftconvolve, resample_poly
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from features import CHUNK, FRAMES, RATE, WAKE, WINDOW_SAMPLES, Featurizer, load, windows  # noqa: E402
from net import Detector  # noqa: E402

CACHE = WAKE / "model" / "features"
OUT = WAKE / "model" / "detector.pt"
rng = np.random.default_rng(20261107)

# Scoring, as scripts/wake/score.ts: a wake within the phrase or 2.5 s after it is that phrase's.
LATE = 2.5
REFRACTORY = 2.0
# How much more a false wake costs than a miss, by the end of training (openWakeWord goes far higher).
NEG_WEIGHT = float(next((a.split("=")[1] for a in sys.argv if a.startswith("--neg=")), 100))


# ---------------------------------------------------------------------------------------------
# Audio: where the name ends, rooms, noise, level.


def trim_end(x: np.ndarray) -> np.ndarray:
    """Cut the silence after the last word (TTS leaves some)."""
    frame = 160
    n = len(x) // frame
    if n == 0:
        return x
    e = np.sqrt((x[: n * frame].reshape(n, frame) ** 2).mean(1))
    loud = np.where(e > max(e.max() * 0.03, 30))[0]
    return x[: (loud[-1] + 1) * frame] if len(loud) else x


def fit_end(x: np.ndarray, end: int, length: int = WINDOW_SAMPLES) -> np.ndarray:
    """Place a clip so it ends at `end` within a window (cut at the front when it's longer)."""
    out = np.zeros(length, np.float32)
    start = end - len(x)
    if start < 0:
        x = x[-start:]
        start = 0
    out[start : start + len(x)] = x[: max(0, min(len(x), length - start))]
    return out


def room(x: np.ndarray) -> np.ndarray:
    """A synthetic room: decaying noise as the impulse response (RT60 0.15–0.9 s)."""
    rt60 = rng.uniform(0.15, 0.9)
    n = int(rt60 * RATE)
    t = np.arange(n) / RATE
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt60)
    ir[0] = 1.0 / rng.uniform(0.3, 1.0)
    y = fftconvolve(x, ir)[: len(x)]
    return (y * (np.abs(x).max() / (np.abs(y).max() + 1e-6))).astype(np.float32)


def coloured(n: int) -> np.ndarray:
    """White, pink or brown noise, or a mains hum."""
    kind = rng.integers(4)
    if kind == 3:
        t = np.arange(n) / RATE
        f = rng.choice([50, 60])
        return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)).astype(np.float32) * 3000
    w = rng.standard_normal(n)
    if kind == 0:
        return (w * 3000).astype(np.float32)
    spec = np.fft.rfft(w)
    freqs = np.maximum(np.fft.rfftfreq(n), 1 / n)
    spec /= freqs ** (0.5 if kind == 1 else 1.0)
    y = np.fft.irfft(spec, n)
    return (y / (np.abs(y).max() + 1e-6) * 8000).astype(np.float32)


def rms(x: np.ndarray) -> float:
    return float(np.sqrt((x**2).mean()) + 1e-6)


class Backgrounds:
    """What's around the user: people talking, a podcast, noise."""

    def __init__(self, speech: np.ndarray) -> None:
        self.speech = speech

    def take(self, n: int) -> np.ndarray:
        r = rng.random()
        if r < 0.45:
            at = rng.integers(0, len(self.speech) - n)
            return self.speech[at : at + n].copy()
        if r < 0.7:
            # Babble: several people at once.
            out = np.zeros(n, np.float32)
            for _ in range(rng.integers(2, 5)):
                at = rng.integers(0, len(self.speech) - n)
                out += self.speech[at : at + n]
            return out
        return coloured(n)


def augment(x: np.ndarray, bg: Backgrounds, clean: float = 0.15) -> np.ndarray:
    """One variant: maybe sped up or slowed, maybe in a room, maybe over noise, at a level."""
    n = len(x)
    if rng.random() < 0.3:
        up, down = rng.choice([(10, 9), (9, 10), (20, 19), (19, 20), (11, 10), (10, 11)])
        x = resample_poly(x, up, down).astype(np.float32)
        # Same length, the end where it was: trimmed or padded at the front.
        x = x[-n:] if len(x) >= n else np.concatenate([np.zeros(n - len(x), np.float32), x])
    if rng.random() >= clean:
        if rng.random() < 0.5:
            x = room(x)
        if rng.random() < 0.8:
            noise = bg.take(len(x))
            snr = rng.uniform(-2, 25)
            x = x + noise * (rms(x) / rms(noise)) * 10 ** (-snr / 20)
    # From a whisper-quiet microphone to a loud one.
    peak = np.abs(x).max() + 1e-6
    x = x / peak * 32767 * 10 ** (rng.uniform(-30, -1) / 20)
    return np.clip(x, -32768, 32767).astype(np.float32)


def augment_at_end(x: np.ndarray, bg: Backgrounds, end: int) -> np.ndarray:
    """A clip placed to end at `end`, with its surroundings: augment the whole window."""
    w = fit_end(x, end)
    # Speech before the wake word (mid-sentence) half the time.
    if rng.random() < 0.5:
        start = min(max(0, end - len(x)), len(w))
        lead = bg.take(start) if start > 0 else np.zeros(0, np.float32)
        w[:start] += lead * (rms(x) / rms(lead) if start else 0) * 10 ** (-rng.uniform(0, 15) / 20)
    return augment(w, bg)


# ---------------------------------------------------------------------------------------------
# Features, cached.


def wavs(d: Path) -> list[Path]:
    return sorted(d.glob("*.wav"))


def librispeech(limit_s: float | None = None) -> np.ndarray:
    files = sorted((WAKE / "librispeech").rglob("*.flac"))
    rng.shuffle(files)
    out, total = [], 0
    for f in files:
        x, sr = sf.read(str(f), dtype="int16")
        out.append(x.astype(np.float32))
        total += len(x)
        if limit_s and total > limit_s * RATE:
            break
    return np.concatenate(out)


def prepare_recordings(f: Featurizer, libri: np.ndarray) -> None:
    """Features of the recordings: real people reading, and the test streams."""
    if not (CACHE / "libri.npy").exists():
        # Every 160 ms.
        emb = f.stream(libri[: len(libri) // CHUNK * CHUNK])
        np.save(CACHE / "libri.npy", windows(emb, 2).astype(np.float16))
    for name in ("quiet", "talk", "negatives"):
        if (CACHE / f"stream-{name}.npy").exists():
            continue
        a = load(WAKE / f"{name}.wav")
        np.save(CACHE / f"stream-{name}.npy", f.stream(a[: len(a) // CHUNK * CHUNK]).astype(np.float32))


def prepare(only_recordings: bool = False) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    f = Featurizer()
    t = time.time()
    libri = librispeech()
    print(f"LibriSpeech: {len(libri) / RATE / 3600:.1f} h")
    prepare_recordings(f, libri)
    if only_recordings:
        print(f"prepared in {time.time() - t:.0f} s")
        return
    model = WAKE / "model"
    pos = [trim_end(load(p)) for p in wavs(model / "pos")]
    near = [trim_end(load(p)) for p in wavs(model / "near")]
    talk = [load(p) for p in wavs(model / "speech")]
    print(f"clips: {len(pos)} wake, {len(near)} near misses, {len(talk)} sentences")
    # Half the people reading are heard in the room for backgrounds; all of it is also negatives.
    bg = Backgrounds(libri[: len(libri) // 2])

    def batch(make, n: int, name: str) -> None:
        clips = np.stack([make(i) for i in tqdm(range(n), desc=name)])
        np.save(CACHE / f"{name}.npy", f.clips(clips).astype(np.float16))

    # Wake: the window ends 0–240 ms after the name does, so it fires as the name ends.
    per = 14
    batch(
        lambda i: augment_at_end(pos[i % len(pos)], bg, WINDOW_SAMPLES - int(rng.uniform(0, 0.24) * RATE)),
        len(pos) * per,
        "pos",
    )
    # Not yet: the window ends 0.3–0.7 s before the name does ("Hey Tan…").
    batch(
        lambda i: augment_at_end(pos[i % len(pos)], bg, WINDOW_SAMPLES + int(rng.uniform(0.3, 0.7) * RATE)),
        len(pos) * 3,
        "early",
    )
    # Near misses, ending anywhere in the last half second, and anywhere at all.
    batch(
        lambda i: augment_at_end(
            near[i % len(near)], bg, WINDOW_SAMPLES - int(rng.uniform(0, 0.5 if i % 2 else 1.2) * RATE)
        ),
        len(near) * 6,
        "near",
    )
    # Ordinary sentences from the same voices, augmented as the wake clips are.
    if not talk:
        np.save(CACHE / "speech.npy", np.zeros((0, FRAMES, 96), np.float16))
        print(f"prepared in {time.time() - t:.0f} s (no sentences yet)")
        return
    sentences = np.concatenate([np.concatenate([c, np.zeros(int(0.3 * RATE), np.float32)]) for c in talk])
    batch(
        lambda i: augment(
            sentences[(at := rng.integers(0, len(sentences) - WINDOW_SAMPLES)) : at + WINDOW_SAMPLES].copy(),
            bg,
        ),
        30_000,
        "speech",
    )
    print(f"prepared in {time.time() - t:.0f} s")


def acav() -> np.ndarray:
    """openWakeWord's real-world features, as much of the file as is here (a partial download)."""
    path = WAKE / "oww-train" / "acav100m_part.npy"
    with open(path, "rb") as fh:
        version = np.lib.format.read_magic(fh)
        shape, order, dtype = np.lib.format._read_array_header(fh, version)  # noqa: SLF001
        offset = fh.tell()
    row = FRAMES * 96 * dtype.itemsize
    rows = (path.stat().st_size - offset) // row
    return np.memmap(path, dtype=dtype, mode="r", offset=offset, shape=(rows, FRAMES, 96))


# ---------------------------------------------------------------------------------------------
# Training.


def device() -> torch.device:
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def scores(model: Detector, x: np.ndarray, dev: torch.device) -> np.ndarray:
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(x), 8192):
            b = torch.from_numpy(np.asarray(x[i : i + 8192], np.float32)).to(dev)
            out.append(torch.sigmoid(model(b)).cpu().numpy())
    return np.concatenate(out) if out else np.zeros(0)


def stream_scores(model: Detector, emb: np.ndarray, dev: torch.device) -> np.ndarray:
    """A score for every window along a stream of embeddings, a piece at a time."""
    out = []
    step = 50_000
    for at in range(0, max(0, len(emb) - FRAMES + 1), step):
        out.append(scores(model, windows(np.asarray(emb[at : at + step + FRAMES - 1], np.float32)), dev))
    return np.concatenate(out) if out else np.zeros(0)


def wakes_at(s: np.ndarray, threshold: float, in_a_row: int = 1) -> list[float]:
    """Times of wakes along a stream: window k ends at (k + 25) × 80 ms."""
    out: list[float] = []
    run = 0
    for k, v in enumerate(s):
        run = run + 1 if v >= threshold else 0
        at = (k + FRAMES + 9) * CHUNK / RATE
        if run >= in_a_row and (not out or out[-1] < at - REFRACTORY):
            out.append(at)
    return out


def score_stream(wakes: list[float], labels: list[dict]) -> dict:
    caught: set[int] = set()
    delays: list[float] = []
    falses = 0
    for w in wakes:
        i = next(
            (k for k, l in enumerate(labels) if k not in caught and l["start"] <= w <= l["end"] + LATE),
            -1,
        )
        if i < 0 and any(k in caught and l["start"] <= w <= l["end"] + LATE + 2 for k, l in enumerate(labels)):
            continue
        if i < 0:
            falses += 1
        else:
            caught.add(i)
            delays.append(w - labels[i]["end"])
    delays.sort()
    return {"caught": len(caught), "of": len(labels), "falses": falses, "delay": delays[len(delays) // 2] if delays else None}


def evaluate(model: Detector, dev: torch.device, write_runs: bool = False) -> list[dict]:
    streams = {n: np.load(CACHE / f"stream-{n}.npy") for n in ("quiet", "talk", "negatives")}
    labels = {n: json.loads((WAKE / f"{n}.json").read_text()) for n in ("quiet", "talk")}
    s = {n: stream_scores(model, e, dev) for n, e in streams.items()}
    # 10.7 hours of dinner parties, conversation and music: one embedding every 80 ms.
    val = np.load(WAKE / "oww-eval" / "validation_set_features.npy", mmap_mode="r")
    sv = stream_scores(model, val, dev)
    val_hours = len(val) * 0.08 / 3600
    neg_hours = len(streams["negatives"]) * 0.08 / 3600
    rows = []
    for th, row in [(t, r) for t in (0.5, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.998, 0.999) for r in (1, 2, 3)]:
        q = score_stream(wakes_at(s["quiet"], th, row), labels["quiet"])
        t = score_stream(wakes_at(s["talk"], th, row), labels["talk"])
        neg = len(wakes_at(s["negatives"], th, row))
        vf = len(wakes_at(sv, th, row))
        rows.append(
            {
                "threshold": th,
                "in_a_row": row,
                "quiet": f"{q['caught']}/{q['of']}",
                "talk": f"{t['caught']}/{t['of']}",
                "false_quiet_talk": q["falses"] + t["falses"],
                "false_per_hour_speech": round(neg / neg_hours, 2),
                "false_per_hour_real": round(vf / val_hours, 2),
                "delay": q["delay"],
            }
        )
    if write_runs:
        runs = WAKE / "runs"
        for n in ("quiet", "talk", "negatives"):
            lines = [{"score": round(float(v), 4), "at": round((k + FRAMES + 9) * CHUNK / RATE, 3)} for k, v in enumerate(s[n])]
            (runs / f"oww-{n}.json").write_text(json.dumps({"lines": lines}))
    return rows


# The false-wake budget a checkpoint must meet: under one an hour in 10.7 hours of real rooms
# (dinner parties, conversation, music), and at most two in 47 minutes of ordinary speech full of
# sound-alikes ("Hey Hendrix", "Sandra and Rick").
BUDGET_REAL = 1.0
BUDGET_SPEECH = 2.6


def mine(model: Detector, dev: torch.device, pools: list[np.ndarray], n: int = 120_000) -> np.ndarray:
    """The negatives the model now gets most wrong: a sample of each pool, kept where it scores high."""
    out = []
    for p in pools:
        idx = np.sort(rng.choice(len(p), min(n, len(p)), replace=False))
        x = np.asarray(p[idx], np.float32)
        s = scores(model, x, dev)
        out.append(x[s > 0.05])
    return np.concatenate(out) if out else np.zeros((0, FRAMES, 96), np.float32)


def train(steps: int = 30_000) -> None:
    dev = device()
    parts = {n: np.load(CACHE / f"{n}.npy", mmap_mode="r") for n in ("pos", "early", "near", "speech", "libri")}
    big = acav()
    print({n: len(v) for n, v in parts.items()}, "acav", len(big))
    pos = torch.from_numpy(np.asarray(parts["pos"], np.float32))
    hard = torch.from_numpy(np.concatenate([parts["early"], parts["near"]]).astype(np.float32))
    easy = [e for e in (parts["speech"], parts["libri"], big) if len(e)]
    mined = torch.zeros((0, FRAMES, 96))

    model = Detector().to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=steps, pct_start=0.1)
    bce = torch.nn.BCEWithLogitsLoss(reduction="none")
    B = 1024
    best, best_state, best_row = -1, None, None
    for step in tqdm(range(steps), desc="training"):
        model.train()
        xp = pos[torch.randint(len(pos), (B // 4,))]
        xh = hard[torch.randint(len(hard), (B // 4,))]
        xm = mined[torch.randint(len(mined), (B // 8,))] if len(mined) else mined
        k = (B - len(xp) - len(xh) - len(xm)) // len(easy)
        xe = [torch.from_numpy(np.asarray(e[np.sort(rng.integers(0, len(e), k))], np.float32)) for e in easy]
        x = torch.cat([xp, xh, xm, *xe]).to(dev)
        y = torch.cat([torch.ones(len(xp)), torch.zeros(len(x) - len(xp))]).to(dev)
        # False wakes cost more as training goes on (openWakeWord's schedule, in short).
        w = torch.ones_like(y)
        w[len(xp) :] = 1 + (NEG_WEIGHT - 1) * min(1.0, step / (steps * 0.5))
        loss = (bce(model(x), y) * w).mean()
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()
        if (step + 1) % 2500 == 0 or step + 1 == steps:
            # What it gets wrong now, from the large pools, is trained on harder from here.
            found = mine(model, dev, [big, parts["libri"], parts["speech"]])
            mined = torch.cat([mined, torch.from_numpy(found)])[-60_000:]
            rows = evaluate(model, dev)
            ok = [r for r in rows if r["false_per_hour_real"] <= BUDGET_REAL and r["false_per_hour_speech"] <= BUDGET_SPEECH]
            print(f"\nstep {step + 1}: loss {loss.item():.4f}, mined {len(found)} (pool {len(mined)})")
            for row in rows:
                print("  ", row)
            for r in ok:
                caught = sum(int(r[k].split("/")[0]) for k in ("quiet", "talk"))
                if caught > best:
                    best, best_row = caught, {**r, "step": step + 1}
                    best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            print("best so far:", best_row)
    if best_state is None:
        print("no checkpoint met the false-wake budget; keeping the last")
        best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    torch.save(best_state, OUT)
    (OUT.parent / "detector.json").write_text(json.dumps(best_row, indent=1))
    print(f"saved {OUT}: {best_row}")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "train"
    if cmd == "prepare":
        prepare(only_recordings="--recordings" in sys.argv)
    elif cmd == "train":
        train(int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 30_000)
    elif cmd == "eval":
        dev = device()
        m = Detector().to(dev)
        m.load_state_dict(torch.load(OUT, map_location=dev))
        for row in evaluate(m, dev, write_runs=True):
            print(row)


if __name__ == "__main__":
    main()
