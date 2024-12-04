document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copyMarkdown');
    const clearBtn = document.getElementById('clearText');
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-'
    });

    function convertToMarkdown() {
        // Get the HTML content directly from the contenteditable div
        const htmlContent = input.innerHTML;
        
        return turndownService.turndown(htmlContent)
            // Clean up extra spaces around line breaks
            .replace(/\s*\n\s*/g, '\n')
            // Remove extra line breaks
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function updatePreview() {
        const markdown = convertToMarkdown();
        preview.textContent = markdown;
        Prism.highlightElement(preview);
    }

    // Event listeners for input changes
    input.addEventListener('input', updatePreview);
    input.addEventListener('paste', (e) => {
        // Let the paste happen normally to preserve formatting
        setTimeout(updatePreview, 0);
    });

    copyBtn.addEventListener('click', () => {
        const markdown = convertToMarkdown();
        navigator.clipboard.writeText(markdown).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    });

    clearBtn.addEventListener('click', () => {
        input.innerHTML = '';
        updatePreview();
    });
});
