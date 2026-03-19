import wave
import io
import numpy as np

def save_bytes_to_wav(audio_bytes: bytes, output_path: str, sample_rate: int = 22050):
    """
    Save raw audio bytes to a WAV file.
    """
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(1)           # Mono
        wf.setsampwidth(2)           # 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(audio_bytes)

def bytes_to_np(audio_bytes: bytes) -> np.ndarray:
    """
    Convert audio bytes to numpy array (int16).
    """
    return np.frombuffer(audio_bytes, dtype=np.int16)

def np_to_bytes(audio_array: np.ndarray) -> bytes:
    """
    Convert numpy array (int16) to audio bytes.
    """
    return audio_array.tobytes()
