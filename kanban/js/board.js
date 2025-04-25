/**
 * Functions for creating and managing the kanban board
 */
import { state } from './state.js';
import { generateId, showNotification, closeAllModals } from './utils.js';
import { updateColumns } from './column.js';
import { database } from './firebase.js';

/**
 * Creates a new board
 */
export function createNewBoard() {
    // Generate a unique ID for the board
    const boardId = generateId();
    const boardData = {
        title: 'Untitled Board',
        created: firebase.database.ServerValue.TIMESTAMP,
        columns: {}
    };

    // Create the board in Firebase
    database.ref(`boards/${boardId}`).set(boardData)
        .then(() => {
            loadBoard(boardId);
            showNotification('New board created!');
        })
        .catch(error => {
            console.error("Error creating board:", error);
            showNotification('Failed to create board');
        });
}

/**
 * Loads a board by ID
 * @param {string} boardId The ID of the board to load
 */
export function loadBoard(boardId) {
    const board = document.getElementById('board');
    const boardTitle = document.getElementById('board-title');
    const boardIdElement = document.getElementById('board-id');
    
    // Clear previous board data
    while (board.children.length > 1) {
        board.removeChild(board.firstChild);
    }

    // Update state with new board ID
    state.setBoardId(boardId);
    boardIdElement.textContent = boardId;

    // Listen for board title changes
    state.boardRef.child('title').on('value', snapshot => {
        const title = snapshot.val();
        if (title) {
            // Update the input field and document title
            boardTitle.value = title;
            document.title = `${title} | Kanban Board`;
        }
    });

    // Listen for column changes
    state.boardRef.child('columns').on('value', snapshot => {
        const columns = snapshot.val() || {};
        updateColumns(columns);
    });

    // Make sure the add column button is at the end
    const addColumnContainer = document.querySelector('.add-column-container');
    board.appendChild(addColumnContainer);
}

/**
 * Updates the board title
 */
export function handleBoardTitle() {
    if (!state.boardRef) return;
    
    const boardTitle = document.getElementById('board-title');
    const title = boardTitle.value.trim();
    if (title) {
        state.boardRef.child('title').set(title);
    }
}

/**
 * Opens the board dialog to enter a board ID
 */
export function openBoardDialog() {
    const openBoardModal = document.getElementById('open-board-modal');
    const boardIdInput = document.getElementById('board-id-input');
    
    openBoardModal.style.display = 'flex';
    boardIdInput.focus();
}

/**
 * Opens an existing board by ID from the input field
 */
export function openExistingBoard() {
    const boardIdInput = document.getElementById('board-id-input');
    const boardId = boardIdInput.value.trim();
    
    if (!boardId) {
        showNotification('Please enter a valid Board ID');
        return;
    }
    
    database.ref(`boards/${boardId}`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                loadBoard(boardId);
                closeAllModals();
            } else {
                showNotification('Board not found');
            }
        })
        .catch(error => {
            console.error("Error opening board:", error);
            showNotification('Failed to open board');
        });
}

/**
 * Copies the current board ID to the clipboard
 */
export function copyBoardId() {
    if (!state.boardId) return;
    
    // Use modern clipboard API with async handling
    if (navigator.clipboard) {
        navigator.clipboard.writeText(state.boardId)
            .then(() => {
                showNotification('Board ID copied to clipboard');
            })
            .catch(err => {
                console.error('Clipboard error:', err);
                showNotification('Clipboard access denied');
            });
    } else {
        // Modern fallback that avoids synchronous operations
        try {
            const copyText = async () => {
                const input = document.createElement('textarea');
                input.value = state.boardId;
                input.style.position = 'absolute';
                input.style.left = '-9999px';
                document.body.appendChild(input);
                input.focus();
                input.select();
                
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(input);
                    if (successful) {
                        showNotification('Board ID copied to clipboard');
                    } else {
                        showNotification('Failed to copy to clipboard');
                    }
                } catch (err) {
                    document.body.removeChild(input);
                    showNotification('Failed to copy to clipboard');
                }
            };
            
            copyText();
        } catch (err) {
            showNotification('Failed to copy to clipboard');
        }
    }
}

/**
 * Toggles sorting cards by votes
 */
export function toggleSortByVotes() {
    state.sortByVotes = !state.sortByVotes;
    const sortButton = document.getElementById('sort-by-votes');
    
    if (state.sortByVotes) {
        sortButton.classList.add('active');
        sortButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z"/>
            </svg>
            Sort by Votes
        `;
    } else {
        sortButton.classList.remove('active');
        sortButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
            </svg>
            Sort by Votes
        `;
    }
    
    // Re-fetch the columns to trigger a re-render with the new sort
    if (state.boardRef) {
        state.boardRef.child('columns').once('value', snapshot => {
            const columns = snapshot.val() || {};
            updateColumns(columns);
        });
    }
}

/**
 * Initialize a board on page load
 * Either loads from URL hash or creates a new board
 */
export function initializeBoard() {
    // Check if there's a board ID in the URL hash
    const hashBoardId = window.location.hash.substring(1);
    
    if (hashBoardId) {
        database.ref(`boards/${hashBoardId}`).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    loadBoard(hashBoardId);
                } else {
                    createNewBoard();
                }
            })
            .catch(() => createNewBoard());
    } else {
        createNewBoard();
    }
}
