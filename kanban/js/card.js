/**
 * Functions for creating and managing cards in the Kanban application
 */
import { state } from './state.js';
import { generateId, showNotification, closeAllModals } from './utils.js';
import { database } from './firebase.js';

/**
 * Creates a card element
 * @param {string} cardId The ID of the card
 * @param {Object} cardData The card data
 * @param {string} columnId The ID of the column containing the card
 * @returns {HTMLElement} The card element
 */
export function createCardElement(cardId, cardData, columnId) {
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

    // Create card header with content and votes side-by-side
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';

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
    
    // Card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';
    cardContent.textContent = cardData.content;
    
    cardHeader.appendChild(votes);
    cardHeader.appendChild(cardContent);
    card.appendChild(cardHeader);
    
    // Comment toggle button
    const hasComments = cardData.comments && Object.keys(cardData.comments).length > 0;
    const commentCount = hasComments ? Object.keys(cardData.comments).length : 0;
    
    const commentsBtn = document.createElement('button');
    commentsBtn.className = 'comments-btn';
    commentsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
        </svg>
        <span>${commentCount}</span>
    `;
    commentsBtn.title = "Toggle Comments";
    commentsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const comments = card.querySelector('.comments-section');
        if (comments) {
            comments.classList.toggle('hidden');
        }
    });
    
    cardHeader.appendChild(commentsBtn);
    
    // Comments section (initially hidden if there are no comments)
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    if (!hasComments) {
        commentsSection.classList.add('hidden');
    }
    
    // Add comments if they exist
    if (hasComments) {
        const commentIds = Object.keys(cardData.comments);
        
        // Sort comments chronologically
        const sortedComments = commentIds.sort((a, b) => 
            cardData.comments[a].created - cardData.comments[b].created);
        
        // Add all comments
        sortedComments.forEach(commentId => {
            const comment = cardData.comments[commentId];
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.textContent = comment.content;
            commentsSection.appendChild(commentEl);
        });
    }
    
    // Add comment input
    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';
    
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'comment-input';
    commentInput.placeholder = 'Add a comment...';
    
    // Handle comment submission
    commentInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const content = commentInput.value.trim();
            if (content) {
                addInlineComment(columnId, cardId, content);
                commentInput.value = '';
            }
        }
    });
    
    commentInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    commentForm.appendChild(commentInput);
    commentsSection.appendChild(commentForm);
    card.appendChild(commentsSection);
    
    // Open card modal on click
    card.addEventListener('click', () => {
        openCardModal(cardId, columnId, cardData);
    });

    return card;
}

/**
 * Adds a new card to a column
 * @param {string} columnId The ID of the column to add the card to
 */
export function addNewCard(columnId) {
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

/**
 * Opens the card modal for editing
 * @param {string} cardId The ID of the card to edit
 * @param {string} columnId The ID of the column containing the card
 * @param {Object} cardData The card data
 */
export function openCardModal(cardId, columnId, cardData) {
    state.activeCardId = cardId;
    state.activeColumnId = columnId;
    
    const cardContentEdit = document.getElementById('card-content-edit');
    const cardDetailModal = document.getElementById('card-detail-modal');
    
    cardContentEdit.value = cardData.content;
    cardDetailModal.style.display = 'flex';
    cardContentEdit.focus();

    // Load comments for the card
    loadComments(columnId, cardId);
}

/**
 * Saves the current card being edited
 */
export function saveCard() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    const cardContentEdit = document.getElementById('card-content-edit');
    const content = cardContentEdit.value.trim();
    
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

/**
 * Deletes the current card
 */
export function deleteCard() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}`).remove()
        .then(() => {
            closeAllModals();
            showNotification('Card deleted');
        });
}

/**
 * Adds a comment to a card (inline, without opening the modal)
 * @param {string} columnId The ID of the column
 * @param {string} cardId The ID of the card
 * @param {string} content The comment content
 */
export function addInlineComment(columnId, cardId, content) {
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

/**
 * Adds a comment to the current card (from modal)
 */
export function addComment() {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    const newComment = document.getElementById('new-comment');
    const commentContent = newComment.value.trim();
    if (!commentContent) return;
    
    const commentId = generateId();
    const commentData = {
        content: commentContent,
        created: firebase.database.ServerValue.TIMESTAMP
    };
    
    state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}/comments/${commentId}`).set(commentData)
        .then(() => {
            newComment.value = '';
            showNotification('Comment added');
            // Reload comments to show the newly added comment
            loadComments(state.activeColumnId, state.activeCardId);
        });
}

/**
 * Loads comments for a card
 * @param {string} columnId The ID of the column
 * @param {string} cardId The ID of the card
 */
export function loadComments(columnId, cardId) {
    if (!state.boardRef) return;
    
    const commentsContainer = document.getElementById('comments-container');
    commentsContainer.innerHTML = ''; // Clear existing comments
    
    state.boardRef.child(`columns/${columnId}/cards/${cardId}/comments`).once('value', snapshot => {
        const comments = snapshot.val();
        
        if (!comments) {
            const noComments = document.createElement('div');
            noComments.className = 'no-comments';
            noComments.textContent = 'No comments yet';
            commentsContainer.appendChild(noComments);
            return;
        }
        
        // Sort comments by timestamp (oldest first) - chronological order
        const sortedCommentIds = Object.keys(comments).sort((a, b) => {
            return comments[a].created - comments[b].created;
        });
        
        sortedCommentIds.forEach(commentId => {
            const comment = comments[commentId];
            const commentElement = createCommentElement(comment, commentId);
            commentsContainer.appendChild(commentElement);
        });
    });
}

/**
 * Creates a comment element for the card modal
 * @param {Object} comment The comment data
 * @param {string} commentId The ID of the comment
 * @returns {HTMLElement} The comment element
 */
export function createCommentElement(comment, commentId) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.dataset.id = commentId;
    
    const commentContent = document.createElement('div');
    commentContent.className = 'comment-content';
    commentContent.textContent = comment.content;
    commentElement.appendChild(commentContent);
    
    const commentFooter = document.createElement('div');
    commentFooter.className = 'comment-footer';
    
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
    
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';
    
    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'comment-action-button';
    editButton.title = 'Edit comment';
    editButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
        </svg>
    `;
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        editComment(commentId);
    });
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'comment-action-button';
    deleteButton.title = 'Delete comment';
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
    `;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteComment(commentId);
    });
    
    commentActions.appendChild(editButton);
    commentActions.appendChild(deleteButton);
    
    commentFooter.appendChild(commentTimestamp);
    commentFooter.appendChild(commentActions);
    
    commentElement.appendChild(commentFooter);
    return commentElement;
}

/**
 * Edits a comment on the current card
 * @param {string} commentId The ID of the comment to edit
 */
export function editComment(commentId) {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    // Find the comment element and content
    const commentElement = document.querySelector(`.comment[data-id="${commentId}"]`);
    if (!commentElement) return;
    
    const commentContent = commentElement.querySelector('.comment-content');
    const originalContent = commentContent.textContent;
    
    // Replace content with editable textarea
    const editArea = document.createElement('textarea');
    editArea.className = 'comment-edit-area';
    editArea.value = originalContent;
    
    // Create save and cancel buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'comment-edit-actions';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'btn primary-btn';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => {
        const newContent = editArea.value.trim();
        if (newContent) {
            // Update the comment in Firebase
            state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}/comments/${commentId}/content`)
                .set(newContent)
                .then(() => {
                    showNotification('Comment updated');
                    // Reload comments to refresh the view
                    loadComments(state.activeColumnId, state.activeCardId);
                });
        }
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        // Reload comments to restore the original view
        loadComments(state.activeColumnId, state.activeCardId);
    });
    
    actionButtons.appendChild(saveButton);
    actionButtons.appendChild(cancelButton);
    
    // Clear the comment content and add the edit area and buttons
    commentContent.textContent = '';
    commentContent.appendChild(editArea);
    commentContent.appendChild(actionButtons);
    
    // Focus the textarea
    editArea.focus();
    
    // Hide other comment elements while editing
    const commentFooter = commentElement.querySelector('.comment-footer');
    commentFooter.style.display = 'none';
}

/**
 * Deletes a comment from the current card
 * @param {string} commentId The ID of the comment to delete
 */
export function deleteComment(commentId) {
    if (!state.activeCardId || !state.activeColumnId || !state.boardRef) return;
    
    // Confirm deletion
    if (confirm('Are you sure you want to delete this comment?')) {
        state.boardRef.child(`columns/${state.activeColumnId}/cards/${state.activeCardId}/comments/${commentId}`)
            .remove()
            .then(() => {
                showNotification('Comment deleted');
                // Reload comments to refresh the view
                loadComments(state.activeColumnId, state.activeCardId);
            });
    }
}
