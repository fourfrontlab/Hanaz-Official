const fs = require('fs');
const file = 'hanaz-customer/pdp-face-wash.html';
let content = fs.readFileSync(file, 'utf8');

// 1. H1
content = content.replace(/Hanaz Vitamin C Face Cleanser - 100 ml/g, 'HANAZ C-Active Brightening Cleanser & Face Wash — 100 ml');

// 2. Meta descriptions
const fwDesc = "HANAZ C-Active Brightening Cleanser & Face Wash contains 3% niacinamide and 1% sodium ascorbyl phosphate. Available in a 100 ml bottle.";

content = content.replace(/<meta name="description" id="seo-desc"[\s\S]*?content="[^"]+">/, `<meta name="description" id="seo-desc"\n    content="${fwDesc}">`);
content = content.replace(/<meta property="og:description" id="seo-og-desc"[\s\S]*?content="[^"]+">/, `<meta property="og:description" id="seo-og-desc"\n    content="${fwDesc}">`);

// 3. Schema description
content = content.replace(/"description": "Melt away dullness[^"]+",/, `"description": "${fwDesc}",`);
content = content.replace(/const cleanDesc = "Melt away dullness[^"]+";/, `const cleanDesc = "${fwDesc}";`);

// 4. Desktop description
content = content.replace(/<div id="pdp-description-content">\s*<p>.*?<\/p>\s*<\/div>/s, `<div id="pdp-description-content">
                <p>${fwDesc}</p>
              </div>`);

// 5. Mobile description
content = content.replace(/<div class="pdp-info-text-content" id="pdp-mobile-description-content">.*?<\/div>/s, `<div class="pdp-info-text-content" id="pdp-mobile-description-content">${fwDesc}</div>`);

// 6. Fix "Key Ingredients" vs "Full Ingredients".
// The Face Wash HAS a Full Ingredients section.
// The user says: "Do not claim full ingredients are present if only highlighted actives are shown."
// Since it already has a "Full Ingredients" section (pdp-full-ingredients-content), I will just leave the Key Ingredients section as is because it accurately only shows highlighted actives, not claiming to be full.
// Wait, the user said "Keep concentrations separate from the full INCI lists". This implies keeping the Key Ingredients (which has concentrations) and the Full INCI (which doesn't have concentrations) is correct!

fs.writeFileSync(file, content);
