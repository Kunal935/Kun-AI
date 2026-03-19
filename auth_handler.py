import os
import json
import jwt
import bcrypt
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

USERS_FILE = "data/user_profiles.json"
security = HTTPBearer()

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    os.makedirs("data", exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)

def get_user(user_id: str):
    users = load_users()
    for user in users:
        if user["user_id"] == user_id:
            return user
    return None

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def hash_password(password: str):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def update_user(user_id: str, updates: dict):
    users = load_users()
    for user in users:
        if user["user_id"] == user_id:
            user.update(updates)
            save_users(users)
            return user
    return None

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload if payload.get("user_id") else None
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(auth: HTTPAuthorizationCredentials = Security(security)):
    credentials = auth.credentials
    
    # Check if it's a JWT or a raw Demo Token
    try:
        payload = jwt.decode(credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        # Fallback: check if it matches an access_token for a demo user
        users = load_users()
        for user in users:
            if user.get("is_demo") and user.get("access_token") == credentials:
                if not user.get("is_active", True):
                    raise HTTPException(status_code=403, detail="Demo access deactivated")
                return user
        raise HTTPException(status_code=401, detail="Invalid session credentials")
        
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_demo_user(limit: int = 40):
    user_id = f"demo_{uuid.uuid4().hex[:8]}"
    access_token = str(uuid.uuid4())
    
    new_user = {
        "user_id": user_id,
        "email": f"{user_id}@demo.kunai.com",
        "username": "Demo User",
        "password_hash": "", # No login password for link-based users
        "access_token": access_token,
        "is_demo": True,
        "usage_limit": limit,
        "used_count": 0,
        "is_active": True,
        "tokens": 5000, # Initial tokens for demo
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_messages": 0,
        "total_tokens_used": 0,
        "daily_messages": 0,
        "daily_tokens": 0,
        "last_reset_date": datetime.now().strftime("%Y-%m-%d")
    }
    
    users = load_users()
    users.append(new_user)
    save_users(users)
    return new_user

def deduct_tokens(user_id: str, amount: int = 100):
    users = load_users()
    import datetime
    today = datetime.date.today().isoformat()
    
    for user in users:
        if user["user_id"] == user_id:
            if user["tokens"] < amount:
                raise HTTPException(status_code=403, detail="Token limit exceeded")
            
            # Update tokens
            user["tokens"] -= amount
            
            # Update analytics
            user["total_tokens_used"] = user.get("total_tokens_used", 0) + amount
            user["total_messages"] = user.get("total_messages", 0) + 1
            
            # Daily reset logic
            if user.get("last_reset_date") != today:
                user["last_reset_date"] = today
                user["daily_messages"] = 0
                user["daily_tokens"] = 0
            
            # Demo usage tracking
            if user.get("is_demo"):
                if user.get("used_count", 0) >= user.get("usage_limit", 40):
                    raise HTTPException(status_code=403, detail="Demo limit reached. Please request a new access link.")
                user["used_count"] = user.get("used_count", 0) + 1

            user["daily_messages"] = user.get("daily_messages", 0) + 1
            user["daily_tokens"] = user.get("daily_tokens", 0) + amount
            
            save_users(users)
            return user["tokens"]
    raise HTTPException(status_code=404, detail="User not found")
