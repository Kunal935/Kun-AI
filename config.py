import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODELS_DIR = os.path.join(BASE_DIR, "models")
PERSONA_FILE = os.path.join(BASE_DIR, "persona_profile.json")

WHISPER_MODEL_SIZE = "base"

LLM_PROVIDER = "gemini"

gem_api_key = os.getenv("GEMINI_API_KEY", "")

openai_api_key = os.getenv("OPENAI_API_KEY", "")


DEFAULT_SAMPLING_RATE = 44100
DEFAULT_VOICE = "goku"

# 🔹 Neural TTS placeholder is not implemented yet
# For now, set VOICE_MODELS to empty strings to force pyttsx3 fallback
VOICE_MODELS = {
    "goku": "",   # os.path.join(MODELS_DIR, "goku.pth") → disabled
    "levi": "",   # os.path.join(MODELS_DIR, "levi.pth") → disabled
    "gojo": ""    # os.path.join(MODELS_DIR, "gojo.pth") → disabled
}

PORT = 8000
DEBUG = True