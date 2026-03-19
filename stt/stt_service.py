from stt.whisper_engine import transcribe_byte

def speech_to_text(audio_file: str) -> str:
    try:
        with open(audio_file, "rb") as f:
            audio_bytes = f.read()
        return transcribe_byte(audio_bytes)
    except Exception as e:
        return f"STT Error: {e}"
