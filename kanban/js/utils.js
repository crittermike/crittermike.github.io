/**
 * Utility functions for the Kanban application
 */

/**
 * Generates a random ID for boards, cards, columns, etc.
 * @returns {string} A random ID
 */
export function generateId() {
    return Math.random().toString(36).substring(2, 12);
}

/**
 * Shows a notification to the user
 * @param {string} message The message to show
 */
export function showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    let notificationMsg = document.getElementById('notification-message');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        
        notificationMsg = document.createElement('div');
        notificationMsg.id = 'notification-message';
        notification.appendChild(notificationMsg);
        
        document.body.appendChild(notification);
    }
    
    notificationMsg.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

/**
 * Closes all modals
 */
export function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}
