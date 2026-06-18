#!/usr/bin/env python3
"""Persistent Piper TTS server — reads text from stdin, writes WAV to stdout.
Usage: python tts_server.py [model_name] [speed] [pitch]
  model_name: jarvis (default), ryan, bryce, lessac, northern
  speed: length_scale, >1=slower, <1=faster. Default 1.2.
  pitch: semitones, negative=deeper. Default -3.
Reads lines from stdin. Each line: <base64_encoded_text>
Writes: <base64_encoded_wav_data> followed by newline

Models (downloaded automatically on first use):
  jarvis     en_GB-jarvis-high     (108MB, British male, JARVIS-trained) — default
  ryan       en_US-ryan-medium     (60MB, US male, medium quality)
  bryce      en_US-bryce-medium    (60MB, US male, medium quality)
  lessac     en_US-lessac-high     (120MB, US male, high quality)
  northern   en_GB-northern_english_male-medium (60MB, British male)
"""
import sys
import base64
import os
import json

MODEL_DIR = os.path.join(os.path.expanduser("~"), ".piper", "models")
HF_REPO = "rhasspy/piper-voices"

VOICE_MODELS = {
    "jarvis": {
        "path": "en/en_GB/jarvis/high/jarvis-high.onnx",
        "config": "en/en_GB/jarvis/high/jarvis-high.onnx.json",
        "repo": "jgkawell/jarvis",
        "name": "JARVIS (British male, high)",
    },
    "ryan": {
        "path": "en/en_US/ryan/medium/en_US-ryan-medium.onnx",
        "config": "en/en_US/ryan/medium/en_US-ryan-medium.onnx.json",
        "repo": "rhasspy/piper-voices",
        "name": "Ryan (US male, medium)",
    },
    "bryce": {
        "path": "en/en_US/bryce/medium/en_US-bryce-medium.onnx",
        "config": "en/en_US/bryce/medium/en_US-bryce-medium.onnx.json",
        "repo": "rhasspy/piper-voices",
        "name": "Bryce (US male, medium)",
    },
    "lessac": {
        "path": "en/en_US/lessac/high/en_US-lessac-high.onnx",
        "config": "en/en_US/lessac/high/en_US-lessac-high.onnx.json",
        "repo": "rhasspy/piper-voices",
        "name": "Lessac (US male, high)",
    },
    "northern": {
        "path": "en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx",
        "config": "en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx.json",
        "repo": "rhasspy/piper-voices",
        "name": "Northern English Male (British, medium)",
    },
}


def ensure_model(model_key):
    """Download model from HuggingFace if not cached locally."""
    from huggingface_hub import hf_hub_download

    info = VOICE_MODELS[model_key]
    local_model = os.path.join(MODEL_DIR, info["path"])
    local_config = os.path.join(MODEL_DIR, info["config"])
    repo = info.get("repo", HF_REPO)

    if not os.path.exists(local_model):
        os.makedirs(os.path.dirname(local_model), exist_ok=True)
        sys.stderr.write(f"Downloading {model_key} model from {repo}...\n")
        sys.stderr.flush()
        hf_hub_download(
            repo_id=repo,
            filename=info["path"],
            repo_type="model",
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False,
        )
        hf_hub_download(
            repo_id=repo,
            filename=info["config"],
            repo_type="model",
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False,
        )
        sys.stderr.write(f"Downloaded {model_key} model.\n")
        sys.stderr.flush()

    return local_model, local_config


def main():
    model_key = sys.argv[1] if len(sys.argv) > 1 else "jarvis"
    # Speed: length_scale > 1 = slower, < 1 = faster. Default 1.2.
    speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.2
    # Pitch: semitones to shift. Negative = deeper. Default -3 for JARVIS.
    pitch = float(sys.argv[3]) if len(sys.argv) > 3 else -3.0

    if model_key not in VOICE_MODELS:
        sys.stderr.write(
            f"Unknown model '{model_key}'. Available: {', '.join(VOICE_MODELS.keys())}\n"
        )
        sys.stderr.flush()
        sys.exit(1)

    # Lazy import so download messages don't delay startup
    from piper.voice import PiperVoice, SynthesisConfig
    import numpy as np

    local_model, local_config = ensure_model(model_key)
    voice = PiperVoice.load(local_model, config_path=local_config)
    ttsConfig = SynthesisConfig(length_scale=speed)

    # Signal ready
    sys.stderr.write(f"READY model={model_key} speed={speed} pitch={pitch} sample_rate={voice.config.sample_rate}\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            text = base64.b64decode(line).decode("utf-8")
        except Exception:
            text = line
        if not text:
            sys.stderr.write("ERROR: empty text\n")
            sys.stderr.flush()
            continue
        try:
            chunks = []
            for chunk in voice.synthesize(text, ttsConfig):
                chunks.append(chunk.audio_int16_array)
            if not chunks:
                sys.stderr.write("ERROR: no audio data\n")
                sys.stderr.flush()
                continue
            audio_data = np.concatenate(chunks)
            # Pitch shift: resample down then back to original length
            if pitch != 0.0:
                from scipy.signal import resample
                factor = 2 ** (pitch / 12.0)  # semitones to ratio
                n_shifted = int(len(audio_data) / factor)
                shifted = resample(audio_data.astype(np.float32), n_shifted)
                audio_data = resample(shifted, len(audio_data)).astype(np.int16)
            # Encode as WAV (PCM 16-bit, mono, 22050Hz)
            import io, wave
            buf = io.BytesIO()
            with wave.open(buf, 'wb') as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(voice.config.sample_rate)
                w.writeframes(audio_data.tobytes())
            sys.stdout.buffer.write(base64.b64encode(buf.getvalue()))
            sys.stdout.buffer.write(b"\n")
            sys.stdout.buffer.flush()
        except Exception as e:
            sys.stderr.write(f"ERROR: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    main()
