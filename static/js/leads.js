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

    // --- DOM Elements ---
    const kanbanBoard = document.getElementById('kanban-board');
    const searchInput = document.getElementById('lead-search-input');
    const showSnoozedCheckbox = document.getElementById('show-snoozed-checkbox');
    const addLeadFab = document.getElementById('add-lead-fab');
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');

    // --- App State ---
    let allLeads = [];
    let statuses = [];
    let dragScrollInterval = null;

    // --- Drag and Drop Handlers ---
    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.leadId);
        setTimeout(() => e.target.classList.add('dragging'), 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        stopDragScroll();
    }

    // --- Snooze Functionality ---
    const snoozeModal = document.getElementById('snooze-modal');
    const snoozeDaysInput = document.getElementById('snooze-days');
    const snoozeDateInput = document.getElementById('snooze-date');
    const confirmSnoozeBtn = document.getElementById('confirm-snooze-btn');
    const cancelSnoozeBtn = document.getElementById('cancel-snooze-modal');
    let currentSnoozeLeadId = null;

    const openSnoozeModal = (leadId) => {
        currentSnoozeLeadId = leadId;
        snoozeDaysInput.value = '';
        snoozeDateInput.value = '';
        snoozeModal.style.display = 'flex';
    };

    const closeSnoozeModal = () => {
        snoozeModal.style.display = 'none';
    };

    const handleSnooze = (leadId) => {
        openSnoozeModal(leadId);
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
            const response = await fetch(`/api/leads/${currentSnoozeLeadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snooze_until: snoozeUntil.toISOString().split('T')[0] }),
            });
            if (response.ok) {
                showToast('Lead snoozed!');
                await loadLeadsAndRender();
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

    confirmSnoozeBtn.addEventListener('click', confirmSnooze);
    cancelSnoozeBtn.addEventListener('click', closeSnoozeModal);

    // --- Lead Card Creation ---
    const createLeadCard = (lead) => {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.draggable = true;
        card.dataset.leadId = lead.id;

        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
        const lastNote = lead.notes && lead.notes.length > 0 ? `<p class="notes">"${lead.notes[lead.notes.length - 1].text}"</p>` : '';
        const viewOnMapHref = (lead.address && lead.address.lat) ? `/?lat=${lead.address.lat}&lng=${lead.address.lng}&zoom=18` : '#';
        const viewOnMapDisabled = !(lead.address && lead.address.lat) ? 'disabled' : '';

        let snoozeInfo = '';
        if (lead.snooze_until && new Date(lead.snooze_until) > new Date()) {
            const snoozeDate = new Date(lead.snooze_until).toLocaleDateString();
            snoozeInfo = `<p class="snooze-info">Snoozed until ${snoozeDate}</p>`;
        }

        card.innerHTML = `
            <h4>${fullName}</h4>
            <p>${lead.address?.full_address || 'No address'}</p>
            ${lastNote}
            ${snoozeInfo}
            <div class="lead-card-actions">
                <a href="${viewOnMapHref}" class="card-action-btn" ${viewOnMapDisabled} title="View on Map">🗺️</a>
                <button class="card-action-btn snooze-btn" title="Snooze Lead">💤</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-action-btn')) {
                e.stopPropagation();
                return;
            }
            window.location.href = `/leads/${lead.id}`;
        });

        card.querySelector('.snooze-btn').addEventListener('click', () => handleSnooze(lead.id));
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        return card;
    };

    // --- Rendering ---
    const renderLeads = () => {
        const query = searchInput.value.toLowerCase();
        const showSnoozed = showSnoozedCheckbox.checked;
        const now = new Date();

        const filteredLeads = allLeads.filter(lead => {
            const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
            const searchMatch = (fullName.includes(query) ||
                                 lead.phone?.toLowerCase().includes(query) ||
                                 lead.address?.full_address?.toLowerCase().includes(query));

            const isSnoozed = lead.snooze_until && new Date(lead.snooze_until) > now;
            const snoozeMatch = showSnoozed || !isSnoozed;

            return searchMatch && snoozeMatch;
        });

        document.querySelectorAll('.kanban-column').forEach(column => {
            column.querySelectorAll('.lead-card').forEach(card => card.remove());
        });

        filteredLeads.forEach(lead => {
            const column = document.querySelector(`.kanban-column[data-status="${lead.status}"]`);
            if (column) {
                const card = createLeadCard(lead);
                column.appendChild(card);
            }
        });
    };

    const loadLeadsAndRender = async () => {
        try {
            const response = await fetch('/api/leads');
            allLeads = await response.json();
            renderLeads();
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    // --- Kanban Board and Drag/Drop ---
    const startDragScroll = (e) => {
        stopDragScroll(); // Ensure no multiple intervals
        dragScrollInterval = setInterval(() => {
            const x = e.clientX;
            const width = window.innerWidth;
            const scrollSpeed = 15;
            const edgeSize = 50; // pixels from edge

            if (x < edgeSize) {
                kanbanBoard.scrollLeft -= scrollSpeed;
            } else if (x > width - edgeSize) {
                kanbanBoard.scrollLeft += scrollSpeed;
            }
        }, 16); // ~60fps
    };

    const stopDragScroll = () => {
        clearInterval(dragScrollInterval);
    };

    const buildKanbanBoard = () => {
        kanbanBoard.innerHTML = ''; // Clear previous board
        statuses.forEach(status => {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.dataset.status = status;
            column.innerHTML = `<h3>${status}</h3>`;

            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingCard = document.querySelector('.dragging');
                if (draggingCard) column.appendChild(draggingCard);
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;

                try {
                    const response = await fetch(`/api/leads/${leadId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus }),
                    });
                    if (response.ok) {
                        const updatedLead = await response.json();
                        const leadIndex = allLeads.findIndex(l => l.id === leadId);
                        if (leadIndex > -1) allLeads[leadIndex] = updatedLead;
                        showToast('Status updated!');
                    } else {
                        showToast('Failed to update status.', 'error');
                        renderLeads(); // Re-render to revert visual change
                    }
                } catch (error) {
                    console.error('Error updating status:', error);
                    showToast('An error occurred.', 'error');
                    renderLeads();
                }
            });
            kanbanBoard.appendChild(column);
        });
    };

    // --- Add Lead Modal ---
    const openAddModal = () => addModal.style.display = 'flex';
    const closeAddModal = () => addModal.style.display = 'none';

    const handleAddAddressInput = (e) => {
        fetchAddressSuggestions(e.target.value, (suggestions) => {
            const suggestionsContainer = document.getElementById('address-suggestions');
            suggestionsContainer.innerHTML = '';
            suggestions.forEach(place => {
                const div = document.createElement('div');
                div.textContent = place.displayName;
                div.className = 'suggestion-item';
                div.addEventListener('click', () => {
                    document.getElementById('add-address').value = place.displayName;
                    document.getElementById('add-lat').value = place.lat;
                    document.getElementById('add-lng').value = place.lng;
                    suggestionsContainer.innerHTML = '';
                });
                suggestionsContainer.appendChild(div);
            });
        });
    };

    const handleAddFormSubmit = async (e) => {
        e.preventDefault();
        const newLead = {
            first_name: document.getElementById('add-first-name').value,
            last_name: document.getElementById('add-last-name').value,
            phone: document.getElementById('add-phone').value,
            address: {
                lat: parseFloat(document.getElementById('add-lat').value),
                lng: parseFloat(document.getElementById('add-lng').value),
                full_address: document.getElementById('add-address').value
            }
        };

        if (!newLead.address.lat || !newLead.address.lng) {
            showToast('Please select a valid address from the suggestions.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLead),
            });
            if (response.ok) {
                closeAddModal();
                addForm.reset();
                await loadLeadsAndRender();
                showToast('Lead created successfully!');
            } else {
                showToast('Failed to create lead.', 'error');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
            showToast('An error occurred.', 'error');
        }
    };

    // --- Initialization ---
    const initializeKanban = async () => {
        try {
            const response = await fetch('/api/statuses');
            if (!response.ok) throw new Error('Failed to fetch statuses');
            statuses = await response.json();
            buildKanbanBoard();
            await loadLeadsAndRender();

            // Event Listeners
            searchInput.addEventListener('input', renderLeads);
            showSnoozedCheckbox.addEventListener('change', renderLeads);
            addLeadFab.addEventListener('click', openAddModal);
            document.getElementById('cancel-add-modal').addEventListener('click', closeAddModal);
            document.getElementById('add-address').addEventListener('input', handleAddAddressInput);
            addForm.addEventListener('submit', handleAddFormSubmit);
            kanbanBoard.addEventListener('dragover', startDragScroll);

            // Hide address suggestions when clicking outside
            document.addEventListener('click', (e) => {
                const suggestionsContainer = document.getElementById('address-suggestions');
                const addressInput = document.getElementById('add-address');
                if (suggestionsContainer && !addressInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    suggestionsContainer.innerHTML = '';
                }
            });

        } catch (error) {
            console.error('Error initializing Kanban board:', error);
            kanbanBoard.innerHTML = '<p>Error loading board.</p>';
        }
    };

    initializeKanban();
});

// --- Dynamic Styles ---
const style = document.createElement('style');
style.innerHTML = `
    .lead-card {
        background-color: white; border-radius: 4px; padding: 0.8rem;
        margin-bottom: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: grab;
    }
    .lead-card h4 { margin: 0 0 0.5rem 0; }
    .lead-card p { margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #555; }
    .lead-card .notes { font-style: italic; color: #777; }
    .lead-card .snooze-info { font-size: 0.8rem; color: #6c757d; font-style: italic; margin-bottom: 0.5rem; }
    .lead-card.dragging { opacity: 0.5; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
    .lead-card-actions { margin-top: 0.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; }
    .card-action-btn {
        background: #f0f0f0; border: 1px solid #ddd; border-radius: 50%;
        width: 30px; height: 30px; display: inline-flex; align-items: center;
        justify-content: center; text-decoration: none; color: #333; cursor: pointer;
    }
    .card-action-btn:hover { background: #e9e9e9; }
    .card-action-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .funnel-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
`;
document.head.appendChild(style);
