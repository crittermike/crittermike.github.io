document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copyText');
    const clearBtn = document.getElementById('clearText');

    function cleanSlackText(text) {
        // Remove timestamps and clean up lines
        const lines = text.split('\n')
            .map(line => line.replace(/\d{1,2}:\d{2}(?:\s*[AP]M)?/g, '').trim())
            .filter(Boolean);

        const formattedMessages = [];
        let currentUser = null;
        let currentMessages = [];

        const processCurrentUser = () => {
            if (currentUser && currentMessages.length) {
                formattedMessages.push(`<p><b>${currentUser}:</b><br>`);
                formattedMessages.push(currentMessages.join('<br>'));
                formattedMessages.push('</p>');
                currentMessages = [];
            }
        };

        for (const line of lines) {
            const usernameMatch = line.match(/^([a-zA-Z0-9_]+)$/);
            
            if (usernameMatch) {
                processCurrentUser();
                currentUser = usernameMatch[1];
            } else if (currentUser) {
                currentMessages.push(line);
            } else if (line) { // Ensure no empty lines are added
                formattedMessages.push(`<p>${line}</p>`);
            }
        }

        // Process the last user's messages
        processCurrentUser();

        // Trim leading whitespace from the output
        return formattedMessages.join('').trim();
    }

    function updatePreview() {
        preview.innerHTML = cleanSlackText(input.innerText);
    }

    // Event listeners
    input.addEventListener('input', updatePreview);
    input.addEventListener('paste', () => setTimeout(updatePreview, 0));

    copyBtn.addEventListener('click', () => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanSlackText(input.innerText);
        document.body.appendChild(tempDiv);
        
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.execCommand('copy');
        selection.removeAllRanges();
        
        document.body.removeChild(tempDiv);
        
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Text';
        }, 2000);
    });

    clearBtn.addEventListener('click', () => {
        input.innerHTML = '';
        updatePreview();
    });
});
