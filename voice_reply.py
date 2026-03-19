# voice_reply.py

import re
from stt.stt_service import speech_to_text
from hinglish_module.hinglish_llm import ChatSession
from tts.voice_manager import synthesize_reply_audio, detect_language


# -----------------------------
# Global chat sessions
# -----------------------------
CHAT_SESSIONS = {}


def get_chat_session(user_id, persona_name, language):

    key = f"{user_id}_{persona_name}"

    if key not in CHAT_SESSIONS:
        CHAT_SESSIONS[key] = ChatSession(
            persona_name=persona_name,
            language=language,
            user_id=user_id
        )
    else:
        # Update session language if it changes mid-conversation
        # Normalize: 'hi'/'hinglish' -> 'hi', 'en'/'english' -> 'en'
        lang_norm = "hi" if language.lower() in ("hi", "hinglish") else "en"
        CHAT_SESSIONS[key].language = lang_norm

    return CHAT_SESSIONS[key]


# -----------------------------
# TEXT CHAT
# -----------------------------
def chat_reply(user_id, user_text, persona_name, language):

    session = get_chat_session(user_id, persona_name, language)

    reply_text = session.send_message(user_text)

    return {
        "user_text": user_text,
        "reply_text": reply_text
    }


# -----------------------------
# TEXT CHAT (STREAMING)
# -----------------------------
def chat_reply_stream(user_id, user_text, persona_name, language):

    session = get_chat_session(user_id, persona_name, language)

    for chunk in session.send_message_stream(user_text):

        yield chunk


# -----------------------------
# VOICE CHAT (voice message)
# -----------------------------
def voice_message_reply(user_id, audio_path, persona_name, language):

    # -----------------------
    # STT
    # -----------------------
    user_text = speech_to_text(audio_path)

    if user_text.startswith("STT Error") or user_text == "Audio file not found!":

        return {"error": user_text}

    print(f"📝 Transcribed Text: {user_text}")

    # -----------------------
    # Chat reply
    # -----------------------
    session = get_chat_session(user_id, persona_name, language)

    reply_text = session.send_message(user_text)

    # Detect output language
    out_lang = detect_language(reply_text)

    # -----------------------
    # TTS
    # -----------------------
    audio_bytes, audio_format = synthesize_reply_audio(
        reply_text,
        persona_name,
        out_lang
    )

    return {
        "user_text": user_text,
        "reply_text": reply_text,
        "audio_bytes": audio_bytes,
        "audio_format": audio_format
    }



def speak_text(text, persona_name, language="en"):
    """
    text: LLM output
    persona_name: character
    language: 'hi' for Hindi (from Hinglish chat mode), 'en' for English
    """
    tts_text = text

    if language == "hi":
        try:
            from llm_brain.inference import generate_reply
            prompt = (
                f"You are a translation engine. Convert the following text into strictly Devanagari Hindi for TTS. "
                f"IMPORTANT: Return ONLY the Devanagari Hindi text. DO NOT include English, transliterations, guides, or explanations.\n\nText: {text}"
            )
            hindi_text = generate_reply({"name": "Transliterater"}, prompt)
            if hindi_text and "LLM Error" not in hindi_text:
                # Basic cleaning to remove common LLM bloat
                cleaned_text = re.sub(r'\*\*.*?\*\*', '', hindi_text) # Remove bold
                cleaned_text = re.sub(r'#.*?\n', '', cleaned_text)    # Remove headers
                cleaned_text = re.sub(r'\[.*?\]', '', cleaned_text)   # Remove brackets
                tts_text = cleaned_text.strip()
                print(f"✅ Cleaned Transliteration for TTS: {tts_text}")
        except Exception as e:
            print(f"⚠️ Hindi LLM generation failed: {e}")

    audio_bytes, audio_format = synthesize_reply_audio(
        tts_text,
        persona_name,
        language
    )

    return {
        "audio_bytes": audio_bytes,
        "audio_format": audio_format
    }