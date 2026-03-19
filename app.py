from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Security
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel


import asyncio
import json
import os
import io
import base64


from hinglish_module.hinglish_llm import ChatSession
from tts.voice_manager import synthesize_reply_audio, detect_language, stream_xtts
from fastapi.staticfiles import StaticFiles
from stt.whisper_engine import transcribe_byte
from voice_reply import chat_reply, chat_reply_stream, voice_message_reply, speak_text
from auth_handler import get_current_user, create_access_token, verify_password, get_user, deduct_tokens


app = FastAPI(title="Voice AI Backend")

# -----------------------------
# Realtime Voice Call Sessions
# -----------------------------

VOICE_SESSIONS = {}


# Serve static folders
app.mount("/profile", StaticFiles(directory="profile"), name="profile")
app.mount("/voicesamples", StaticFiles(directory="voicesamples"), name="voicesamples")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


API_BASE = os.getenv("API_BASE", "http://localhost:8000")
PERSONA_FILE = "persona_profile.json"


# --------------------------------
# Persona helpers
# --------------------------------

def load_personas():

    if not os.path.exists(PERSONA_FILE):
        return {}

    with open(PERSONA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_personas(data):

    with open(PERSONA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# --------------------------------
# AUTH & TOKENS
# --------------------------------

class LoginRequest(BaseModel):
    user_id: str
    password: str

@app.post("/login")
def login(req: LoginRequest):
    user = get_user(req.user_id)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user["user_id"]})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/tokens")
def get_tokens(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "tokens": user["tokens"]}

@app.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    # Mask password hash
    safe_user = user.copy()
    if "password_hash" in safe_user:
        del safe_user["password_hash"]
    return safe_user

@app.post("/profile/update")
async def update_profile(
    username: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    profile_pic: UploadFile = File(None),
    user: dict = Depends(get_current_user)
):
    updates = {}
    if username: updates["username"] = username
    if email: updates["email"] = email
    
    if profile_pic:
        filename = f"user_{user['user_id']}.jpg"
        # Store in user_profile_pictures
        folder = os.path.join("profile", "user_profile_pictures")
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        with open(path, "wb") as f:
            f.write(await profile_pic.read())
        updates["profile_pic"] = f"{API_BASE}/profile/user_profile_pictures/{filename}"
    
    from auth_handler import update_user
    updated = update_user(user["user_id"], updates)
    return {"status": "success", "avatar": updated.get("profile_pic")}

@app.post("/change-password")
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    user: dict = Depends(get_current_user)
):
    from auth_handler import verify_password, hash_password, update_user
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid current password")
    
    update_user(user["user_id"], {"password_hash": hash_password(new_password)})
    return {"status": "success"}


@app.get("/usage-analytics")
def get_usage_analytics(user: dict = Depends(get_current_user)):
    # Calculate favorite character from history
    from memory.conversation_store import load_memory
    mem = load_memory()
    user_id = user["user_id"]
    
    counts = {}
    for key, msgs in mem.items():
        if key.startswith(f"{user_id}_"):
            persona = key.replace(f"{user_id}_", "")
            counts[persona] = len(msgs)
    
    fav = "None"
    fav_count = 0
    if counts:
        fav = max(counts, key=counts.get)
        fav_count = counts[fav]
        # Get pretty name
        personas = load_personas()
        if fav in personas:
            fav = personas[fav]["name"]

    return {
        "overall_messages_sent": user.get("total_messages", 0),
        "overall_tokens_used": user.get("total_tokens_used", 0),
        "most_used_persona": f"{fav} ({fav_count} turns)",
        "daily_messages": user.get("daily_messages", 0),
        "daily_tokens": user.get("daily_tokens", 0),
        "is_demo": user.get("is_demo", False),
        "demo_usage": f"{user.get('used_count', 0)}/{user.get('usage_limit', 40)}" if user.get("is_demo") else None
    }

# --------------------------------
# DEMO ACCESS GENERATOR
# --------------------------------

@app.get("/generate-demo")
def generate_demo(limit: int = 40):
    from auth_handler import generate_demo_user
    new_user = generate_demo_user(limit)
    
    # In a real app, this base URL would come from an ENV var
    frontend_base = "http://localhost:5173" 
    demo_link = f"{frontend_base}/demo?access_token={new_user['access_token']}"
    
    return {
        "status": "success",
        "demo_link": demo_link,
        "access_token": new_user["access_token"],
        "usage_limit": limit
    }

# --------------------------------
# Health check
# --------------------------------

@app.get("/")
def home():

    return {
        "status": "running",
        "service": "Voice AI Backend"
    }


@app.get("/character-status/{character_id}")
def get_character_status(character_id: str):
    """Check if a character has recent chat activity (active/inactive)."""
    from memory.conversation_store import load_memory
    import datetime
    mem = load_memory()
    
    # Check if any user has chatted with this character recently
    now = datetime.datetime.now()
    has_recent = False
    for key, msgs in mem.items():
        if key.endswith(f"_{character_id}") and len(msgs) > 0:
            has_recent = True
            break
    
    # Original 3 characters are always "active"
    if character_id in ["goku", "gojo", "levi"]:
        return {"status": "active"}
    
    return {"status": "active" if has_recent else "inactive"}

@app.get("/characters")
def get_characters():
    personas = load_personas()
    # Ensure default avatars are set if missing from profile folder
    originals = {
        "goku": "profile/goku.jpg",
        "gojo": "profile/gojo.jpg",
        "levi": "profile/levi.jpg"
    }
    from memory.conversation_store import load_memory
    mem = load_memory()
    persona_users = {}
    for key in mem.keys():
        parts = key.rsplit('_', 1)
        if len(parts) == 2:
            uid, pid = parts
            if pid not in persona_users:
                persona_users[pid] = set()
            persona_users[pid].add(uid)

    for cid in personas:
        if cid in originals:
            personas[cid]["avatar"] = f"{API_BASE}/{originals[cid]}"
        elif "avatar" not in personas[cid]:
            personas[cid]["avatar"] = f"https://api.dicebear.com/7.x/big-smile/svg?seed={cid}"
        if "usage_count" not in personas[cid]:
            personas[cid]["usage_count"] = 0
        personas[cid]["users_count"] = len(persona_users.get(cid, set()))
    return personas


@app.post("/create-character")
async def create_character(
    name: str = Form(...),
    description: str = Form(...),
    system_prompt: str = Form(...),
    personality: str = Form("Casual"),
    avatar: UploadFile = File(None),
    user: dict = Depends(get_current_user)
):
    personas = load_personas()
    from auth_handler import deduct_tokens
    
    originals = ["goku", "gojo", "levi"]
    custom_count = len([k for k in personas if k not in originals])
    
    if custom_count >= 1: # Limit to 1
        raise HTTPException(status_code=400, detail="Neural limit reached: 1 custom character maximum. Delete existing custom character first.")

    # Deduct 500 tokens for creation (only after limit check passes)
    try:
        deduct_tokens(user["user_id"], 500)
    except HTTPException:
        raise HTTPException(status_code=403, detail="Not enough tokens to create this character (500 required).")

    char_id = name.lower().replace(" ", "_")
    if char_id in personas:
        char_id = f"{char_id}_{int(asyncio.get_event_loop().time())}"

    avatar_url = f"https://api.dicebear.com/7.x/big-smile/svg?seed={name}"
    if avatar:
        avatar_filename = f"{char_id}.jpg"
        # Store in character_profile_pictures
        folder = os.path.join("profile", "character_profile_pictures")
        os.makedirs(folder, exist_ok=True)
        avatar_path = os.path.join(folder, avatar_filename)
        with open(avatar_path, "wb") as f:
            f.write(await avatar.read())
        avatar_url = f"{API_BASE}/profile/character_profile_pictures/{avatar_filename}"

    import datetime
    personas[char_id] = {
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
        "personality": personality,
        "avatar": avatar_url,
        "usage_count": 0,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d")
    }

    save_personas(personas)

    return {
        "status": "created",
        "id": char_id
    }


# --------------------------------
# Upload voice sample
# --------------------------------

@app.post("/voice-upload")
async def voice_upload(
    persona: str = Form(...),
    file: UploadFile = File(...)
):

    folder = f"voices/{persona}"

    os.makedirs(folder, exist_ok=True)

    path = f"{folder}/{file.filename}"

    with open(path, "wb") as f:
        f.write(await file.read())

    return {
        "status": "uploaded",
        "path": path
    }


# --------------------------------
# STT
# --------------------------------

@app.post("/stt")
async def stt(file: UploadFile = File(...)):

    audio_bytes = await file.read()

    text = await asyncio.to_thread(
        transcribe_byte,
        audio_bytes
    )

    return {"text": text}


# --------------------------------
# TEXT CHAT
# --------------------------------

@app.post("/chat")
async def chat(
    background_tasks: BackgroundTasks,
    persona: str = Form(...),
    message: str = Form(...),
    language: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    
    # Check and deduct tokens (Fixed cost per request: 40)
    from auth_handler import deduct_tokens
    deduct_tokens(user_id, 40)
    # Auto-detect language if the user is typing Hinglish
    detected = detect_language(message)
    if detected == "hinglish":
        language = "hi"
    
    personas = load_personas()
    if persona not in personas:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Increment usage count
    personas[persona]["usage_count"] = personas[persona].get("usage_count", 0) + 1
    save_personas(personas)

    async def event_generator():
        full_reply = ""
        # Get the stream generator from voice_reply
        # Update chat_reply_stream to take user_id if needed, or pass it if voice_reply.py supports it
        stream = chat_reply_stream(user_id, message, persona, language)
        
        for chunk in stream:
            full_reply += chunk
            # Yield as SSE data
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        
        # Once text is done, trigger TTS in background
        background_tasks.add_task(speak_text, full_reply, persona, language)
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/history/{user_id}/{persona}")
def get_chat_history(user_id: str, persona: str):
    from memory.conversation_store import get_memory
    history = get_memory(user_id, persona)
    # Convert role to sender for frontend compatibility if needed, or keep as is
    # Frontend expects: { id, sender: 'user'|'ai', text, time }
    # Backend has: { role: 'User'|'AI', content }
    formatted = []
    import datetime
    for i, msg in enumerate(history):
        formatted.append({
            "id": i,
            "sender": msg["role"].lower(),
            "text": msg["content"],
            "time": "" # Time not stored in backend memory yet
        })
    return formatted


@app.delete("/delete-character/{persona}")
def delete_character(persona: str):
    personas = load_personas()
    
    # Do NOT allow deletion of default characters
    if persona.lower() in ["goku", "gojo", "levi"]:
        raise HTTPException(status_code=400, detail="Cannot delete default characters")
        
    if persona in personas:
        # Delete avatar file if it's a local file
        avatar_url = personas[persona].get("avatar", "")
        if avatar_url.startswith(API_BASE + "/profile/"):
            filename = avatar_url.split("/")[-1]
            filepath = os.path.join("profile", filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass

        del personas[persona]
        save_personas(personas)
        
        # Cleanup memory (Option 1: delete associated chat history)
        from memory.conversation_store import load_memory, save_memory
        memory_data = load_memory()
        keys_to_delete = [k for k in memory_data.keys() if k.endswith(f"_{persona.lower()}")]
        for k in keys_to_delete:
            del memory_data[k]
        save_memory(memory_data)
        
        return {"status": "deleted", "id": persona}
    
    raise HTTPException(status_code=404, detail="Character not found")


# --------------------------------
# VOICE CHAT
# --------------------------------

@app.post("/voice-chat")
async def voice_chat(
    persona: str = Form(...),
    language: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Form("default_user")
):

    path = f"temp_{file.filename}"

    with open(path, "wb") as f:
        f.write(await file.read())

    # We don't know the text yet, so we pass the language from form
    # but voice_message_reply could internally refine it.
    result = await asyncio.to_thread(
        voice_message_reply,
        user_id,
        path,
        persona,
        language
    )

    audio_base64 = base64.b64encode(
        result["audio_bytes"]
    ).decode()

    return {
        "user_text": result["user_text"],
        "reply": result["reply_text"],
        "audio": audio_base64,
        "sample_rate": result["sample_rate"]
    }


# --------------------------------
# SPEAK (Play button)
# --------------------------------

@app.post("/speak")
async def speak(
    persona: str = Form(...),
    text: str = Form(...),
    language: str = Form("english")
):

    result = await asyncio.to_thread(
        speak_text,
        text,
        persona,
        language
    )

    return StreamingResponse(
        io.BytesIO(result["audio_bytes"]),
        media_type="audio/wav"
    )



# --------------------------------
# REALTIME VOICE CALL
# --------------------------------

@app.websocket("/voice-call/{user_id}/{persona}/{language}")
async def realtime_voice_call(
    websocket: WebSocket,
    user_id: str,
    persona: str,
    language: str
):
    await websocket.accept()
    key = f"{user_id}_{persona}_{language}"

    if key not in VOICE_SESSIONS:
        VOICE_SESSIONS[key] = ChatSession(
            persona_name=persona,
            language=language,
            user_id=user_id
        )

    chat = VOICE_SESSIONS[key]

    try:
        while True:
            # receive message from frontend
            msg = await websocket.receive()
            
            if msg["type"] == "websocket.disconnect":
                break

            if msg["type"] == "websocket.receive":
                if "bytes" in msg:
                    audio_bytes = msg["bytes"]
                    # STT
                    user_text = await asyncio.to_thread(transcribe_byte, audio_bytes)
                    if not user_text or not user_text.strip():
                        continue

                    print(f"User ({user_id}): {user_text}")

                    # Token control for voice (60 tokens)
                    try:
                        deduct_tokens(user_id, 60)
                    except HTTPException as e:
                        await websocket.send_text(json.dumps({"error": "Token limit reached. Please earn or purchase more tokens."}))
                        break

                    # Strict language control:
                    chat.language = language # 'hi' or 'en'
                    tts_lang = "hi" if language == "hi" else "en"
                    
                    # LLM
                    reply_text = chat.send_message(user_text)
                    print(f"AI ({persona}): {reply_text}")

                    # Streaming XTTS
                    async for audio_chunk in stream_xtts(reply_text, persona, tts_lang):
                        await websocket.send_bytes(audio_chunk)
                
                elif "text" in msg:
                    try:
                        data = json.loads(msg["text"])
                        if data.get("type") == "ping":
                            await websocket.send_text("pong")
                        elif data.get("type") == "end_call":
                            break
                        else:
                            print(f"Control message from {user_id}: {data}")
                    except json.JSONDecodeError:
                        if msg["text"] == "ping":
                            await websocket.send_text("pong")

    except WebSocketDisconnect:
        print(f"Voice call disconnected for {user_id}")
    finally:
        print(f"Voice call ended for {user_id}")