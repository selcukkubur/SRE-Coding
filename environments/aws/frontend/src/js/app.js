// API Configuration for AWS
const API_BASE_URL = 'YOUR_API_GATEWAY_URL'; // This will be replaced during build

// Initialize Sentry for production
Sentry.init({
    dsn: "YOUR_SENTRY_DSN", // This will be replaced during build
    integrations: [new Sentry.BrowserTracing()],
    tracesSampleRate: 1.0,
    environment: 'production'
});

// DOM Elements
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const descriptionInput = document.getElementById('description');

// Event Listeners
document.addEventListener('DOMContentLoaded', loadTasks);
taskForm.addEventListener('submit', createTask);

// Load all tasks
async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tasks = await response.json();
        
        taskList.innerHTML = '';
        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error loading tasks:', error);
        showError('Failed to load tasks');
    }
}

// Create a new task
async function createTask(event) {
    event.preventDefault();
    
    const description = descriptionInput.value.trim();
    if (!description) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const task = await response.json();
        const taskElement = createTaskElement(task);
        taskList.insertBefore(taskElement, taskList.firstChild);
        
        // Clear input
        descriptionInput.value = '';
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error creating task:', error);
        showError('Failed to create task');
    }
}

// Create task element
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'list-group-item';
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <p class="mb-1">${escapeHtml(task.description)}</p>
                <small class="text-muted">Created: ${new Date(task.created_at).toLocaleString()}</small>
            </div>
        </div>
    `;
    return div;
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(errorDiv, taskForm);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
