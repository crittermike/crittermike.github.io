document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copyMarkdown');
    const clearBtn = document.getElementById('clearText');
    const turndownService = new TurndownService();

    // Special handling for list items to prevent extra spacing
    turndownService.addRule('listItem', {
        filter: 'li',
        replacement: function (content, node, options) {
            content = content
                .replace(/^\n+/, '')     // Remove leading newlines
                .replace(/\n+$/, '')     // Remove trailing newlines
                .replace(/\n/gm, '\n  '); // Indent any nested content
            
            let prefix = options.bulletListMarker + ' ';
            let parent = node.parentNode;
            if (parent.nodeName === 'OL') {
                let start = parent.getAttribute('start');
                let index = Array.prototype.indexOf.call(parent.children, node);
                prefix = (start ? Number(start) + index : index + 1) + '. ';
            }
            return prefix + content + '\n';
        }
    });

    function convertToMarkdown() {
        // Get the HTML content directly from the contenteditable div
        const htmlContent = input.innerHTML;
        let markdown = turndownService.turndown(htmlContent).trim();
        return markdown;
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
