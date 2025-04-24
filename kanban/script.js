// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBIAM_tIBqFUYQl5r-f7e78lNPzc0fIDcM",
    authDomain: "big-orca.firebaseapp.com",
    projectId: "big-orca",
    storageBucket: "big-orca.firebasestorage.app",
    messagingSenderId: "338206440353",
    appId: "1:338206440353:web:a6af4374836968379d29e0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const elements = {
    board: document.getElementById('board'),
    boardTitle: document.getElementById('board-title'),
    headerBoardTitle: document.getElementById('header-board-title'),
    boardId: document.getElementById('board-id'),
    addColumnBtn: document.getElementById('add-column'),
    createBoardBtn: document.getElementById('create-board'),
    openBoardBtn: document.getElementById('open-board'),
    openBoardModal: document.getElementById('open-board-modal'),
    boardIdInput: document.getElementById('board-id-input'),
    openBoardSubmit: document.getElementById('open-board-submit'),
    cardDetailModal: document.getElementById('card-detail-modal'),
    cardContentEdit: document.getElementById('card-content-edit'),
    commentsContainer: document.getElementById('comments-container'),
    newComment: document.getElementById('new-comment'),
    addCommentBtn: document.getElementById('add-comment-btn'),
    saveCardBtn: document.getElementById('save-card'),
    deleteCardBtn: document.getElementById('delete-card'),
    copyIdBtn: document.getElementById('copy-id'),
    notification: document.getElementById('notification'),
    notificationMsg: document.getElementById('notification-message')
};

// Close buttons for modals
document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', closeAllModals);
});

// State
const state = {
    boardId: null,
    boardRef: null,
    activeCardId: null,
    activeColumnId: null,
    sortByVotes: false  // Track if we're sorting by votes
};

// Functions
function generateId() {
    return Math.random().toString(36).substring(2, 12);
}

function showNotification(message) {
    elements.notificationMsg.textContent = message;
    elements.notification.classList.add('show');
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

function closeAllModals() {
    elements.openBoardModal.style.display = 'none';
    elements.cardDetailModal.style.display = 'none';
}

function createNewBoard() {
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

function loadBoard(boardId) {
    // Clear previous board data
    while (elements.board.children.length > 1) {
        elements.board.removeChild(elements.board.firstChild);
    }

    state.boardId = boardId;
    state.boardRef = database.ref(`boards/${boardId}`);
    elements.boardId.textContent = boardId;

    // Listen for board title changes
    state.boardRef.child('title').on('value', snapshot => {
        const title = snapshot.val();
        if (title) {
            // Update the input field and document title
            elements.boardTitle.value = title;
            document.title = `${title} | Kanban Board`;
        }
    });

    // Listen for column changes
    state.boardRef.child('columns').on('value', snapshot => {
        const columns = snapshot.val() || {};
        updateColumns(columns);
    });

    // Add column button should be the last element
    elements.board.appendChild(document.querySelector('.add-column-container'));
}

function updateColumns(columns) {
    // Remove all columns except the add column button
    const columnsToRemove = Array.from(elements.board.querySelectorAll('.column'));
    columnsToRemove.forEach(column => column.remove());

    // Add columns in order
    const columnIds = Object.keys(columns);
    columnIds.sort((a, b) => columns[a].order - columns[b].order);
    
    columnIds.forEach(columnId => {
        const column = columns[columnId];
        createColumnElement(columnId, column);
    });

    // Make sure add column button is last
    const addColumnContainer = document.querySelector('.add-column-container');
    elements.board.appendChild(addColumnContainer);
}

function createColumnElement(columnId, columnData) {
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

    // Add column to board before the "Add Column" button
    elements.board.insertBefore(column, document.querySelector('.add-column-container'));
}

function createCardElement(cardId, cardData, columnId) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = cardId;
    card.draggable = true;
    
    // Set up drag events
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', cardId);
        e.dataTransfer.setData('source-column', columnId);
        card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    // Card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';
    cardContent.textContent = cardData.content;
    card.appendChild(cardContent);
    
    // Add comments if they exist - always show them
    if (cardData.comments && Object.keys(cardData.comments).length > 0) {
        const commentIds = Object.keys(cardData.comments);
        
        // Sort comments chronologically
        const sortedComments = commentIds.sort((a, b) => 
            cardData.comments[a].created - cardData.comments[b].created);
        
        // Add all comments (without timestamps)
        sortedComments.forEach(commentId => {
            const comment = cardData.comments[commentId];
            const commentEl = document.createElement('div');
            commentEl.className = 'inline-comment';
            commentEl.textContent = comment.content;
            card.appendChild(commentEl);
        });
    }
    
    // Add comment input (always visible)
    const addCommentForm = document.createElement('div');
    addCommentForm.className = 'inline-add-comment';
    
    const commentInput = document.createElement('input');
    commentInput.className = 'inline-comment-input';
    commentInput.placeholder = 'Add a comment...';
    commentInput.dataset.columnId = columnId;
    commentInput.dataset.cardId = cardId;
    
    // Handle inline comment submission
    commentInput.addEventListener('keydown', (e) => {
        e.stopPropagation(); // Prevent card from opening
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const content = commentInput.value.trim();
            if (content) {
                addInlineComment(columnId, cardId, content);
                commentInput.value = '';
            }
        }
    });
    
    // Prevent click propagation to avoid opening card modal
    commentInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    addCommentForm.appendChild(commentInput);
    card.appendChild(addCommentForm);

    // Card footer - only keep vote buttons, no timestamps or comment buttons
    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer';

    // Voting system
    const votes = document.createElement('div');
    votes.className = 'votes';

    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'vote-button';
    upvoteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
        </svg>
    `;
    upvoteBtn.title = "Upvote";
    upvoteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentVotes = cardData.votes || 0;
        state.boardRef.child(`columns/${columnId}/cards/${cardId}/votes`).set(currentVotes + 1);
    });

    const voteCount = document.createElement('span');
    voteCount.className = 'vote-count';
    voteCount.textContent = cardData.votes || 0;

    const downvoteBtn = document.createElement('button');
    downvoteBtn.className = 'vote-button';
    downvoteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/>
        </svg>
    `;
    downvoteBtn.title = "Downvote";
    downvoteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentVotes = cardData.votes || 0;
        if (currentVotes > 0) {
            state.boardRef.child(`columns/${columnId}/cards/${cardId}/votes`).set(currentVotes - 1);
        }
    });

    votes.appendChild(upvoteBtn);
    votes.appendChild(voteCount);
    votes.appendChild(downvoteBtn);
    cardFooter.appendChild(votes);
    card.appendChild(cardFooter);
    
    // Open card modal on click
    card.addEventListener('click', () => {
        openCardModal(cardId, columnId, cardData);
    });

    return card;
}

function addNewColumn() {
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

function addNewCard(columnId) {
    if (!state.boardRef) return;

    const cardId = generateId();
    const cardData = {
        content: '',
        votes: 0,
        created: firebase.database.ServerValue.TIMESTAMP
    };
    
    state.boardRef.child(`columns/${columnId}/cards/${cardId}`).set(cardData)
        .then(() => {
            openCardModal(cardId, columnId, cardData);
        });
}

function openCardModal(cardId, columnId, cardData) {
    state.activeCardId = cardId;
    state.activeColumnId = columnId;
    
    elements.cardContentEdit.value = cardData.content;
    elements.cardDetailModal.style.display = 'flex';
    elements.cardContentEdit.focus();

    // Load comments for the card
    loadComments(columnId, cardId);
}

function saveCard() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    const content = elements.cardContentEdit.value.trim();
    
    if (content) {
        state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}/content`).set(content)
            .then(() => {
                closeAllModals();
                showNotification('Card updated');
            });
    } else {
        deleteCard();
    }
}

function deleteCard() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}`).remove()
        .then(() => {
            closeAllModals();
            showNotification('Card deleted');
        });
}

function handleBoardTitle() {
    if (!state.boardRef) return;
    
    const title = elements.boardTitle.value.trim();
    if (title) {
        state.boardRef.child('title').set(title);
        // Update the header title as well
        elements.headerBoardTitle.textContent = title;
    }
}

function openBoardDialog() {
    elements.openBoardModal.style.display = 'flex';
    elements.boardIdInput.focus();
}

function openExistingBoard() {
    const boardId = elements.boardIdInput.value.trim();
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

function copyBoardId() {
    if (!state.boardId) return;
    
    navigator.clipboard.writeText(state.boardId)
        .then(() => {
            showNotification('Board ID copied to clipboard');
        })
        .catch(() => {
            // Fallback for browsers that don't support clipboard API
            const input = document.createElement('textarea');
            input.value = state.boardId;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showNotification('Board ID copied to clipboard');
        });
}

// Sort functionality
function toggleSortByVotes() {
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

// Comments functionality
function addComment() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    const commentContent = elements.newComment.value.trim();
    if (!commentContent) return;
    
    const commentId = generateId();
    const commentData = {
        content: commentContent,
        created: firebase.database.ServerValue.TIMESTAMP
    };
    
    state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}/comments/${commentId}`).set(commentData)
        .then(() => {
            elements.newComment.value = '';
            showNotification('Comment added');
        });
}

function loadComments(columnId, cardId) {
    if (!state.boardRef) return;
    
    elements.commentsContainer.innerHTML = ''; // Clear existing comments
    
    state.boardRef.child(`columns/${columnId}/cards/${cardId}/comments`).once('value', snapshot => {
        const comments = snapshot.val();
        
        if (!comments) {
            const noComments = document.createElement('div');
            noComments.className = 'no-comments';
            noComments.textContent = 'No comments yet';
            elements.commentsContainer.appendChild(noComments);
            return;
        }
        
        // Sort comments by timestamp (oldest first) - chronological order
        const sortedCommentIds = Object.keys(comments).sort((a, b) => {
            return comments[a].created - comments[b].created;
        });
        
        sortedCommentIds.forEach(commentId => {
            const comment = comments[commentId];
            const commentElement = createCommentElement(comment);
            elements.commentsContainer.appendChild(commentElement);
        });
    });
}

function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    
    const commentContent = document.createElement('div');
    commentContent.className = 'comment-content';
    commentContent.textContent = comment.content;
    commentElement.appendChild(commentContent);
    
    const commentTimestamp = document.createElement('div');
    commentTimestamp.className = 'comment-timestamp';
    
    if (comment.created) {
        const date = new Date(comment.created);
        commentTimestamp.textContent = date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    commentElement.appendChild(commentTimestamp);
    return commentElement;
}

// Add a comment directly from the card (without opening modal)
function addInlineComment(columnId, cardId, content) {
    if (!state.boardRef) return;
    
    const commentId = generateId();
    const commentData = {
        content: content,
        created: firebase.database.ServerValue.TIMESTAMP
    };
    
    state.boardRef.child(`columns/${columnId}/cards/${cardId}/comments/${commentId}`).set(commentData)
        .then(() => {
            showNotification('Comment added');
        });
}

// Event Listeners
elements.addColumnBtn.addEventListener('click', addNewColumn);
elements.createBoardBtn.addEventListener('click', createNewBoard);
elements.openBoardBtn.addEventListener('click', openBoardDialog);
elements.openBoardSubmit.addEventListener('click', openExistingBoard);
elements.boardTitle.addEventListener('change', handleBoardTitle);
elements.saveCardBtn.addEventListener('click', saveCard);
elements.deleteCardBtn.addEventListener('click', deleteCard);
elements.copyIdBtn.addEventListener('click', copyBoardId);
elements.addCommentBtn.addEventListener('click', addComment);

// Sort by votes button
document.getElementById('sort-by-votes').addEventListener('click', toggleSortByVotes);
elements.addCommentBtn.addEventListener('click', addComment);

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    if (event.target === elements.openBoardModal || event.target === elements.cardDetailModal) {
        closeAllModals();
    }
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAllModals();
    } else if (event.key === 'Enter' && event.ctrlKey && elements.cardDetailModal.style.display === 'flex') {
        saveCard();
    }
});

// Initialize a new board on page load if no board ID in URL
document.addEventListener('DOMContentLoaded', function() {
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
});

// Update URL hash when board changes
function updateUrlHash() {
    if (state.boardId) {
        window.location.hash = state.boardId;
    }
}

// Watch for board ID changes
Object.defineProperty(state, 'boardId', {
    set: function(value) {
        this._boardId = value;
        updateUrlHash();
    },
    get: function() {
        return this._boardId;
    }
});
