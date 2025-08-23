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
    const addTaskFab = document.getElementById('add-task-fab');
    const addTaskModalEl = document.getElementById('add-task-modal');
    const addTaskModal = new bootstrap.Modal(addTaskModalEl);
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
            // Filter by search query first
            const leadName = getLeadName(task.lead_id).toLowerCase();
            const searchMatch = (
                task.title.toLowerCase().includes(query) ||
                (task.details && task.details.toLowerCase().includes(query)) ||
                leadName.includes(query)
            );
            if (!searchMatch) return false;

            // Then, apply the main filter from the dropdown
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let filterMatch = false;
            switch (filter) {
                case 'due_today':
                    if (!task.due_date) break;
                    const dueDate = new Date(task.due_date);
                    dueDate.setUTCHours(0,0,0,0);
                    filterMatch = dueDate.toDateString() === today.toDateString();
                    break;
                case 'overdue':
                    filterMatch = task.due_date && !task.completed && new Date(task.due_date) < today;
                    break;
                case 'no_due_date':
                    filterMatch = !task.due_date;
                    break;
                case 'all_tasks':
                    filterMatch = true;
                    break;
                case 'all': // "All Active"
                default:
                    filterMatch = !task.completed;
                    break;
            }

            // Finally, override with "Show Completed" if checked, but not for "All Active"
            if (showCompleted) {
                // If the filter already includes completed tasks, or if the task matches the filter anyway
                if (filter === 'all_tasks' || filterMatch) {
                    return true;
                }
                // If the filter is 'all' (active), and the task is completed, show it
                if (filter === 'all' && task.completed){
                    return true;
                }
            }

            return filterMatch;
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

        // Create a responsive grid
        taskList.className = 'task-list row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4';

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<p class="text-center text-muted">No tasks match the current filters.</p>';
            return; // Exit early
        }

        filteredTasks.forEach(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'col'; // Bootstrap grid column

            const taskCard = document.createElement('div');
            taskCard.className = `task-item card h-100 ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
            taskCard.dataset.taskId = task.id;


            let dueDateStr = 'No due date';
            let dueDateClass = 'text-muted';
            if (task.due_date) {
                const dueDate = new Date(task.due_date);
                 // Fix off-by-one day error by using UTC dates
                dueDate.setUTCHours(0,0,0,0);
                dueDateStr = dueDate.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' });
                if (isOverdue) {
                    dueDateClass = 'text-danger fw-bold';
                }
            }

            const leadName = getLeadName(task.lead_id);
            const leadLink = task.lead_id ? `<a href="/leads/${task.lead_id}" class="text-decoration-none">${leadName}</a>` : 'No associated lead';

            taskCard.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div class="form-check">
                        <input class="form-check-input task-completed-checkbox" type="checkbox" ${task.completed ? 'checked' : ''} id="task-check-${task.id}">
                        <label class="form-check-label" for="task-check-${task.id}">
                            <h6 class="mb-0 task-title">${task.title}</h6>
                        </label>
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-sm btn-link text-secondary edit-task-btn" title="Edit Task"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn btn-sm btn-link text-danger delete-task-btn" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text task-details-clamp">${task.details || 'No details provided.'}</p>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <small class="task-lead">
                        <i class="fas fa-user-tie me-1"></i> ${leadLink}
                    </small>
                    <small class="task-due-date ${dueDateClass}">
                        <i class="fas fa-calendar-alt me-1"></i> ${dueDateStr}
                    </small>
                </div>
            `;
            cardWrapper.appendChild(taskCard);
            taskList.appendChild(cardWrapper);
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
                addTaskModal.hide();
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

    // --- Edit Task Modal ---
    const editTaskModalEl = document.getElementById('edit-task-modal');
    const editTaskModal = new bootstrap.Modal(editTaskModalEl);
    const editTaskForm = document.getElementById('edit-task-form');
    const editTaskIdInput = document.getElementById('edit-task-id');
    const editTaskTitleInput = document.getElementById('edit-task-title');
    const editTaskDetailsInput = document.getElementById('edit-task-details');
    const editTaskDueDateInput = document.getElementById('edit-task-due-date');
    const editTaskLeadSearchInput = document.getElementById('edit-task-lead-search');
    const editTaskLeadIdInput = document.getElementById('edit-task-lead-id');
    const editLeadSuggestionsEl = document.getElementById('edit-lead-suggestions');


    const openEditModal = (task) => {
        editTaskIdInput.value = task.id;
        editTaskTitleInput.value = task.title;
        editTaskDetailsInput.value = task.details || '';
        editTaskDueDateInput.value = task.due_date ? task.due_date.split('T')[0] : '';

        // Set lead info
        if (task.lead_id) {
            const lead = allLeads.find(l => l.id === task.lead_id);
            if (lead) {
                editTaskLeadSearchInput.value = `${lead.first_name} ${lead.last_name}`;
                editTaskLeadIdInput.value = task.lead_id;
            }
        } else {
            editTaskLeadSearchInput.value = '';
            editTaskLeadIdInput.value = '';
        }
        editLeadSuggestionsEl.innerHTML = '';
        editTaskModal.show();
    };

     const handleEditLeadSearch = (e) => {
        const query = e.target.value.toLowerCase();
        editLeadSuggestionsEl.innerHTML = '';
        if (!query) {
            editTaskLeadIdInput.value = ''; // Clear hidden input if search is cleared
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
                editTaskLeadSearchInput.value = `${lead.first_name} ${lead.last_name}`;
                editTaskLeadIdInput.value = lead.id;
                editLeadSuggestionsEl.innerHTML = '';
            });
            editLeadSuggestionsEl.appendChild(div);
        });
    };

    const handleUpdateTask = async (e) => {
        e.preventDefault();
        const taskId = editTaskIdInput.value;
        const updatedData = {
            title: editTaskTitleInput.value,
            details: editTaskDetailsInput.value,
            due_date: editTaskDueDateInput.value || null,
            lead_id: editTaskLeadIdInput.value || null,
        };

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                showToast('Task updated!');
                editTaskModal.hide();
                await fetchTasks(); // Refresh list
            } else {
                showToast('Failed to update task.', 'error');
            }
        } catch (error) {
            console.error('Error saving task:', error);
            showToast('An error occurred while saving.', 'error');
        }
    };


    const initializeTasksPage = async () => {
        await fetchLeads();
        await fetchTasks();
        taskSearchInput.addEventListener('input', renderTasks);
        taskFilterSelect.addEventListener('change', renderTasks);
        showCompletedCheckbox.addEventListener('change', renderTasks);
        taskLeadSearchInput.addEventListener('input', handleLeadSearch);
        addTaskForm.addEventListener('submit', handleAddTask);
        addTaskFab.addEventListener('click', () => addTaskModal.show());
        editTaskForm.addEventListener('submit', handleUpdateTask);
        editTaskLeadSearchInput.addEventListener('input', handleEditLeadSearch);


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
                    renderTasks(); // Re-render to apply styling changes
                } catch (error) {
                    console.error('Error updating task completion:', error);
                    showToast('Failed to update task.', 'error');
                }
                return;
            }

            // Handle Edit Button
            if (e.target.closest('.edit-task-btn')) {
                const task = allTasks.find(t => t.id === taskId);
                if (task) openEditModal(task);
                return;
            }

            // Handle Delete Button
            if (e.target.closest('.delete-task-btn')) {
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
        });
    };

    initializeTasksPage();
});
