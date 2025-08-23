import json
import uuid

LEADS_FILE = 'leads.json'

def migrate_notes():
    """
    Reads leads from leads.json, adds a unique ID to each note,
    and writes the updated data back.
    """
    try:
        with open(LEADS_FILE, 'r') as f:
            leads = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"Could not read or decode {LEADS_FILE}. No migration performed.")
        return

    for lead_id, lead_data in leads.items():
        if 'notes' in lead_data and isinstance(lead_data['notes'], list):
            for note in lead_data['notes']:
                if 'id' not in note:
                    note['id'] = str(uuid.uuid4())

    try:
        with open(LEADS_FILE, 'w') as f:
            json.dump(leads, f, indent=4)
        print("Successfully migrated notes in leads.json.")
    except IOError:
        print(f"Could not write to {LEADS_FILE}. Migration failed.")

if __name__ == '__main__':
    migrate_notes()
