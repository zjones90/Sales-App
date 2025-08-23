document.addEventListener('DOMContentLoaded', () => {
    // --- Toast Notification Function ---
    const showToast = (message, type = 'success') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    };

    // --- Element Selectors ---
    const leadForm = document.getElementById('lead-form');
    const leadFirstNameInput = document.getElementById('lead-first-name');
    const leadLastNameInput = document.getElementById('lead-last-name');
    const leadStatusSelect = document.getElementById('lead-status');
    const leadCreatedAtEl = document.getElementById('lead-created-at');
    const leadPhoneInput = document.getElementById('lead-phone');
    const leadAddressInput = document.getElementById('lead-address');
    const callBtn = document.getElementById('call-btn');
    const textBtn = document.getElementById('text-btn');
    const notesListEl = document.getElementById('notes-list');
    const addNoteForm = document.getElementById('add-note-form');
    const noteTextEl = document.getElementById('note-text');
    const noteAttachmentInput = document.getElementById('note-attachment');
    const deleteBtn = document.getElementById('delete-lead-btn');
    const adjustPinBtn = document.getElementById('adjust-pin-btn');
    const snoozeLeadBtn = document.getElementById('snooze-lead-btn');
    const viewOnMapBtn = document.getElementById('view-on-map-btn');

    // --- Snooze Functionality ---
    const snoozeModal = document.getElementById('snooze-modal');
    const snoozeDaysInput = document.getElementById('snooze-days');
    const snoozeDateInput = document.getElementById('snooze-date');
    const confirmSnoozeBtn = document.getElementById('confirm-snooze-btn');
    const cancelSnoozeBtn = document.getElementById('cancel-snooze-modal');

    const openSnoozeModal = () => {
        snoozeDaysInput.value = '';
        snoozeDateInput.value = '';
        snoozeModal.style.display = 'flex';
    };

    const closeSnoozeModal = () => {
        snoozeModal.style.display = 'none';
    };

    const confirmSnooze = async () => {
        let snoozeUntil = null;
        const days = parseInt(snoozeDaysInput.value);
        const date = snoozeDateInput.value;

        if (date) {
            snoozeUntil = new Date(date);
        } else if (!isNaN(days) && days > 0) {
            snoozeUntil = new Date();
            snoozeUntil.setDate(snoozeUntil.getDate() + days);
        } else {
            showToast('Please enter a valid number of days or select a date.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snooze_until: snoozeUntil.toISOString().split('T')[0] }),
            });
            if (response.ok) {
                showToast('Lead snoozed!');
                currentLead = await response.json();
                renderLeadData();
            } else {
                showToast('Failed to snooze lead.', 'error');
            }
        } catch (error) {
            console.error('Error snoozing lead:', error);
            showToast('An error occurred while snoozing.', 'error');
        } finally {
            closeSnoozeModal();
        }
    };

    let currentLead = null;
    let statuses = [];

    // --- Data Fetching ---
    const fetchStatuses = async () => {
        try {
            const response = await fetch('/api/statuses');
            if (!response.ok) throw new Error('Failed to fetch statuses');
            statuses = await response.json();
            populateStatusDropdown();
        } catch (error) {
            console.error('Error fetching statuses:', error);
            showToast('Could not load statuses.', 'error');
        }
    };

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

    // --- Rendering ---
    const populateStatusDropdown = () => {
        leadStatusSelect.innerHTML = '';
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            leadStatusSelect.appendChild(option);
        });
        // Set the correct status for the current lead if available
        if (currentLead) {
            leadStatusSelect.value = currentLead.status;
        }
    };

    const renderLeadData = () => {
        if (!currentLead) return;

        // Populate form fields
        leadFirstNameInput.value = currentLead.first_name || '';
        leadLastNameInput.value = currentLead.last_name || '';
        leadPhoneInput.value = currentLead.phone || '';
        leadAddressInput.value = currentLead.address?.full_address || '';
        leadStatusSelect.value = currentLead.status || 'New';

        // Display formatted created_at date
        if (currentLead.created_at) {
            const date = new Date(currentLead.created_at);
            leadCreatedAtEl.textContent = date.toLocaleString();
        } else {
            leadCreatedAtEl.textContent = 'N/A';
        }

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

        // Set up View on Map link
        if (currentLead.address && currentLead.address.lat && currentLead.address.lng) {
            viewOnMapBtn.href = `/?lat=${currentLead.address.lat}&lng=${currentLead.address.lng}&zoom=18`;
            viewOnMapBtn.style.display = 'inline-block';
        } else {
            viewOnMapBtn.style.display = 'none';
        }

        // Render notes
        notesListEl.innerHTML = '';
        if (currentLead.notes && Array.isArray(currentLead.notes)) {
            currentLead.notes.forEach(note => {
                const li = document.createElement('li');
                li.dataset.noteId = note.id;

                const noteDate = new Date(note.timestamp).toLocaleString();
                let noteContent = `
                    <div class="note-content">
                        <p>${note.text}</p>
                        <small>${noteDate}</small>
                        ${note.attachment ? `<br><a href="${note.attachment}" target="_blank">View Attachment</a>` : ''}
                    </div>
                    <div class="note-actions">
                        <button class="edit-note-btn">✏️</button>
                        <button class="delete-note-btn">🗑️</button>
                    </div>
                `;
                li.innerHTML = noteContent;
                notesListEl.appendChild(li);
            });
        }
    };

    const handleEditNote = async (noteId) => {
        const noteToEdit = currentLead.notes.find(n => n.id === noteId);
        if (!noteToEdit) return;

        const newText = prompt('Edit your note:', noteToEdit.text);
        if (newText === null || newText.trim() === noteToEdit.text) {
            return; // Exit if user cancels or makes no change
        }

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newText.trim() }),
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData();
                showToast('Note updated successfully!');
            } else {
                showToast('Failed to update note.', 'error');
            }
        } catch (error) {
            console.error('Error updating note:', error);
            showToast('An error occurred while updating the note.', 'error');
        }
    };

    const handleDeleteNote = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}/notes/${noteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData();
                showToast('Note deleted successfully!');
            } else {
                showToast('Failed to delete note.', 'error');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            showToast('An error occurred while deleting the note.', 'error');
        }
    };

    // --- Event Handlers ---
    const handleAddNote = async (e) => {
        e.preventDefault();
        const noteText = noteTextEl.value.trim();
        const attachmentFile = noteAttachmentInput.files[0];

        if (!noteText && !attachmentFile) {
            showToast('Please enter a note or add an attachment.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('text', noteText);
        if (attachmentFile) {
            formData.append('attachment', attachmentFile);
        }

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}/notes`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData(); // Re-render the data
                addNoteForm.reset(); // Clear the form
                showToast('Note added successfully!');
            } else {
                const errorData = await response.json();
                showToast(`Failed to add note: ${errorData.description || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error adding note:', error);
            showToast('An error occurred while adding the note.', 'error');
        }
    };

    const handleUpdateLead = async (e) => {
        e.preventDefault();
        const updatedData = {
            first_name: leadFirstNameInput.value,
            last_name: leadLastNameInput.value,
            phone: leadPhoneInput.value,
            status: leadStatusSelect.value,
            address: {
                ...(currentLead.address || {}),
                full_address: leadAddressInput.value
            }
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
                showToast('Lead updated successfully!');
            } else {
                showToast('Failed to update lead.', 'error');
            }
        } catch (error) {
            console.error('Error updating lead:', error);
            showToast('An error occurred while updating the lead.', 'error');
        }
    };

    const handleDeleteLead = async (e) => {
        e.preventDefault(); // Prevent default link behavior
        if (!currentLead) return;

        if (confirm('Are you sure you want to permanently delete this lead?')) {
            try {
                const response = await fetch(`/api/leads/${LEAD_ID}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Lead deleted successfully. Redirecting...');
                    setTimeout(() => { window.location.href = '/leads'; }, 1500);
                } else {
                    showToast('Failed to delete lead.', 'error');
                }
            } catch (error) {
                console.error('Error deleting lead:', error);
                showToast('An error occurred while deleting the lead.', 'error');
            }
        }
    };

    const handleAdjustPin = async () => {
        if (!currentLead) return;
        const address = leadAddressInput.value;
        if (!address) {
            showToast('Address field is empty.', 'error');
            return;
        }
        showToast('Geocoding address...', 'info');
        try {
            const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const geoData = await geoResponse.json();
            if (geoData.length > 0) {
                const { lat, lon } = geoData[0];
                const updatedData = {
                    address: {
                        ...currentLead.address,
                        full_address: address,
                        lat: parseFloat(lat),
                        lng: parseFloat(lon)
                    }
                };
                const updateResponse = await fetch(`/api/leads/${LEAD_ID}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                });
                if (updateResponse.ok) {
                    currentLead = await updateResponse.json();
                    renderLeadData();
                    showToast('Pin location updated successfully!');
                } else {
                    showToast('Failed to update pin location.', 'error');
                }
            } else {
                showToast('Could not find location for that address.', 'error');
            }
        } catch (error) {
            console.error('Error geocoding address:', error);
            showToast('An error occurred during geocoding.', 'error');
        }
    };

    // --- Initialization ---
    const initializePage = async () => {
        // Fetch statuses first, then lead data
        await fetchStatuses();
        await fetchLeadData();

        // Add event listeners after data is loaded and elements are ready
        addNoteForm.addEventListener('submit', handleAddNote);
        leadForm.addEventListener('submit', handleUpdateLead);
        deleteBtn.addEventListener('click', handleDeleteLead);
        adjustPinBtn.addEventListener('click', handleAdjustPin);
        snoozeLeadBtn.addEventListener('click', openSnoozeModal);
        confirmSnoozeBtn.addEventListener('click', confirmSnooze);
        cancelSnoozeBtn.addEventListener('click', closeSnoozeModal);

        notesListEl.addEventListener('click', (e) => {
            const editButton = e.target.closest('.edit-note-btn');
            const deleteButton = e.target.closest('.delete-note-btn');
            const noteId = e.target.closest('li')?.dataset.noteId;

            if (editButton && noteId) {
                handleEditNote(noteId);
            } else if (deleteButton && noteId) {
                handleDeleteNote(noteId);
            }
        });
    };

    initializePage();
});
