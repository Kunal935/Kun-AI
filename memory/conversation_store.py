import json
import os
import threading

MEMORY_FILE = "data/conversations.json"

# thread lock to avoid overwrite
lock = threading.Lock()


def load_memory():
    """Load conversation memory safely"""

    if not os.path.exists(MEMORY_FILE):
        os.makedirs("data", exist_ok=True)
        with open(MEMORY_FILE, "w") as f:
            json.dump({}, f)
        return {}

    try:
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}


def save_memory(data):
    """Save conversation memory safely"""

    with lock:
        with open(MEMORY_FILE, "w") as f:
            json.dump(data, f, indent=2)


def add_message(user_id, persona, role, message):
    """Add message to conversation history"""

    data = load_memory()

    key = f"{user_id}_{persona}"

    if key not in data:
        data[key] = []

    data[key].append({
        "role": role,
        "content": message
    })

    # keep last 12 messages only
    data[key] = data[key][-12:]

    save_memory(data)


def get_memory(user_id, persona):
    """Retrieve conversation memory"""

    data = load_memory()

    key = f"{user_id}_{persona}"

    return data.get(key, [])