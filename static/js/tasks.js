document.addEventListener('DOMContentLoaded', () => {
    const taskSearchInput = document.getElementById('task-search-input');
    const taskFilterSelect = document.getElementById('task-filter-select');
    const taskList = document.querySelector('.task-list');

    let allTasks = [];
    let allLeads = [];

    const fetchTasks = async () => {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) throw new Error('Failed to fetch tasks');
            allTasks = await response.json();
            renderTasks();
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const fetchLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) throw new Error('Failed to fetch leads');
            allLeads = await response.json();
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    };

    const getLeadName = (leadId) => {
        const lead = allLeads.find(l => l.id === leadId);
        return lead ? `${lead.first_name} ${lead.last_name}` : 'N/A';
    };

    const renderTasks = () => {
        taskList.innerHTML = '';
        const query = taskSearchInput.value.toLowerCase();
        const filter = taskFilterSelect.value;

        let filteredTasks = allTasks.filter(task => {
            const leadName = getLeadName(task.lead_id).toLowerCase();
            const searchMatch = (
                task.title.toLowerCase().includes(query) ||
                task.details.toLowerCase().includes(query) ||
                leadName.includes(query)
            );

            if (!searchMatch) return false;

            switch (filter) {
                case 'due_date':
                    return !!task.due_date;
                case 'no_due_date':
                    return !task.due_date;
                case 'created_at':
                    return true;
                default:
                    return true;
            }
        });

        if (filter === 'due_date') {
            filteredTasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        } else if (filter === 'created_at') {
            filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        filteredTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'card task-item mb-3';
            taskElement.innerHTML = `
                <div class="card-body">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${task.title}</h5>
                        <small>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</small>
                    </div>
                    <p class="mb-1">${task.details}</p>
                    <small>Lead: ${getLeadName(task.lead_id)}</small>
                    <div class="form-check mt-2">
                        <input class="form-check-input" type="checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" id="task-${task.id}">
                        <label class="form-check-label" for="task-${task.id}">
                            Completed
                        </label>
                    </div>
                </div>
            `;
            taskList.appendChild(taskElement);

            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', async (e) => {
                const taskId = e.target.dataset.taskId;
                const completed = e.target.checked;
                try {
                    const response = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed }),
                    });
                    if (!response.ok) throw new Error('Failed to update task');
                } catch (error) {
                    console.error('Error updating task:', error);
                }
            });
        });
    };

    const initializeTasksPage = async () => {
        await fetchLeads();
        await fetchTasks();
        taskSearchInput.addEventListener('input', renderTasks);
        taskFilterSelect.addEventListener('change', renderTasks);
    };

    initializeTasksPage();
});
