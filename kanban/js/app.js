/**
 * Main application entry point for the Kanban application
 * This file initializes the app and sets up event listeners
 */
import { closeAllModals } from './utils.js';
import { addNewColumn } from './column.js';
import { saveCard, deleteCard, addComment } from './card.js';
import { 
    createNewBoard, 
    handleBoardTitle, 
    openBoardDialog, 
    openExistingBoard, 
    copyBoardId, 
    toggleSortByVotes,
    initializeBoard
} from './board.js';

// Initialize elements when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Setup close button event handlers for modals
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', closeAllModals);
    });

    // Set up event listeners
    const addColumnBtn = document.getElementById('add-column');
    const createBoardBtn = document.getElementById('create-board');
    const openBoardBtn = document.getElementById('open-board');
    const openBoardSubmit = document.getElementById('open-board-submit');
    const boardTitle = document.getElementById('board-title');
    const saveCardBtn = document.getElementById('save-card');
    const deleteCardBtn = document.getElementById('delete-card');
    const copyIdBtn = document.getElementById('copy-id');
    const addCommentBtn = document.getElementById('add-comment-btn');
    const sortByVotesBtn = document.getElementById('sort-by-votes');

    // Button click handlers
    addColumnBtn.addEventListener('click', addNewColumn);
    createBoardBtn.addEventListener('click', createNewBoard);
    openBoardBtn.addEventListener('click', openBoardDialog);
    openBoardSubmit.addEventListener('click', openExistingBoard);
    boardTitle.addEventListener('change', handleBoardTitle);
    saveCardBtn.addEventListener('click', saveCard);
    deleteCardBtn.addEventListener('click', deleteCard);
    copyIdBtn.addEventListener('click', copyBoardId);
    addCommentBtn.addEventListener('click', addComment);
    sortByVotesBtn.addEventListener('click', toggleSortByVotes);

    // Modal close events - Close when clicking outside
    const openBoardModal = document.getElementById('open-board-modal');
    const cardDetailModal = document.getElementById('card-detail-modal');

    window.addEventListener('click', function(event) {
        if (event.target === openBoardModal || event.target === cardDetailModal) {
            closeAllModals();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
        } else if (event.key === 'Enter' && event.ctrlKey && cardDetailModal.style.display === 'flex') {
            saveCard();
        }
    });

    // Initialize the board (either load from URL or create a new one)
    initializeBoard();
});
