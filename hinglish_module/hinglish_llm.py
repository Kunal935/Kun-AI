import json
import random

from memory.conversation_store import add_message, get_memory
from memory.user_profile_memory import get_user_profile

from llm_brain.inference import generate_reply as base_generate_reply
from llm_brain.inference import generate_reply_stream as base_generate_reply_stream

from llm_brain.prompt_builder import build_prompt

PROFILE_PATH = "persona_profile.json"


def load_personas_safe():
    try:
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
            return {k.lower(): v for k, v in raw_data.items()}
    except Exception as e:
        print("[ERROR] Persona file load failed:", e)
        return {}


class ChatSession:
    """
    Chat with persona + conversation memory + user profile memory
    """
    def __init__(self, persona_name: str, language: str = "hinglish", user_id="default_user"):

        personas = load_personas_safe()

        self.persona_key = persona_name.lower()
        self.persona = personas.get(self.persona_key)

        if not self.persona:
            raise ValueError(f"❌ Persona '{persona_name}' nahi mila!")

        # Normalize language codes: 'hi' or 'hinglish' → 'hi', 'en' or 'english' → 'en'
        raw = language.lower()
        if raw in ("hi", "hinglish"):
            self.language = "hi"
        else:
            self.language = "en"
        self.user_id = user_id

        self.history = []
        self.max_history = 10

        print(f"[DEBUG] Starting chat with {self.persona.get('name', persona_name)} in {self.language}")

    def _transliterate_to_hindi(self, text: str):
        """
        Transliterate Roman Hindi (Hinglish) to Devanagari Hindi for better LLM reasoning.
        """
        # Quick check if it's already Hindi or English
        if not any(ord(c) > 127 for c in text) and self.language == "hi":
            prompt = f"Convert the following Roman Hindi (Hinglish) text into pure Devanagari Hindi for reasoning purposes. Only return the translated Hindi text.\n\nText: {text}"
            try:
                transliterated = base_generate_reply({"name": "Transliterater"}, prompt)
                return transliterated.strip()
            except:
                return text
        return text

    def _get_final_prompt(self, user_text: str):
        # Transliterate for reasoning if in Hindi mode
        hindi_reasoning_text = self._transliterate_to_hindi(user_text)
        
        stored_memory = get_memory(self.user_id, self.persona_key)
        history_context = ""
        for msg in stored_memory[-6:]:
            history_context += f"{msg['role']}: {msg['content']}\n"
        for role, text in self.history[-self.max_history:]:
            history_context += f"{role}: {text}\n"

        profile = get_user_profile(self.user_id)
        profile_context = ""
        for key, value in profile.items():
            profile_context += f"{key}: {value}\n"

        # 1. Language Instruction (Highest Priority)
        if self.language == "en":
            lang_instruction = "You are an AI assistant. Respond ONLY in English. Do not use Hindi or Hinglish."
        else:
            lang_instruction = "You are an AI assistant. Respond in Hindi using Devanagari script."

        # 2. Character Persona
        name = self.persona.get("name", "AI Character")
        personality = self.persona.get("personality", "Helpful")
        persona_context = f"You are {name}. Style: {personality}. Respond in 2-4 lines."

        final_prompt = f"""
SYSTEM:
{lang_instruction}

CHARACTER:
{persona_context}

USER PROFILE:
{profile_context}

CONVERSATION HISTORY:
{history_context}

[INTERNAL REASONING CONTEXT (Hindi)]:
{hindi_reasoning_text}

USER: {user_text}

Now reply as {name} following the strict language rule: {lang_instruction}
"""
        return final_prompt

    def send_message(self, user_text: str):

        final_prompt = self._get_final_prompt(user_text)

        try:

            reply = base_generate_reply(self.persona, final_prompt)

            self.history.append(("User", user_text))
            self.history.append(("AI", reply))

            add_message(self.user_id, self.persona_key, "User", user_text)
            add_message(self.user_id, self.persona_key, "AI", reply)

            if self.language in ("hi", "hinglish"):
                reply += random.choice([" 😂", " 😎", " 🤣"])

            return reply

        except Exception as e:

            print("[hinglish_llm] LLM error:", e)

            return "System thoda garam ho gaya 🥵, phir try karo!"

    def send_message_stream(self, user_text: str):

        final_prompt = self._get_final_prompt(user_text)

        full_reply = ""

        try:

            for chunk in base_generate_reply_stream(self.persona, final_prompt):

                full_reply += chunk
                yield chunk

            self.history.append(("User", user_text))
            self.history.append(("AI", full_reply))

            add_message(self.user_id, self.persona_key, "User", user_text)
            add_message(self.user_id, self.persona_key, "AI", full_reply)

        except Exception as e:

            print("[hinglish_llm] LLM streaming error:", e)

            yield "System thoda garam ho gaya 🥵, phir try karo!"