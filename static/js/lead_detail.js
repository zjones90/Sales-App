document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const leadForm = document.getElementById('lead-form');
    const leadNameHeaderEl = document.getElementById('lead-name-header');
    const leadNameInput = document.getElementById('lead-name');
    const leadStatusEl = document.getElementById('lead-status');
    const leadPhoneInput = document.getElementById('lead-phone');
    const editBtn = document.getElementById('edit-btn');
    const saveBtn = document.getElementById('save-btn');
    const callBtn = document.getElementById('call-btn');
    const textBtn = document.getElementById('text-btn');
    const notesListEl = document.getElementById('notes-list');
    const addNoteForm = document.getElementById('add-note-form');
    const noteTextEl = document.getElementById('note-text');

    let currentLead = null;

    // --- Functions ---
    const fetchLeadData = async () => {
        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`);
            if (!response.ok) throw new Error('Lead not found');
            currentLead = await response.json();
            renderLeadData();
        } catch (error) {
            console.error('Error fetching lead data:', error);
            document.getElementById('lead-detail-container').innerHTML = '<h2>Lead not found</h2>';
        }
    };

    const renderLeadData = () => {
        if (!currentLead) return;

        // Use header for display, input for editing
        leadNameHeaderEl.textContent = currentLead.name;
        leadNameInput.value = currentLead.name;
        leadStatusEl.textContent = currentLead.status;
        leadPhoneInput.value = currentLead.phone;

        // Toggle visibility based on edit mode
        leadNameHeaderEl.style.display = 'block';
        leadNameInput.style.display = 'none';

        // Set up communication links
        if (currentLead.phone) {
            callBtn.href = `tel:${currentLead.phone}`;
            textBtn.href = `sms:${currentLead.phone}`;
            callBtn.style.display = 'inline-block';
            textBtn.style.display = 'inline-block';
        } else {
            callBtn.style.display = 'none';
            textBtn.style.display = 'none';
        }

        // Render notes
        notesListEl.innerHTML = '';
        if (currentLead.notes && currentLead.notes.length > 0) {
            currentLead.notes.forEach(note => {
                const li = document.createElement('li');
                li.textContent = note;
                notesListEl.appendChild(li);
            });
        } else {
            notesListEl.innerHTML = '<li>No notes yet.</li>';
        }
    };

    const setEditMode = (isEditing) => {
        leadNameInput.readOnly = !isEditing;
        leadPhoneInput.readOnly = !isEditing;

        // Toggle visibility of header vs. input for the name
        leadNameHeaderEl.style.display = isEditing ? 'none' : 'block';
        leadNameInput.style.display = isEditing ? 'block' : 'none';

        editBtn.style.display = isEditing ? 'none' : 'inline-block';
        saveBtn.style.display = isEditing ? 'inline-block' : 'none';
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const updatedData = {
            name: leadNameInput.value,
            phone: leadPhoneInput.value,
        };

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData();
                setEditMode(false);
            } else {
                alert('Failed to save changes.');
            }
        } catch (error) {
            console.error('Error saving lead data:', error);
            alert('An error occurred while saving.');
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        const newNote = noteTextEl.value.trim();
        if (!newNote || !currentLead) return;

        const updatedNotes = [...(currentLead.notes || []), newNote];

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: updatedNotes }),
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData();
                noteTextEl.value = '';
            } else {
                alert('Failed to add note.');
            }
        } catch (error) {
            console.error('Error adding note:', error);
            alert('An error occurred while adding the note.');
        }
    };

    // --- Event Listeners ---
    editBtn.addEventListener('click', () => setEditMode(true));
    leadForm.addEventListener('submit', handleFormSubmit);
    addNoteForm.addEventListener('submit', handleAddNote);

    // --- Initial Load ---
    fetchLeadData();
});
