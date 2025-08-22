document.addEventListener('DOMContentLoaded', () => {
    const kanbanBoard = document.getElementById('kanban-board');
    const columns = document.querySelectorAll('.kanban-column');

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

        // Make the card clickable to go to the detail page
        card.addEventListener('click', () => {
            window.location.href = `/leads/${lead.id}`;
        });

        // Add drag start and end listeners to the card
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

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            const draggingCard = document.querySelector('.dragging');
            column.appendChild(draggingCard);
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            const leadId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;
            const draggedCard = document.querySelector(`[data-lead-id="${leadId}"]`);

            // Optimistically move the card in the UI
            column.appendChild(draggedCard);

            // Update the lead status on the backend
            try {
                const response = await fetch(`/api/leads/${leadId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: newStatus }),
                });

                if (!response.ok) {
                    // If the update fails, we should ideally move the card back.
                    // For now, we'll just alert the user.
                    alert('Failed to update lead status.');
                    // A more robust solution would reload the board or move the card back to its original column.
                }
            } catch (error) {
                console.error('Error updating lead status:', error);
                alert('An error occurred while updating the lead.');
            }
        });
    });

    // Initial load of leads
    loadLeads();
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
