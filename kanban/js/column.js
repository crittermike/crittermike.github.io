/**
 * Functions for creating and managing columns in the Kanban application
 */
import { state } from './state.js';
import { generateId } from './utils.js';
import { createCardElement, addNewCard } from './card.js';
import { database } from './firebase.js';

/**
 * Creates a column element
 * @param {string} columnId The ID of the column
 * @param {Object} columnData The column data
 */
export function createColumnElement(columnId, columnData) {
    const column = document.createElement('div');
    column.className = 'column';
    column.dataset.id = columnId;

    // Column header with title
    const columnHeader = document.createElement('div');
    columnHeader.className = 'column-header';

    const columnTitle = document.createElement('input');
    columnTitle.className = 'column-title';
    columnTitle.value = columnData.title;
    columnTitle.spellcheck = false;
    
    columnTitle.addEventListener('change', () => {
        if (state.boardRef) {
            state.boardRef.child(`columns/${columnId}/title`).set(columnTitle.value);
        }
    });

    columnHeader.appendChild(columnTitle);

    // Column actions
    const columnActions = document.createElement('div');
    columnActions.className = 'column-actions';

    // Delete column button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'column-action-button';
    deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
    `;
    deleteBtn.title = "Delete Column";
    deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this column and all its cards?')) {
            state.boardRef.child(`columns/${columnId}`).remove();
        }
    });

    columnActions.appendChild(deleteBtn);
    columnHeader.appendChild(columnActions);
    column.appendChild(columnHeader);

    // Column content - cards container
    const columnContent = document.createElement('div');
    columnContent.className = 'column-content';
    columnContent.dataset.columnId = columnId;

    // Set up drag and drop for cards
    columnContent.addEventListener('dragover', e => {
        e.preventDefault();
        columnContent.classList.add('drag-over');
    });
    
    columnContent.addEventListener('dragleave', () => {
        columnContent.classList.remove('drag-over');
    });
    
    columnContent.addEventListener('drop', e => {
        e.preventDefault();
        columnContent.classList.remove('drag-over');
        
        const cardId = e.dataTransfer.getData('text/plain');
        const sourceColumnId = e.dataTransfer.getData('source-column');
        
        if (sourceColumnId !== columnId) {
            // Move the card to the new column
            state.boardRef.child(`columns/${sourceColumnId}/cards/${cardId}`).once('value', snapshot => {
                const cardData = snapshot.val();
                if (cardData) {
                    // Add to new column
                    state.boardRef.child(`columns/${columnId}/cards/${cardId}`).set(cardData);
                    // Remove from old column
                    state.boardRef.child(`columns/${sourceColumnId}/cards/${cardId}`).remove();
                }
            });
        }
    });

    // Add cards to column
    if (columnData.cards) {
        let cardIds = Object.keys(columnData.cards);
        
        // Sort cards by votes if enabled
        if (state.sortByVotes) {
            cardIds.sort((a, b) => {
                const votesA = columnData.cards[a].votes || 0;
                const votesB = columnData.cards[b].votes || 0;
                return votesB - votesA; // Descending order (highest votes first)
            });
        }
        
        cardIds.forEach(cardId => {
            const card = columnData.cards[cardId];
            const cardElement = createCardElement(cardId, card, columnId);
            columnContent.appendChild(cardElement);
        });
    }

    column.appendChild(columnContent);

    // Add card button
    const addCardBtn = document.createElement('button');
    addCardBtn.className = 'add-card';
    addCardBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
        Add Card
    `;
    addCardBtn.addEventListener('click', () => {
        addNewCard(columnId);
    });
    column.appendChild(addCardBtn);

    // Return the column element (the board.js module will handle appending it)
    return column;
}

/**
 * Updates columns in the board
 * @param {Object} columns The columns data from Firebase
 */
export function updateColumns(columns) {
    const board = document.getElementById('board');
    
    // Remove all columns except the add column button
    const columnsToRemove = Array.from(board.querySelectorAll('.column'));
    columnsToRemove.forEach(column => column.remove());

    // Add columns in order
    const columnIds = Object.keys(columns);
    columnIds.sort((a, b) => columns[a].order - columns[b].order);
    
    columnIds.forEach(columnId => {
        const column = columns[columnId];
        const columnElement = createColumnElement(columnId, column);
        
        // Add column to board before the "Add Column" button
        board.insertBefore(columnElement, document.querySelector('.add-column-container'));
    });

    // Make sure add column button is last
    const addColumnContainer = document.querySelector('.add-column-container');
    board.appendChild(addColumnContainer);
}

/**
 * Adds a new column to the board
 */
export function addNewColumn() {
    if (!state.boardRef) return;

    // Get the current number of columns for ordering
    state.boardRef.child('columns').once('value', snapshot => {
        const columns = snapshot.val() || {};
        const columnCount = Object.keys(columns).length;
        
        const columnId = generateId();
        const columnData = {
            title: 'New Column',
            order: columnCount, // Place it at the end
            created: firebase.database.ServerValue.TIMESTAMP
        };
        
        state.boardRef.child(`columns/${columnId}`).set(columnData);
    });
}
