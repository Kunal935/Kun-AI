import os
from google import genai
from utils.logger import get_logger

logger = get_logger("llm")

# Initialize Gemini client
# API key is fetched from environment variable GEMINI_API_KEY
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    logger.error("GEMINI_API_KEY not found in environment variables!")
    # Fallback or raise error depending on desired behavior
    # For now, we'll initialize and it might fail later if key is missing
    client = None
else:
    client = genai.Client(api_key=api_key)

# Model chain for failover
MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"]

def generate_reply(persona: dict, final_prompt: str) -> str:
    """
    Generate reply using Gemini models with automatic failover.
    """
    if not client:
        return "LLM Error: Gemini API Key missing."

    logger.info("Generating LLM response via Gemini...")

    for model in MODEL_CHAIN:
        try:
            response = client.models.generate_content(
                model=model,
                contents=final_prompt
            )
            
            if response and response.text:
                logger.info(f"Success with model: {model}")
                return response.text.strip()
            else:
                logger.warning(f"Empty response from {model}")
                continue

        except Exception as e:
            msg = str(e).lower()
            logger.warning(f"Error with {model}: {e}")
            # Check for rate limit or other temporary errors to try next model
            if "429" in msg or "rate_limit" in msg or "quota" in msg:
                logger.warning(f"Quota/Rate limit for {model}, trying next...")
                continue
            else:
                # For other errors, we might still want to try the next model 
                # or just log and continue
                continue

    return "LLM Error: All Gemini models failed or hit quota limits."

def generate_reply_stream(persona: dict, final_prompt: str):
    """
    Generate reply using Gemini models with streaming and automatic failover.
    """
    if not client:
        yield "LLM Error: Gemini API Key missing."
        return

    logger.info("Generating Streaming LLM response via Gemini...")

    for model in MODEL_CHAIN:
        try:
            # Use generate_content_stream for the correct SDK streaming method
            response = client.models.generate_content_stream(
                model=model,
                contents=final_prompt
            )
            
            success = False
            for chunk in response:
                if chunk and chunk.text:
                    success = True
                    yield chunk.text
            
            if success:
                logger.info(f"Streaming success with model: {model}")
                return

        except Exception as e:
            logger.warning(f"Streaming error with {model}: {e}")
            continue

    yield "LLM Error: All Gemini models failed or hit quota limits."