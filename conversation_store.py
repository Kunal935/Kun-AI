import json
import os

MEMORY_FILE = "data/conversations.json"


def load_memory():

    if not os.path.exists(MEMORY_FILE):
        return {}

    with open(MEMORY_FILE, "r") as f:
        return json.load(f)


def save_memory(data):

    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)


def add_message(user_id, persona, role, message):

    data = load_memory()

    key = f"{user_id}_{persona}"

    if key not in data:
        data[key] = []

    data[key].append({
        "role": role,
        "content": message
    })

    # keep last 12 messages
    data[key] = data[key][-12:]

    save_memory(data)


def get_memory(user_id, persona):

    data = load_memory()

    key = f"{user_id}_{persona}"

    return data.get(key, [])