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

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    };

    const leadForm = document.getElementById('lead-form');
    const leadNameInput = document.getElementById('lead-name');
    const leadStatusText = document.getElementById('lead-status-text');
    const leadPhoneInput = document.getElementById('lead-phone');
    const leadAddressInput = document.getElementById('lead-address');
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

        leadNameInput.value = currentLead.name || '';
        leadStatusText.textContent = currentLead.status || 'N/A';
        leadPhoneInput.value = currentLead.phone || '';
        leadAddressInput.value = currentLead.address?.full_address || '';

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
                showToast('Note added successfully!');
            } else {
                showToast('Failed to add note.', 'error');
            }
        } catch (error) {
            console.error('Error adding note:', error);
            showToast('An error occurred while adding the note.', 'error');
        }
    };

    const handleUpdateLead = async (e) => {
        e.preventDefault();
        const updatedData = {
            name: leadNameInput.value,
            phone: leadPhoneInput.value,
            address: {
                ...currentLead.address, // Preserve lat/lng
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

    addNoteForm.addEventListener('submit', handleAddNote);
    leadForm.addEventListener('submit', handleUpdateLead);

    const handleDeleteLead = async () => {
        if (!currentLead) return;

        if (confirm('Are you sure you want to permanently delete this lead?')) {
            try {
                const response = await fetch(`/api/leads/${LEAD_ID}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    showToast('Lead deleted successfully. Redirecting...');
                    setTimeout(() => {
                        window.location.href = '/leads'; // Redirect to the leads list
                    }, 1500);
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
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const data = await response.json();

            if (data.length > 0) {
                const newLat = parseFloat(data[0].lat);
                const newLng = parseFloat(data[0].lon);

                const updatedData = {
                    address: {
                        ...currentLead.address,
                        full_address: address,
                        lat: newLat,
                        lng: newLng
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

    const initializePage = async () => {
        await fetchLeadData();
        // We can only add the listener after we're sure the lead data has been fetched
        // and the button is on the page.
        const deleteBtn = document.getElementById('delete-lead-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDeleteLead);
        }

        const adjustPinBtn = document.getElementById('adjust-pin-btn');
        if (adjustPinBtn) {
            adjustPinBtn.addEventListener('click', handleAdjustPin);
        }
    };

    initializePage();
});
