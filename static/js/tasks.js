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
    const taskSearchInput = document.getElementById('task-search-input');
    const taskFilterSelect = document.getElementById('task-filter-select');
    const showCompletedCheckbox = document.getElementById('show-completed-tasks-checkbox');
    const taskList = document.querySelector('.task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDetailsInput = document.getElementById('task-details');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskLeadSearchInput = document.getElementById('task-lead-search');
    const taskLeadIdInput = document.getElementById('task-lead-id');
    const leadSuggestionsEl = document.getElementById('lead-suggestions');

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
        const showCompleted = showCompletedCheckbox.checked;

        let filteredTasks = allTasks.filter(task => {
            if (!showCompleted && task.completed) {
                return false;
            }

            const leadName = getLeadName(task.lead_id).toLowerCase();
            const searchMatch = (
                task.title.toLowerCase().includes(query) ||
                (task.details && task.details.toLowerCase().includes(query)) ||
                leadName.includes(query)
            );

            if (!searchMatch) return false;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            switch (filter) {
                case 'due_today':
                    if (!task.due_date) return false;
                    const dueDate = new Date(task.due_date);
                    dueDate.setDate(dueDate.getDate() + 1);
                    return dueDate.toDateString() === today.toDateString();
                case 'overdue':
                    if (!task.due_date || task.completed) return false;
                    return new Date(task.due_date) < today;
                case 'all_tasks':
                    return true; // No additional filtering
                case 'all': // "All Active"
                default:
                    return !task.completed;
            }
        });

        // Sort tasks by due date by default, putting tasks without a due date at the end
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            const dateA = a.due_date ? new Date(a.due_date) : null;
            const dateB = b.due_date ? new Date(b.due_date) : null;
            if (dateA && dateB) {
                return dateA - dateB;
            }
            if (dateA) return -1; // a has date, b doesn't
            if (dateB) return 1;  // b has date, a doesn't
            return 0; // both have no date
        });


        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<p class="text-center text-muted">No tasks match the current filters.</p>';
        }

        filteredTasks.forEach(task => {
            const taskElement = document.createElement('div');
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
            taskElement.className = `task-item list-group-item d-flex justify-content-between align-items-center ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
            taskElement.dataset.taskId = task.id;

            let dueDateStr = 'No due date';
            let dueDateClass = 'text-muted';
            if (task.due_date) {
                const dueDate = new Date(task.due_date);
                dueDate.setDate(dueDate.getDate() + 1);
                dueDateStr = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                if (isOverdue) {
                    dueDateClass = 'text-danger fw-bold';
                }
            }

            const leadName = getLeadName(task.lead_id);

            taskElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <input class="form-check-input task-completed-checkbox me-3" type="checkbox" ${task.completed ? 'checked' : ''} id="task-${task.id}">
                    <div>
                        <h6 class="mb-0 task-title">${task.title}</h6>
                        <small class="task-lead">
                            <a href="/leads/${task.lead_id}" class="text-decoration-none">${leadName}</a>
                        </small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <small class="task-due-date me-3 ${dueDateClass}">${dueDateStr}</small>
                    <div class="task-actions">
                        <button class="btn btn-sm btn-outline-secondary edit-task-btn"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn btn-sm btn-outline-danger delete-task-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `;
            taskList.appendChild(taskElement);
        });
    };

    const handleLeadSearch = (e) => {
        const query = e.target.value.toLowerCase();
        leadSuggestionsEl.innerHTML = '';
        if (!query) {
            taskLeadIdInput.value = ''; // Clear hidden input if search is cleared
            return;
        }

        const matchingLeads = allLeads.filter(lead => {
            const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
            return fullName.includes(query) ||
                   lead.phone?.toLowerCase().includes(query) ||
                   lead.address?.full_address?.toLowerCase().includes(query);
        });

        matchingLeads.slice(0, 5).forEach(lead => {
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action';
            div.textContent = `${lead.first_name} ${lead.last_name} - ${lead.address.full_address}`;
            div.addEventListener('click', () => {
                taskLeadSearchInput.value = `${lead.first_name} ${lead.last_name}`;
                taskLeadIdInput.value = lead.id;
                leadSuggestionsEl.innerHTML = '';
            });
            leadSuggestionsEl.appendChild(div);
        });
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        const newTask = {
            title: taskTitleInput.value,
            details: taskDetailsInput.value,
            due_date: taskDueDateInput.value || null,
            lead_id: taskLeadIdInput.value || null,
        };

        if (!newTask.title) {
            showToast('Task title is required.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask),
            });
            if (response.ok) {
                showToast('Task added successfully!');
                addTaskForm.reset();
                taskLeadIdInput.value = ''; // Clear hidden field
                await fetchTasks(); // Refresh the list
            } else {
                showToast('Failed to add task.', 'error');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            showToast('An error occurred while adding the task.', 'error');
        }
    };

    const renderTaskEditView = (taskElement, task) => {
        // Simple and safe way to create the form elements
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'form-control mb-2 edit-task-title';
        titleInput.value = task.title;

        const detailsTextarea = document.createElement('textarea');
        detailsTextarea.className = 'form-control mb-2 edit-task-details';
        detailsTextarea.rows = 2;
        detailsTextarea.value = task.details || '';

        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';
        dueDateInput.className = 'form-control edit-task-due-date';
        dueDateInput.value = task.due_date ? task.due_date.split('T')[0] : '';

        // Replace view elements with inputs
        taskElement.querySelector('.task-title').replaceWith(titleInput);
        taskElement.querySelector('.task-details').replaceWith(detailsTextarea);
        taskElement.querySelector('.task-due-date').replaceWith(dueDateInput);

        // Change buttons to Save/Cancel
        const actionsContainer = taskElement.querySelector('.task-actions');
        actionsContainer.innerHTML = `
            <button class="btn btn-sm btn-success save-task-btn">Save</button>
            <button class="btn btn-sm btn-secondary cancel-edit-btn">Cancel</button>
        `;
    };

    const initializeTasksPage = async () => {
        await fetchLeads();
        await fetchTasks();
        taskSearchInput.addEventListener('input', renderTasks);
        taskFilterSelect.addEventListener('change', renderTasks);
        showCompletedCheckbox.addEventListener('change', renderTasks);
        taskLeadSearchInput.addEventListener('input', handleLeadSearch);
        addTaskForm.addEventListener('submit', handleAddTask);

        // --- Main Event Listener for Task List ---
        taskList.addEventListener('click', async (e) => {
            const taskElement = e.target.closest('.task-item');
            if (!taskElement) return;
            const taskId = taskElement.dataset.taskId;

            // Handle Checkbox Change
            if (e.target.classList.contains('task-completed-checkbox')) {
                const completed = e.target.checked;
                try {
                    const response = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed }),
                    });
                    if (!response.ok) throw new Error('Failed to update task');
                    // Update local data to prevent full re-render
                    const task = allTasks.find(t => t.id === taskId);
                    if(task) task.completed = completed;
                } catch (error) {
                    console.error('Error updating task completion:', error);
                    showToast('Failed to update task.', 'error');
                }
                return;
            }

            // Handle Edit Button
            if (e.target.classList.contains('edit-task-btn')) {
                const task = allTasks.find(t => t.id === taskId);
                if (task) renderTaskEditView(taskElement, task);
                return;
            }

            // Handle Cancel Button
            if (e.target.classList.contains('cancel-edit-btn')) {
                renderTasks(); // Simple way to revert is to re-render all
                return;
            }

            // Handle Delete Button
            if (e.target.classList.contains('delete-task-btn')) {
                if (confirm('Are you sure you want to delete this task?')) {
                    try {
                        const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
                        if (response.ok) {
                            showToast('Task deleted.');
                            fetchTasks(); // Refresh list
                        } else {
                            showToast('Failed to delete task.', 'error');
                        }
                    } catch (error) {
                        console.error('Error deleting task:', error);
                        showToast('An error occurred while deleting.', 'error');
                    }
                }
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
                        await fetchTasks(); // Refresh list
                    } else {
                        showToast('Failed to update task.', 'error');
                    }
                } catch (error) {
                    console.error('Error saving task:', error);
                    showToast('An error occurred while saving.', 'error');
                }
            }
        });
    };

    initializeTasksPage();
});
