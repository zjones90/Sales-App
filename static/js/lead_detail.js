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
    const leadSourceSelect = document.getElementById('lead-source');
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
    const hotLeadToggleButton = document.getElementById('hot-lead-toggle-btn');

    // --- Snooze Functionality ---
    const snoozeModalEl = document.getElementById('snooze-modal');
    const snoozeModal = new bootstrap.Modal(snoozeModalEl);
    const snoozeDaysInput = document.getElementById('snooze-days');
    const snoozeDateInput = document.getElementById('snooze-date');
    const confirmSnoozeBtn = document.getElementById('confirm-snooze-btn');

    const openSnoozeModal = () => {
        snoozeDaysInput.value = '';
        snoozeDateInput.value = '';
        snoozeModal.show();
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
            snoozeModal.hide();
        }
    };

    const toggleHotLead = async () => {
        if (!currentLead) return;

        const newHotStatus = !currentLead.is_hot;

        try {
            const response = await fetch(`/api/leads/${LEAD_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_hot: newHotStatus }),
            });

            if (response.ok) {
                currentLead = await response.json();
                renderLeadData(); // Re-render to update button style
                showToast(`Lead marked as ${newHotStatus ? 'hot' : 'not hot'}.`);
            } else {
                showToast('Failed to update hot status.', 'error');
            }
        } catch (error) {
            console.error('Error toggling hot lead:', error);
            showToast('An error occurred while updating.', 'error');
        }
    };

    let currentLead = null;
    let statuses = [];
    let leadTasks = [];
    // Default to hiding completed tasks, load user preference from localStorage
    let showCompletedTasks = localStorage.getItem('showCompletedTasks') === 'true';

    const tasksListEl = document.getElementById('tasks-list');
    const addTaskForm = document.getElementById('add-task-form');
    const taskTitleInput = document.getElementById('task-title');


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
        leadSourceSelect.value = currentLead.source || 'Other';

        // Display formatted created_at date
        const createdAtDateEl = leadCreatedAtEl.querySelector('span');
        if (currentLead.created_at) {
            const date = new Date(currentLead.created_at);
            createdAtDateEl.textContent = date.toLocaleDateString();
        } else {
            createdAtDateEl.textContent = 'N/A';
        }

        // Display snooze status
        const snoozeStatusContainer = document.getElementById('snooze-status-container');
        const snoozeStatusText = document.getElementById('snooze-status-text');
        if (currentLead.snooze_until && new Date(currentLead.snooze_until) > new Date()) {
            const snoozeDate = new Date(currentLead.snooze_until);
            // Add one day to the date to display correctly
            snoozeDate.setDate(snoozeDate.getDate() + 1);
            snoozeStatusText.textContent = `Snoozed until ${snoozeDate.toLocaleDateString()}`;
            snoozeStatusContainer.style.display = 'block';
        } else {
            snoozeStatusContainer.style.display = 'none';
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

        // Set up Get Directions link
        const getDirectionsBtn = document.getElementById('get-directions-btn');
        if (getDirectionsBtn && currentLead.address && currentLead.address.lat && currentLead.address.lng) {
            getDirectionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${currentLead.address.lat},${currentLead.address.lng}`;
            getDirectionsBtn.style.display = 'inline-block';
        } else if (getDirectionsBtn) {
            getDirectionsBtn.style.display = 'none';
        }

        // Style hot lead button
        if (currentLead.is_hot) {
            hotLeadToggleButton.classList.add('btn-danger');
            hotLeadToggleButton.classList.remove('btn-outline-secondary');
        } else {
            hotLeadToggleButton.classList.remove('btn-danger');
            hotLeadToggleButton.classList.add('btn-outline-secondary');
        }

        // Render notes
        notesListEl.innerHTML = '';
        if (currentLead.notes && Array.isArray(currentLead.notes)) {
            currentLead.notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(note => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.dataset.noteId = note.id;

                const noteDate = new Date(note.timestamp).toLocaleString();
                const attachmentLink = note.attachment
                    ? `<div class="mt-2"><a href="${note.attachment}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="fas fa-paperclip"></i> View Attachment</a></div>`
                    : '';

                li.innerHTML = `
                    <div class="note-bubble">
                        <div class="note-actions">
                            <button class="btn btn-sm btn-outline-secondary edit-note-btn"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-note-btn"><i class="fas fa-trash-alt"></i></button>
                        </div>
                        <p>${note.text}</p>
                        ${attachmentLink}
                        <div class="note-meta">
                            <span>${noteDate}</span>
                        </div>
                    </div>
                `;
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
            source: leadSourceSelect.value,
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
    const fetchLeadTasks = async () => {
        try {
            const response = await fetch(`/api/leads/${LEAD_ID}/tasks`);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            leadTasks = await response.json();
            renderLeadTasks();
        } catch (error) {
            console.error('Error fetching lead tasks:', error);
        }
    };

    const renderLeadTasks = () => {
        tasksListEl.innerHTML = '';
        const toggleBtn = document.getElementById('toggle-completed-tasks-btn');

        // Update button icon based on state
        toggleBtn.innerHTML = showCompletedTasks ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';

        const tasksToRender = showCompletedTasks ? leadTasks : leadTasks.filter(task => !task.completed);

        tasksToRender.forEach(task => {
            const li = document.createElement('li');
            li.className = 'list-group-item task-item task-list-item';
            li.dataset.taskId = task.id;
            li.innerHTML = `
                <div class="d-flex align-items-center">
                    <input type="checkbox" class="form-check-input me-2" ${task.completed ? 'checked' : ''}>
                    <span>${task.title}</span>
                </div>
                <div class="task-actions">
                    <button class="edit-task-btn btn btn-sm task-action-btn" title="Edit Task"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-task-btn btn btn-sm task-action-btn" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            tasksListEl.appendChild(li);
        });
    };

    const renderTaskEditView = (taskElement, task) => {
        taskElement.innerHTML = `
            <div class="edit-task-view w-100">
                <input type="text" class="form-control mb-2 edit-task-title" value="${task.title}">
                <textarea class="form-control mb-2 edit-task-details" rows="2">${task.details || ''}</textarea>
                <input type="date" class="form-control mb-2 edit-task-due-date" value="${task.due_date ? task.due_date.split('T')[0] : ''}">
                <div class="d-flex justify-content-end">
                    <button class="btn btn-sm btn-secondary cancel-edit-task-btn me-2">Cancel</button>
                    <button class="btn btn-sm btn-success save-task-btn">Save</button>
                </div>
            </div>
        `;
    };

    const handleAddLeadTask = async (e) => {
        e.preventDefault();
        const title = taskTitleInput.value.trim();
        if (!title) return;

        const newTask = {
            title,
            lead_id: LEAD_ID,
        };

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask),
            });
            if (response.ok) {
                await fetchLeadTasks();
                taskTitleInput.value = '';
            } else {
                showToast('Failed to add task.', 'error');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            showToast('An error occurred while adding the task.', 'error');
        }
    };

    const initializePage = async () => {
        // Fetch statuses first, then lead data
        await fetchStatuses();
        await fetchLeadData();
        await fetchLeadTasks();

        // Add event listeners after data is loaded and elements are ready
        addNoteForm.addEventListener('submit', handleAddNote);
        leadForm.addEventListener('submit', handleUpdateLead);
        deleteBtn.addEventListener('click', handleDeleteLead);
        adjustPinBtn.addEventListener('click', handleAdjustPin);
        snoozeLeadBtn.addEventListener('click', openSnoozeModal);
        confirmSnoozeBtn.addEventListener('click', confirmSnooze);
        addTaskForm.addEventListener('submit', handleAddLeadTask);
        hotLeadToggleButton.addEventListener('click', toggleHotLead);

        document.getElementById('toggle-completed-tasks-btn').addEventListener('click', () => {
            showCompletedTasks = !showCompletedTasks;
            localStorage.setItem('showCompletedTasks', showCompletedTasks);
            renderLeadTasks();
        });

        tasksListEl.addEventListener('click', async (e) => {
            const taskElement = e.target.closest('.task-item');
            if (!taskElement) return;
            const taskId = taskElement.dataset.taskId;

            // Handle Checkbox Toggle
            if (e.target.matches('input[type="checkbox"]')) {
                const completed = e.target.checked;
                try {
                    const response = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed }),
                    });
                    if (!response.ok) throw new Error('Failed to update task');
                    const task = leadTasks.find(t => t.id === taskId);
                    if (task) task.completed = completed;
                    // Re-render if we are hiding completed tasks
                    if (!showCompletedTasks) renderLeadTasks();
                } catch (error) {
                    console.error('Error updating task status:', error);
                    showToast('Failed to update task.', 'error');
                }
                return;
            }

            // Handle Edit Button
            if (e.target.classList.contains('edit-task-btn')) {
                const task = leadTasks.find(t => t.id === taskId);
                if(task) renderTaskEditView(taskElement, task);
                return;
            }

            // Handle Cancel Edit
            if (e.target.classList.contains('cancel-edit-task-btn')) {
                renderLeadTasks();
                return;
            }

            // Handle Save Button
            if (e.target.classList.contains('save-task-btn')) {
                const updatedData = {
                    title: taskElement.querySelector('.edit-task-title').value,
                    details: taskElement.querySelector('.edit-task-details').value,
                    due_date: taskElement.querySelector('.edit-task-due-date').value || null,
                };

                try {
                    const response = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData)
                    });
                    if (response.ok) {
                        showToast('Task updated!');
                        await fetchLeadTasks();
                    } else {
                        showToast('Failed to update task.', 'error');
                    }
                } catch (error) {
                    console.error('Error saving task:', error);
                    showToast('An error occurred while saving.', 'error');
                }
                return;
            }

            // Handle Delete Button
            if (e.target.classList.contains('delete-task-btn')) {
                if (confirm('Are you sure you want to delete this task?')) {
                    try {
                        const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
                        if (response.ok) {
                            showToast('Task deleted.');
                            await fetchLeadTasks();
                        } else {
                            showToast('Failed to delete task.', 'error');
                        }
                    } catch (error) {
                        console.error('Error deleting task:', error);
                        showToast('An error occurred while deleting.', 'error');
                    }
                }
            }
        });

        leadAddressInput.addEventListener('input', (e) => {
            fetchAddressSuggestions(e.target.value, (suggestions) => {
                const suggestionsContainer = document.getElementById('address-suggestions-detail');
                suggestionsContainer.innerHTML = '';
                suggestions.forEach(place => {
                    const div = document.createElement('div');
                    div.textContent = place.displayName;
                    div.className = 'suggestion-item'; // Make sure this class is styled
                    div.addEventListener('click', () => {
                        leadAddressInput.value = place.displayName;
                        // The lat/lng will be updated when the user clicks "Adjust Pin to Match Address"
                        suggestionsContainer.innerHTML = '';
                    });
                    suggestionsContainer.appendChild(div);
                });
            });
        });

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
