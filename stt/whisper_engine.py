from pydub import AudioSegment, effects
import whisper
import tempfile
import os
import io
from utils.logger import get_logger
from config import WHISPER_MODEL_SIZE

logger = get_logger("stt")

logger.info("Loading Whisper model once at app start...")
model = whisper.load_model(WHISPER_MODEL_SIZE)

def transcribe_byte(audio_bytes: bytes) -> str:
    """
    Convert raw audio bytes to text using Whisper.
    Pre-processes audio: 16kHz, Mono, Normalized.
    """
    tmp_file_path = None
    try:
        # Load into Pydub
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        
        # 2. Normalize: 16kHz, Mono
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        # 3. Apply volume normalization
        audio = effects.normalize(audio)
        
        # 4. Save to temp file for Whisper
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            audio.export(tmp_file.name, format="wav")
            tmp_file_path = tmp_file.name

        logger.info(f"Transcribing normalized audio: {tmp_file_path}")
        result = model.transcribe(tmp_file_path)
        text = result.get("text", "").strip()
        logger.info(f"Transcription successful: {text}")
        return text
    except Exception as e:
        logger.error(f"STT Error: {e}")
        return f"STT Error: {e}"
    finally:
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.remove(tmp_file_path)
            except:
                pass