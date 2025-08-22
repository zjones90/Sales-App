document.addEventListener('DOMContentLoaded', () => {
    const leadNameEl = document.getElementById('lead-name');
    const leadStatusEl = document.getElementById('lead-status');
    const leadPhoneEl = document.getElementById('lead-phone');
    const leadAddressEl = document.getElementById('lead-address');
    const callBtn = document.getElementById('call-btn');
    const textBtn = document.getElementById('text-btn');
    const notesListEl = document.getElementById('notes-list');
    const addNoteForm = document.getElementById('add-note-form');
    const noteTextEl = document.getElementById('note-text');

    let currentLead = null;

    const fetchLeadData = async () => {
        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`);
            if (!response.ok) {
                throw new Error('Lead not found');
            }
            currentLead = await response.json();
            renderLeadData();
        } catch (error) {
            console.error('Error fetching lead data:', error);
            document.getElementById('lead-detail-container').innerHTML = '<h2>Lead not found</h2>';
        }
    };

    const renderLeadData = () => {
        if (!currentLead) return;

        leadNameEl.textContent = currentLead.name;
        leadStatusEl.textContent = currentLead.status;
        leadPhoneEl.textContent = currentLead.phone;

        if (currentLead.address && currentLead.address.full_address) {
            leadAddressEl.textContent = currentLead.address.full_address;
        } else {
            leadAddressEl.textContent = 'No address provided.';
        }

        // Set up communication links
        if (currentLead.phone) {
            callBtn.href = `tel:${currentLead.phone}`;
            textBtn.href = `sms:${currentLead.phone}`;
        } else {
            callBtn.style.display = 'none';
            textBtn.style.display = 'none';
        }

        // Render notes
        notesListEl.innerHTML = '';
        currentLead.notes.forEach(note => {
            const li = document.createElement('li');
            li.textContent = note;
            notesListEl.appendChild(li);
        });
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        const newNote = noteTextEl.value.trim();
        if (!newNote || !currentLead) return;

        const updatedNotes = [...currentLead.notes, newNote];

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notes: updatedNotes }),
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData(); // Re-render the data
                noteTextEl.value = ''; // Clear the textarea
            } else {
                alert('Failed to add note.');
            }
        } catch (error) {
            console.error('Error adding note:', error);
            alert('An error occurred while adding the note.');
        }
    };

    addNoteForm.addEventListener('submit', handleAddNote);

    fetchLeadData();
});
