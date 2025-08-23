import json

LEADS_FILE = 'leads.json'

def migrate_names():
    """
    Reads leads from leads.json, splits the 'name' field into
    'first_name' and 'last_name', and writes the updated data back.
    """
    try:
        with open(LEADS_FILE, 'r') as f:
            leads = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"Could not read or decode {LEADS_FILE}. No migration performed.")
        return

    for lead_id, lead_data in leads.items():
        if 'name' in lead_data:
            full_name = lead_data.get('name', '').strip()
            if full_name:
                name_parts = full_name.split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ''
            else:
                first_name = ''
                last_name = ''

            lead_data['first_name'] = first_name
            lead_data['last_name'] = last_name
            del lead_data['name']

    try:
        with open(LEADS_FILE, 'w') as f:
            json.dump(leads, f, indent=4)
        print("Successfully migrated names in leads.json.")
    except IOError:
        print(f"Could not write to {LEADS_FILE}. Migration failed.")

if __name__ == '__main__':
    migrate_names()
