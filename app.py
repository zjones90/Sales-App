import json
import os
import uuid
from flask import Flask, jsonify, render_template, request, abort
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Path for our JSON data file
LEADS_FILE = 'leads.json'
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Define the canonical list of lead statuses
LEAD_STATUSES = [
    "New",
    "Contacted",
    "Measured",
    "Presented",
    "Signed",
    "Dug",
    "Completed",
    "Lost"
]

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

@app.route('/api/statuses', methods=['GET'])
def api_get_statuses():
    return jsonify(LEAD_STATUSES)

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
        'first_name': data.get('first_name', ''),
        'last_name': data.get('last_name', ''),
        'address': data.get('address', {}),
        'phone': data.get('phone', ''),
        'notes': [],
        'status': 'New',
        'created_at': datetime.utcnow().isoformat(),
        'snooze_until': None
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

    # Prevent 'created_at' from being updated
    if 'created_at' in data:
        del data['created_at']

    # The frontend will be changed to send first_name and last_name.
    # If the old 'name' field is in the request, ignore it.
    if 'name' in data:
        del data['name']

    # Perform a deep merge for nested objects like 'address' and update other fields
    for key, value in data.items():
        if key == 'address' and isinstance(value, dict):
            if 'address' not in leads[lead_id] or not isinstance(leads[lead_id].get('address'), dict):
                leads[lead_id]['address'] = {}
            leads[lead_id]['address'].update(value)
        elif key != 'notes': # Exclude notes from this generic update
             leads[lead_id][key] = value

    # Remove the old 'name' field from the stored lead object if it exists
    if 'name' in leads[lead_id]:
        del leads[lead_id]['name']

    save_leads(leads)
    return jsonify(leads[lead_id])

@app.route('/api/leads/<lead_id>/notes', methods=['POST'])
def api_add_note(lead_id):
    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")

    note_text = request.form.get('text', '')
    file = request.files.get('attachment')

    attachment_path = None
    if file:
        filename = secure_filename(file.filename)
        lead_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], lead_id)
        os.makedirs(lead_upload_dir, exist_ok=True)
        attachment_path = os.path.join(lead_upload_dir, filename)
        file.save(attachment_path)
        # Store a web-accessible path
        attachment_path = f'/{attachment_path}'


    new_note = {
        'id': str(uuid.uuid4()),
        'text': note_text,
        'timestamp': datetime.utcnow().isoformat(),
        'attachment': attachment_path
    }

    if 'notes' not in leads[lead_id] or not isinstance(leads[lead_id]['notes'], list):
        leads[lead_id]['notes'] = []

    leads[lead_id]['notes'].append(new_note)
    save_leads(leads)

    return jsonify(leads[lead_id]), 200

@app.route('/api/leads/<lead_id>/notes/<note_id>', methods=['PUT'])
def api_update_note(lead_id, note_id):
    data = request.get_json()
    if not data or 'text' not in data:
        abort(400, description="Invalid request body")

    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")

    note_to_update = None
    for note in leads[lead_id].get('notes', []):
        if note.get('id') == note_id:
            note_to_update = note
            break

    if not note_to_update:
        abort(404, description="Note not found")

    note_to_update['text'] = data['text']
    # Optionally update timestamp
    note_to_update['timestamp'] = datetime.utcnow().isoformat()

    save_leads(leads)
    return jsonify(leads[lead_id])

@app.route('/api/leads/<lead_id>/notes/<note_id>', methods=['DELETE'])
def api_delete_note(lead_id, note_id):
    leads = get_leads()
    if lead_id not in leads:
        abort(404, description="Lead not found")

    notes = leads[lead_id].get('notes', [])
    note_index_to_delete = -1
    for i, note in enumerate(notes):
        if note.get('id') == note_id:
            note_index_to_delete = i
            break

    if note_index_to_delete == -1:
        abort(404, description="Note not found")

    del notes[note_index_to_delete]

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

@app.route('/tasks')
def tasks_page():
    return render_template('tasks.html')

# --- Tasks API Endpoints ---

TASKS_FILE = 'tasks.json'

def get_tasks():
    if not os.path.exists(TASKS_FILE):
        return {}
    with open(TASKS_FILE, 'r') as f:
        content = f.read()
        if not content:
            return {}
        return json.loads(content)

def save_tasks(tasks):
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f, indent=4)

@app.route('/api/tasks', methods=['GET'])
def api_get_tasks():
    tasks = get_tasks()
    return jsonify(list(tasks.values()))

@app.route('/api/tasks/<task_id>', methods=['GET'])
def api_get_task(task_id):
    tasks = get_tasks()
    if task_id not in tasks:
        abort(404, description="Task not found")
    return jsonify(tasks[task_id])

@app.route('/api/tasks', methods=['POST'])
def api_create_task():
    data = request.get_json()
    if not data or 'title' not in data:
        abort(400, description="Missing title in request body")

    tasks = get_tasks()
    new_id = str(uuid.uuid4())

    new_task = {
        'id': new_id,
        'title': data['title'],
        'details': data.get('details', ''),
        'due_date': data.get('due_date'),
        'lead_id': data.get('lead_id'),
        'created_at': datetime.utcnow().isoformat(),
        'completed': False
    }

    tasks[new_id] = new_task
    save_tasks(tasks)

    return jsonify(new_task), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def api_update_task(task_id):
    data = request.get_json()
    if not data:
        abort(400, description="Invalid request body")

    tasks = get_tasks()
    if task_id not in tasks:
        abort(404, description="Task not found")

    task = tasks[task_id]
    task['title'] = data.get('title', task['title'])
    task['details'] = data.get('details', task['details'])
    task['due_date'] = data.get('due_date', task['due_date'])
    task['lead_id'] = data.get('lead_id', task['lead_id'])
    task['completed'] = data.get('completed', task['completed'])

    tasks[task_id] = task
    save_tasks(tasks)

    return jsonify(task)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def api_delete_task(task_id):
    tasks = get_tasks()
    if task_id not in tasks:
        abort(404, description="Task not found")

    del tasks[task_id]
    save_tasks(tasks)

    return '', 204

@app.route('/api/leads/<lead_id>/tasks', methods=['GET'])
def api_get_lead_tasks(lead_id):
    tasks = get_tasks()
    lead_tasks = [task for task in tasks.values() if task.get('lead_id') == lead_id]
    return jsonify(lead_tasks)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
