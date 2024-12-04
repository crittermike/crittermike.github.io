document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copyText');
    const clearBtn = document.getElementById('clearText');

    function cleanSlackText(text) {
        // Split into lines and clean them up
        let lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line); // Remove empty lines

        let formattedLines = [];
        let currentUser = null;
        let currentMessages = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Remove timestamps
            line = line.replace(/\d{1,2}:\d{2}(?:\s*[AP]M)?/g, '').trim();
            if (!line) continue;

            // Check if this line is a username
            const usernameMatch = line.match(/^([a-zA-Z0-9_]+)$/);
            
            if (usernameMatch) {
                const newUser = usernameMatch[1];
                
                // If we're switching to a new user, output the current messages
                if (currentUser && currentUser !== newUser && currentMessages.length > 0) {
                    if (formattedLines.length > 0) formattedLines.push('<br>');
                    formattedLines.push(`<p><b>${currentUser}:</b><br>`);
                    formattedLines.push(currentMessages.join('<br>'));
                    formattedLines.push('</p>');
                    currentMessages = [];
                }
                
                currentUser = newUser;
            } else if (currentUser) {
                // Add this message to the current user's messages
                currentMessages.push(line);
            } else {
                // If we have a message without a user (shouldn't happen), just add it
                formattedLines.push(`<p>${line}</p>`);
            }
        }

        // Don't forget to add the last user's messages
        if (currentUser && currentMessages.length > 0) {
            if (formattedLines.length > 0) formattedLines.push('<br>');
            formattedLines.push(`<p><b>${currentUser}:</b><br>`);
            formattedLines.push(currentMessages.join('<br>'));
            formattedLines.push('</p>');
        }

        return formattedLines.join('');
    }

    function updatePreview() {
        const cleanedText = cleanSlackText(input.innerText);
        preview.innerHTML = cleanedText;
    }

    // Event listeners
    input.addEventListener('input', updatePreview);
    input.addEventListener('paste', (e) => {
        // Let the paste happen normally
        setTimeout(updatePreview, 0);
    });

    copyBtn.addEventListener('click', () => {
        // Create a temporary element with the formatted text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanSlackText(input.innerText);
        document.body.appendChild(tempDiv);
        
        // Copy the formatted text to clipboard
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.execCommand('copy');
        selection.removeAllRanges();
        
        // Clean up
        document.body.removeChild(tempDiv);
        
        // Show copied confirmation
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });

    clearBtn.addEventListener('click', () => {
        input.innerHTML = '';
        updatePreview();
    });
});
