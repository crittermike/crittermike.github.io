// Clean implementation of the card creation function
// This will replace the existing implementation in script.js

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
