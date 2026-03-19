"""
TTS engine helpers (Optimized)

Strategy:
1) XTTS v2 voice cloning (Coqui TTS)
2) Memory audio generation (no temp files)
3) Voice caching for instant replay
4) pyttsx3 fallback

Returns:
    audio_bytes, sample_rate
"""

import os
import io
from typing import Tuple
import soundfile as sf

from config import DEFAULT_SAMPLING_RATE

# -------------------------
# XTTS import
# -------------------------
try:
    from TTS.api import TTS
    import torch
    XTTS_AVAILABLE = True
except Exception:
    XTTS_AVAILABLE = False


# -------------------------
# pyttsx3 fallback
# -------------------------
try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except Exception:
    PYTTSX3_AVAILABLE = False


# -------------------------
# Voice cache
# -------------------------
TTS_CACHE = {}


# -------------------------
# Load XTTS model once
# -------------------------
XTTS_MODEL = None

if XTTS_AVAILABLE:

    try:

        use_gpu = torch.cuda.is_available()

        XTTS_MODEL = TTS(
            "tts_models/multilingual/multi-dataset/xtts_v2",
            gpu=use_gpu
        )

        print(f"[TTS] XTTS loaded | GPU={use_gpu}")

    except Exception as e:

        print("[TTS] XTTS load failed:", e)
        XTTS_MODEL = None


# -------------------------
# XTTS synthesis (FAST)
# -------------------------
def _xtts_synthesize(text: str, speaker_wav: str, language: str) -> Tuple[bytes, int]:

    if XTTS_MODEL is None:
        raise RuntimeError("XTTS model not available")

    if not os.path.exists(speaker_wav):
        raise FileNotFoundError(f"Speaker reference not found: {speaker_wav}")

    # Generate waveform directly (no disk write)
    wav = XTTS_MODEL.tts(
        text=text,
        speaker_wav=speaker_wav,
        language=language
    )

    buffer = io.BytesIO()

    sf.write(
        buffer,
        wav,
        24000,
        format="WAV"
    )

    buffer.seek(0)

    return buffer.read(), 24000


# -------------------------
# pyttsx3 fallback
# -------------------------
def _pyttsx3_synthesize(text: str) -> Tuple[bytes, int]:

    if not PYTTSX3_AVAILABLE:
        raise RuntimeError("pyttsx3 not installed")

    engine = pyttsx3.init()

    tmp_file = "temp_tts.wav"

    engine.save_to_file(text, tmp_file)
    engine.runAndWait()

    with open(tmp_file, "rb") as f:
        audio_bytes = f.read()

    try:
        os.remove(tmp_file)
    except Exception:
        pass

    return audio_bytes, DEFAULT_SAMPLING_RATE


# -------------------------
# MAIN TTS ENTRYPOINT
# -------------------------
def synthesize_text(text: str, persona_name: str, language: str) -> Tuple[bytes, int]:

    speaker_map = {
        "goku": "voicesamples/goku_ref.wav",
        "gojo": "voicesamples/gojo_ref.wav",
        "levi": "voicesamples/levi_ref.wav"
    }

    persona_name = persona_name.lower()

    speaker_wav = speaker_map.get(
        persona_name,
        speaker_map["goku"]
    )

    # cache key
    cache_key = persona_name + "_" + language + "_" + text

    # ⚡ return cached voice instantly
    if cache_key in TTS_CACHE:
        return TTS_CACHE[cache_key]

    # 1️⃣ Try XTTS
    if XTTS_MODEL is not None:

        try:

            result = _xtts_synthesize(
                text,
                speaker_wav,
                language
            )

            TTS_CACHE[cache_key] = result

            return result

        except Exception as e:

            print("[tts_engine] XTTS error -> fallback:", e)

    # 2️⃣ fallback
    result = _pyttsx3_synthesize(text)

    TTS_CACHE[cache_key] = result

    return result