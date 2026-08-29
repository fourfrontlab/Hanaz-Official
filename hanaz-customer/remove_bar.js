const fs = require('fs');
const path = require('path');

const directory = '.';

// Regex to match the announcement bar
const announcementRegex = /[\s]*<!-- ===== UTILITY BAR ===== -->[\s]*<div class="announcement-bar"[^>]*>[\s\S]*?<\/div>/gi;

function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'css' && file !== 'images' && file !== 'videos' && file !== 'js') {
                processDirectory(fullPath);
            }
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Remove announcement bar
            content = content.replace(announcementRegex, '');

            // Update feature boxes (like in index.html)
            content = content.replace(/<p>On all orders over Rs\. 5,000<\/p>/g, '<p>On all orders</p>');

            // Update shipping-info.html
            const oldShippingRules = `<li><strong>Orders under Rs. 5,000:</strong> A standard flat shipping rate of Rs. 200 applies to all orders.</li>
            <li><strong>Orders Rs. 5,000 and above:</strong> Enjoy <strong>Free Shipping</strong> on us. This discount is automatically applied at checkout.</li>`;
            const newShippingRules = `<li><strong>All Orders:</strong> Enjoy <strong>Free Shipping</strong> on us, no minimum required!</li>`;
            
            content = content.replace(oldShippingRules, newShippingRules);

            // Also try replacing it with flexible whitespace
            const oldShippingRegex = /<li><strong>Orders under Rs\. 5,000:<\/strong>[^<]*<\/li>\s*<li><strong>Orders Rs\. 5,000 and above:<\/strong>[^<]*<\/li>/gi;
            content = content.replace(oldShippingRegex, '<li><strong>All Orders:</strong> Enjoy <strong>Free Shipping</strong> on us, no minimum required!</li>');

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated', fullPath);
            }
        }
    }
}

processDirectory(directory);
