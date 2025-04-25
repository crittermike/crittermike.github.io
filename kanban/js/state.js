/**
 * State management module for the Kanban application
 * This separates the state into its own module to avoid circular dependencies
 */
import { database } from './firebase.js';

// Application state
export const state = {
    boardId: null,
    boardRef: null,
    activeCardId: null,
    activeColumnId: null,
    sortByVotes: false,
    user: null,
    
    // Setter for boardId that automatically updates URL hash
    setBoardId(value) {
        this.boardId = value;
        if (value) {
            window.location.hash = value;
        }
        
        // Set up the boardRef as well when boardId changes
        if (value) {
            this.boardRef = database.ref(`boards/${value}`);
        } else {
            this.boardRef = null;
        }
    },

    // Set the authenticated user
    setUser(user) {
        this.user = user;
    }
};
