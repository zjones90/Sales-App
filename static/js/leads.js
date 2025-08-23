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
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const addLeadFab = document.getElementById('add-lead-fab');
    const addModalEl = document.getElementById('add-modal');
    const addModal = new bootstrap.Modal(addModalEl);
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
    const snoozeModalEl = document.getElementById('snooze-modal');
    const snoozeModal = new bootstrap.Modal(snoozeModalEl);
    const snoozeDaysInput = document.getElementById('snooze-days');
    const snoozeDateInput = document.getElementById('snooze-date');
    const confirmSnoozeBtn = document.getElementById('confirm-snooze-btn');
    let currentSnoozeLeadId = null;

    const openSnoozeModal = (leadId) => {
        currentSnoozeLeadId = leadId;
        snoozeDaysInput.value = '';
        snoozeDateInput.value = '';
        snoozeModal.show();
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
            snoozeModal.hide();
        }
    };

    confirmSnoozeBtn.addEventListener('click', confirmSnooze);

    // --- Lead Card Creation ---
    const createLeadCard = (lead) => {
        const card = document.createElement('div');
        card.className = 'lead-card card';
        card.draggable = true;
        card.dataset.leadId = lead.id;

        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
        const lastNote = lead.notes && lead.notes.length > 0 ? `<p class="notes card-text">"${lead.notes[lead.notes.length - 1].text}"</p>` : '';
        const viewOnMapHref = (lead.address && lead.address.lat) ? `/?lat=${lead.address.lat}&lng=${lead.address.lng}&zoom=18` : '#';
        const viewOnMapDisabled = !(lead.address && lead.address.lat) ? 'disabled' : '';

        let snoozeInfo = '';
        if (lead.snooze_until && new Date(lead.snooze_until) > new Date()) {
            const snoozeDate = new Date(lead.snooze_until).toLocaleString();
            snoozeInfo = `<p class="snooze-info card-text text-muted">Snoozed until ${snoozeDate}</p>`;
        }

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${fullName}</h5>
                <p class="card-text">${lead.address?.full_address || 'No address'}</p>
                ${lastNote}
                ${snoozeInfo}
                <div class="lead-card-actions">
                    <a href="${viewOnMapHref}" class="btn btn-sm btn-outline-primary" ${viewOnMapDisabled} title="View on Map"><i class="fas fa-map-marker-alt"></i></a>
                    <button class="btn btn-sm btn-outline-secondary snooze-btn" title="Snooze Lead"><i class="fas fa-clock"></i></button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn')) {
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
        const startDate = startDateFilter.value;
        const endDate = endDateFilter.value;
        const now = new Date();

        const filteredLeads = allLeads.filter(lead => {
            const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
            const searchMatch = (fullName.includes(query) ||
                                 lead.phone?.toLowerCase().includes(query) ||
                                 lead.address?.full_address?.toLowerCase().includes(query));

            const isSnoozed = lead.snooze_until && new Date(lead.snooze_until) > now;
            const snoozeMatch = showSnoozed || !isSnoozed;

            let dateMatch = true;
            if (lead.created_at) {
                const leadDate = new Date(lead.created_at);
                if (startDate && leadDate < new Date(startDate)) {
                    dateMatch = false;
                }
                // Add one day to the end date to include the entire day
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setDate(endDateTime.getDate() + 1);
                    if (leadDate > endDateTime) {
                        dateMatch = false;
                    }
                }
            } else if (startDate || endDate) {
                dateMatch = false; // Exclude leads without a created_at date if filtering by date
            }

            return searchMatch && snoozeMatch && dateMatch;
        });

        // Clear all cards and update counts
        document.querySelectorAll('.kanban-column').forEach(column => {
            column.querySelectorAll('.lead-card').forEach(card => card.remove());
            const leadCountEl = column.querySelector('.lead-count');
            if (leadCountEl) {
                leadCountEl.textContent = '0';
            }
        });

        let firstResultColumn = null;

        filteredLeads.forEach(lead => {
            const column = document.querySelector(`.kanban-column[data-status="${lead.status}"]`);
            if (column) {
                if (!firstResultColumn) {
                    firstResultColumn = column;
                }
                const card = createLeadCard(lead);
                column.appendChild(card);
            }
        });

        // Recalculate and display the count of visible cards in each column
        document.querySelectorAll('.kanban-column').forEach(column => {
            const count = column.querySelectorAll('.lead-card').length;
            const leadCountEl = column.querySelector('.lead-count');
            if (leadCountEl) {
                leadCountEl.textContent = count;
            }
        });

        // Only scroll if there's a search query
        if (query && firstResultColumn) {
            if (firstResultColumn.classList.contains('collapsed')) {
                firstResultColumn.classList.remove('collapsed');
            }
            firstResultColumn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
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

            const header = document.createElement('h3');
            header.innerHTML = `<span class="column-title">${status}</span> <span class="lead-count"></span>`;
            header.addEventListener('click', () => {
                column.classList.toggle('collapsed');
                // After collapsing/expanding, the board might need to be re-rendered
                // if some visual logic depends on the collapsed state, but for now it's fine.
            });

            column.appendChild(header);

            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                // Prevent dropping on a collapsed column
                if (column.classList.contains('collapsed')) return;
                const draggingCard = document.querySelector('.dragging');
                if (draggingCard) column.appendChild(draggingCard);
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (column.classList.contains('collapsed')) return;

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
    const handleAddAddressInput = (e) => {
        fetchAddressSuggestions(e.target.value, (suggestions) => {
            const suggestionsContainer = document.getElementById('address-suggestions');
            suggestionsContainer.innerHTML = '';
            suggestions.forEach(place => {
                const div = document.createElement('div');
                div.textContent = place.displayName;
                div.className = 'suggestion-item list-group-item list-group-item-action';
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
                addModal.hide();
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
            startDateFilter.addEventListener('change', renderLeads);
            endDateFilter.addEventListener('change', renderLeads);
            addLeadFab.addEventListener('click', () => addModal.show());
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
