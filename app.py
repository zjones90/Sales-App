import json
import os
from flask import Flask, jsonify, render_template, request, abort

app = Flask(__name__)

# Path for our JSON data file
LEADS_FILE = 'leads.json'

# Helper function to read leads from the JSON file
def get_leads():
    if not os.path.exists(LEADS_FILE):
        return {}
    with open(LEADS_FILE, 'r') as f:
        # Handle empty file case
        content = f.read()
        if not content:
            return {}
        return json.loads(content)

# Helper function to write leads to the JSON file
def save_leads(leads):
    with open(LEADS_FILE, 'w') as f:
        json.dump(leads, f, indent=4)

# --- API Endpoints ---

@app.route('/api/leads', methods=['GET'])
def api_get_leads():
    leads = get_leads()
    # Return as a list of leads, which is more useful for frontends
    return jsonify(list(leads.values()))

@app.route('/api/leads', methods=['POST'])
def api_create_lead():
    data = request.get_json()
    if not data or 'address' not in data:
        abort(400, description="Missing address in request body")

    leads = get_leads()

    # Generate a new ID (simple incrementing integer)
    new_id = max([int(k) for k in leads.keys()] or [0]) + 1
    lead_id_str = str(new_id)

    new_lead = {
        'id': lead_id_str,
        'name': data.get('name', ''),
        'address': data.get('address', {}),
        'phone': data.get('phone', ''),
        'notes': [],
        'status': 'New'
    }
    # The address object should contain lat, lng, and full_address
    if 'address' in data and 'full_address' in data['address']:
        new_lead['address']['full_address'] = data['address']['full_address']

    leads[lead_id_str] = new_lead
    save_leads(leads)

    return jsonify(new_lead), 201

@app.route('/api/leads/<lead_id>', methods=['PUT'])
def api_update_lead(lead_id):
    data = request.get_json()
    if not data:
        abort(400, description="Invalid request body")

    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")

    # Perform a deep merge for nested objects like 'address'
    for key, value in data.items():
        if key == 'address' and isinstance(value, dict):
            if 'address' not in leads[lead_id] or not isinstance(leads[lead_id].get('address'), dict):
                leads[lead_id]['address'] = {}
            leads[lead_id]['address'].update(value)
        elif key in leads[lead_id]:
            leads[lead_id][key] = value

    save_leads(leads)
    return jsonify(leads[lead_id])

@app.route('/api/leads/<lead_id>', methods=['DELETE'])
def api_delete_lead(lead_id):
    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")

    del leads[lead_id]
    save_leads(leads)

    return '', 204

@app.route('/api/leads/<lead_id>', methods=['GET'])
def api_get_lead(lead_id):
    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")
    return jsonify(leads[lead_id])

# --- Frontend Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/leads')
def leads_page():
    return render_template('leads.html')

@app.route('/leads/<lead_id>')
def lead_detail_page(lead_id):
    # The actual data will be fetched by the frontend JS
    return render_template('lead_detail.html', lead_id=lead_id)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
