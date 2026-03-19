import json
import os
import threading

PROFILE_MEMORY_PATH = "data/user_profile_memory.json"

lock = threading.Lock()


def load_profiles():
    """Load user profile memory"""

    if not os.path.exists(PROFILE_MEMORY_PATH):
        os.makedirs("data", exist_ok=True)
        with open(PROFILE_MEMORY_PATH, "w") as f:
            json.dump({}, f)
        return {}

    try:
        with open(PROFILE_MEMORY_PATH, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}


def save_profiles(data):
    """Save user profile memory"""

    with lock:
        with open(PROFILE_MEMORY_PATH, "w") as f:
            json.dump(data, f, indent=2)


def add_user_fact(user_id, key, value):
    """Store user personal info"""

    data = load_profiles()

    if user_id not in data:
        data[user_id] = {}

    data[user_id][key] = value

    save_profiles(data)


def get_user_profile(user_id):
    """Retrieve user profile"""

    data = load_profiles()

    return data.get(user_id, {})