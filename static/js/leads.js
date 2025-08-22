document.addEventListener('DOMContentLoaded', () => {
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

        card.innerHTML = `
            <h4>${lead.name}</h4>
            <p>${lead.phone}</p>
        `;

        card.addEventListener('click', () => {
            window.location.href = `/leads/${lead.id}`;
        });

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        return card;
    };

    // Function to load and display all leads
    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            const leads = await response.json();

            leads.forEach(lead => {
                const column = document.querySelector(`.kanban-column[data-status="${lead.status}"]`);
                if (column) {
                    const card = createLeadCard(lead);
                    column.appendChild(card);
                }
            });
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

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

                    if (!response.ok) {
                        alert('Failed to update lead status.');
                    }
                } catch (error) {
                    console.error('Error updating lead status:', error);
                    alert('An error occurred while updating the lead.');
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
    .lead-card p {
        margin: 0;
        font-size: 0.9rem;
        color: #555;
    }
    .lead-card .notes {
        font-style: italic;
        color: #777;
    }
    .lead-card.dragging {
        opacity: 0.5;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
`;
document.head.appendChild(style);
