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

    const kanbanBoard = document.getElementById('kanban-board');

    // --- Drag and Drop Event Handlers ---
    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.leadId);
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    // Function to create a lead card element
    const createLeadCard = (lead) => {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.draggable = true;
        card.dataset.leadId = lead.id;

        const phoneHtml = lead.phone
            ? `<a href="tel:${lead.phone}" class="lead-phone-link">${lead.phone}</a>`
            : '<p>No phone</p>';

        const lastNote = lead.notes && lead.notes.length > 0
            ? `<p class="notes">"${lead.notes[lead.notes.length - 1]}"</p>`
            : '';

        card.innerHTML = `
            <h4>${lead.name}</h4>
            ${phoneHtml}
            ${lastNote}
        `;

        card.addEventListener('click', (e) => {
            // Don't navigate if a link was clicked
            if (e.target.tagName.toLowerCase() === 'a') {
                e.stopPropagation();
                return;
            }
            window.location.href = `/leads/${lead.id}`;
        });

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        return card;
    };

    let allLeads = []; // To store all leads fetched from the server
    const searchInput = document.getElementById('lead-search-input');

    // Function to render leads based on a filter
    const renderLeads = (leadsToRender) => {
        // Clear existing cards from all columns
        document.querySelectorAll('.kanban-column').forEach(column => {
            // Get all children that are lead cards and remove them
            const cards = column.querySelectorAll('.lead-card');
            cards.forEach(card => card.remove());
        });

        leadsToRender.forEach(lead => {
            const column = document.querySelector(`.kanban-column[data-status="${lead.status}"]`);
            if (column) {
                const card = createLeadCard(lead);
                column.appendChild(card);
            }
        });
    };

    // Function to load and display all leads
    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            allLeads = await response.json(); // Store all leads
            renderLeads(allLeads); // Initial render
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    // Event listener for the search input
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filteredLeads = allLeads.filter(lead => {
            const nameMatch = lead.name && lead.name.toLowerCase().includes(query);
            const phoneMatch = lead.phone && lead.phone.toLowerCase().includes(query);
            const addressMatch = lead.address?.full_address && lead.address.full_address.toLowerCase().includes(query);
            return nameMatch || phoneMatch || addressMatch;
        });
        renderLeads(filteredLeads);
    });

    // Function to build the Kanban board columns from a list of statuses
    const buildKanbanBoard = (statuses) => {
        statuses.forEach(status => {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.dataset.status = status;

            const title = document.createElement('h3');
            title.textContent = status;
            column.appendChild(title);

            // Add drag and drop listeners to the new column
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingCard = document.querySelector('.dragging');
                if (draggingCard) {
                    column.appendChild(draggingCard);
                }
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;
                const draggedCard = document.querySelector(`[data-lead-id="${leadId}"]`);

                if (draggedCard) {
                    column.appendChild(draggedCard);
                }

                try {
                    const response = await fetch(`/api/leads/${leadId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus }),
                    });

                    if (response.ok) {
                        showToast('Status updated!');
                    } else {
                        showToast('Failed to update lead status.', 'error');
                        // Optional: Revert the card to its original column if the API call fails
                    }
                } catch (error) {
                    console.error('Error updating lead status:', error);
                    showToast('An error occurred while updating the lead.', 'error');
                }
            });

            kanbanBoard.appendChild(column);
        });
    };

    // Main function to initialize the app
    const initializeKanban = async () => {
        try {
            const response = await fetch('/api/statuses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const statuses = await response.json();
            buildKanbanBoard(statuses);
            await loadLeads();
        } catch (error) {
            console.error('Error initializing Kanban board:', error);
            kanbanBoard.innerHTML = '<p>Error loading board configuration. Could not fetch statuses.</p>';
        }
    };

    initializeKanban();
});

// Add some specific styles for the cards
const style = document.createElement('style');
style.innerHTML = `
    .lead-card {
        background-color: white;
        border-radius: 4px;
        padding: 0.8rem;
        margin-bottom: 0.8rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        cursor: grab;
    }
    .lead-card h4 {
        margin: 0 0 0.5rem 0;
    }
    .lead-card p, .lead-card a {
        margin: 0;
        font-size: 0.9rem;
        color: #555;
        text-decoration: none;
    }
    .lead-card a:hover {
        text-decoration: underline;
    }
    .lead-card .notes {
        font-style: italic;
        color: #777;
        margin-top: 0.5rem;
    }
    .lead-card.dragging {
        opacity: 0.5;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
`;
document.head.appendChild(style);
