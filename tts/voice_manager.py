import json
import os
import re
from typing import Tuple
import asyncio
import io
import soundfile as sf
import numpy as np

from config import PERSONA_FILE
from tts.tts_engine import synthesize_text
from utils.logger import get_logger

import edge_tts

logger = get_logger("tts")


# -----------------------------
# Load personas
# -----------------------------
try:
    with open(PERSONA_FILE, "r", encoding="utf-8") as f:
        PERSONAS = json.load(f)
except Exception:
    PERSONAS = {}


# -----------------------------
# Edge TTS fallback voices
# -----------------------------
EDGE_TTS_VOICES = {

    "goku": {
        "english": "en-US-BrianNeural",
        "hinglish": "hi-IN-MadhurNeural"
    },

    "gojo": {
        "english": "en-US-AndrewNeural",
        "hinglish": "hi-IN-MadhurNeural"
    },

    "levi": {
        "english": "en-US-ChristopherNeural",
        "hinglish": "hi-IN-MadhurNeural"
    }

}


# -----------------------------
# TEXT CLEANER
# -----------------------------
def clean_tts_text(text: str) -> str:

    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    # Don't strip punctuation completely if we want natural pauses, 
    # but the user wants "one continuous response". 
    # Usually TTS handles . , well for phrasing.
    text = re.sub(r"[;:()\"'`]", "", text)

    filler_words = {
        "uh", "umm", "hmm", "haha",
        "lol", "ah", "eh"
    }

    words = text.split()
    words = [w for w in words if w.lower() not in filler_words]

    text = " ".join(words)
    text = re.sub(r"\s+", " ", text).strip()

    return text


# -----------------------------
# Language Detection
# -----------------------------
def detect_language(text: str) -> str:
    # Check for Devanagari script first
    hindi_chars = re.compile(r'[\u0900-\u097F]')
    if hindi_chars.search(text):
        return "hinglish"

    # Common Hinglish/Hindi words in Roman script
    hindi_words = {
        "kya", "hai", "kaise", "tu", "tum", "aap", "nahi", "mein", "me", "ho", "aur", "bhai",
        "thik", "theek", "shukriya", "dhanyawad", "namaste", "namaskar", "achha", "baat", 
        "kar", "raha", "rahi", "samajh", "pyaar", "ishq", "yaar", "chal", "karo", "hu", "hoon"
    }

    text_lower = text.lower()
    words = re.findall(r'\b\w+\b', text_lower)
    
    hindi_count = sum(1 for word in words if word in hindi_words)
    
    # If more than 10% words are Hindi or if at least one common Hindi word is found in short text
    if hindi_count > 0 and (hindi_count / len(words) > 0.1 or len(words) < 5):
        return "hinglish"

    return "english"


# -----------------------------
# FAST EDGE TTS (MP3 DIRECT)
# -----------------------------
async def edge_tts_generate(text: str, persona_name: str):

    persona_key = persona_name.lower()

    language = detect_language(text)
    
    # Transliterate Hinglish to Devanagari for better speech synthesis if voice is Hindi
    voice_config = EDGE_TTS_VOICES.get(persona_key, {})
    voice = voice_config.get(language, "en-US-GuyNeural")
    
    tts_text = text
    if language == "hinglish" and "hi-IN" in voice:
        try:
            from llm_brain.inference import generate_reply
            prompt = (
                f"You are a translation engine. Convert the following Roman Hindi text into strictly Devanagari Hindi for TTS. "
                f"Return ONLY the Devanagari text. DO NOT include English, guides, or explanations.\n\nText: {text}"
            )
            devanagari_text = generate_reply({"name": "Transliterater"}, prompt)
            if devanagari_text and "LLM Error" not in devanagari_text:
                cleaned_text = re.sub(r'\*\*.*?\*\*', '', devanagari_text)
                cleaned_text = re.sub(r'#.*?\n', '', cleaned_text)
                cleaned_text = re.sub(r'\[.*?\]', '', cleaned_text)
                tts_text = cleaned_text.strip()
                logger.info(f"Cleaned for TTS: {tts_text}")
        except Exception as e:
            logger.warning(f"TTS Transliteration failed: {e}")

    logger.info(f"Edge voice: {voice}")

    communicate = edge_tts.Communicate(text=tts_text, voice=voice)

    buffer = io.BytesIO()

    async for chunk in communicate.stream():

        if chunk["type"] == "audio":
            buffer.write(chunk["data"])

    audio_bytes = buffer.getvalue()

    if not audio_bytes:
        raise RuntimeError("Edge TTS empty audio")

    # return MP3
    return audio_bytes, "mp3"


# -----------------------------
# Main TTS
# -----------------------------
def synthesize_reply_audio(reply_text: str, persona, language: str = None) -> Tuple[bytes, str]:
    if isinstance(persona, dict):
        persona_key = persona.get("name", "").lower()
    else:
        persona_key = (persona or "").lower()

    if not language:
        language = detect_language(reply_text)
    
    final_text = clean_tts_text(reply_text.strip())
    
    # Map our internal lang names to XTTS codes
    xtts_lang = "hi" if language == "hinglish" else "en"
    
    # Split text into chunks if it exceeds safety limits (approx 300 chars)
    # This prevents robotic voice or synthesis failure while maintaining "at once" feel
    LIMIT = 300
    if len(final_text) <= LIMIT + 50: # small buffer
        chunks = [final_text]
    else:
        # Split by sentences if possible
        chunks = re.split(r'(?<=[.!?])\s+', final_text)
        # Re-merge small chunks
        merged_chunks = []
        current = ""
        for c in chunks:
            if len(current) + len(c) < LIMIT:
                current += " " + c
            else:
                if current: merged_chunks.append(current.strip())
                current = c
        if current: merged_chunks.append(current.strip())
        chunks = merged_chunks

    logger.info(f"TTS chunks: {len(chunks)} | Lang: {language}")

    all_wavs = []
    
    for chunk in chunks:
        if not chunk.strip(): continue
        try:
            # 1️⃣ Try XTTS
            audio_bytes, sr = synthesize_text(chunk, persona_key, xtts_lang)
            # Read back as numpy array for concatenation
            with io.BytesIO(audio_bytes) as b:
                data, samplerate = sf.read(b)
                all_wavs.append(data)
        except Exception as e:
            logger.warning(f"XTTS failed for chunk: {e}")
            # 2️⃣ Edge TTS fallback
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                edge_bytes, fmt = loop.run_until_complete(edge_tts_generate(chunk, persona_key))
                loop.close()
                with io.BytesIO(edge_bytes) as b:
                    data, samplerate = sf.read(b)
                    all_wavs.append(data)
            except Exception as ex:
                logger.error(f"Edge TTS failed for chunk: {ex}")

    if not all_wavs:
        # Final fallback
        audio_bytes, sr = synthesize_text("System failure.", "goku", "en")
        return audio_bytes, "wav"

    # Concatenate all numpy arrays
    final_wav = np.concatenate(all_wavs)
    
    # Write back to WAV bytes
    out_buf = io.BytesIO()
    sf.write(out_buf, final_wav, 24000, format='WAV')
    return out_buf.getvalue(), "wav"


async def stream_xtts(text, persona, language=None):
    """
    Synthesize the entire text as a single audio block for natural playback.
    No sentence splitting to avoid robotic pauses.
    """
    if not language:
        language = detect_language(text)
    
    # Map language codes correctly
    # language could be "en", "hi", "english", "hinglish"
    if language in ("hi", "hinglish"):
        xtts_lang = "hi"
    else:
        xtts_lang = "en"

    # Normalize to avoid synthesis issues
    clean_text = clean_tts_text(text).strip()
    
    if not clean_text:
        return

    # User requested to speak the entire response at once
    logger.info(f"Generating single audio chunk for text ({len(clean_text)} chars)")

    try:
        # Generate the whole block
        audio_bytes, sr = synthesize_text(clean_text, persona, xtts_lang)
        yield audio_bytes
    except Exception as e:
        logger.error(f"Full text XTTS failed: {e}")