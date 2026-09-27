const fs = require('fs');

function updateVitC() {
  const file = 'hanaz-customer/pdp-vitamin-c.html';
  let content = fs.readFileSync(file, 'utf8');

  // H1
  content = content.replace(/<h1 id="pdp-title">Hanaz Vitamin C Serum - 30 ml<\/h1>/, '<h1 id="pdp-title">Hanaz Vitamin C Serum — 30 ml</h1>');
  content = content.replace(/<span id="pdp-breadcrumb-title">Hanaz Vitamin C Serum<\/span>/, '<span id="pdp-breadcrumb-title">Hanaz Vitamin C Serum</span>'); // no change needed

  // Descriptions
  const exactDesc = "Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.";
  content = content.replace(/content="Shop the Hanaz Vitamin C Serum[^"]+"/g, `content="${exactDesc}"`);
  content = content.replace(/"description": "Shop the Hanaz Vitamin C Serum[^"]+"/, `"description": "${exactDesc}"`);
  content = content.replace(/const cleanDesc = "Shop the Hanaz Vitamin C Serum[^"]+";/, `const cleanDesc = "${exactDesc}";`);
  content = content.replace(/<p>Our premium Vitamin C Serum is formulated[^<]+<\/a>[^<]+<\/p>/, `<p>${exactDesc}</p>`);
  content = content.replace(/<div class="pdp-info-text-content" id="pdp-mobile-description-content">Our premium Vitamin C Serum[^<]+<a[^>]+>[^<]+<\/a>[^<]+<\/div>/, `<div class="pdp-info-text-content" id="pdp-mobile-description-content">${exactDesc}</div>`);

  // Ingredients (Fix typos and remove unsupported claims)
  content = content.replace(/Drows moisture/, 'Draws moisture');
  content = content.replace(/Mohist Glycerin/, 'Glycerin');
  content = content.replace(/<p[^>]*>Fragrance-free, paraben-free\. Dermatologist and PCSIR tested\.<\/p>/, '');

  // Add Full Ingredients Desktop
  const fullIngDesktop = `
            <!-- 3. Full Ingredients -->
            <div class="pdp-desc-block" id="pdp-block-full-ingredients">
              <h2 class="pdp-desc-title">Full Ingredients</h2>
              <div id="pdp-full-ingredients-content">
                <p style="color: var(--text-muted); line-height: 1.6;">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</p>
              </div>
            </div>`;
  content = content.replace(/(<div class="pdp-desc-block" id="pdp-block-ingredients">[\s\S]*?<\/div>\s*<\/div>)/, `$1\n${fullIngDesktop}`);

  // Add Full Ingredients Mobile
  const fullIngMobile = `
          <!-- 3. Full Ingredients -->
          <div class="pdp-info-acc-item" id="pdp-acc-full-ingredients">
            <button class="pdp-info-acc-header" aria-expanded="false" type="button">
              <span class="pdp-info-acc-title">Full Ingredients</span>
              <span class="pdp-info-acc-icon" aria-hidden="true">+</span>
            </button>
            <div class="pdp-info-acc-body">
              <div class="pdp-info-acc-inner">
                <div class="pdp-info-text-content" id="pdp-mobile-full-ingredients-content">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</div>
              </div>
            </div>
          </div>`;
  content = content.replace(/(<div class="pdp-info-acc-item" id="pdp-acc-ingredients">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/, `$1\n${fullIngMobile}`);

  fs.writeFileSync(file, content);
}

function updateFaceWash() {
  const file = 'hanaz-customer/pdp-face-wash.html';
  let content = fs.readFileSync(file, 'utf8');

  // H1
  content = content.replace(/<h1 id="pdp-title">Hanaz Vitamin C Face Cleanser - 100 ml<\/h1>/, '<h1 id="pdp-title">HANAZ C-Active Brightening Cleanser & Face Wash — 100 ml</h1>');
  
  // Also update breadcrumb name to match H1 or confirmed name
  content = content.replace(/<span id="pdp-breadcrumb-title">Hanaz Vitamin C Face Cleanser<\/span>/, '<span id="pdp-breadcrumb-title">HANAZ C-Active Brightening Cleanser & Face Wash</span>');

  // Descriptions
  const exactDesc = "HANAZ C-Active Brightening Cleanser & Face Wash contains 3% niacinamide and 1% sodium ascorbyl phosphate. Available in a 100 ml bottle.";
  content = content.replace(/content="Melt away dullness[^"]+"/g, `content="${exactDesc}"`);
  content = content.replace(/"description": "Melt away dullness[^"]+"/, `"description": "${exactDesc}"`);
  content = content.replace(/const cleanDesc = "Melt away dullness[^"]+";/, `const cleanDesc = "${exactDesc}";`);
  content = content.replace(/<div id="pdp-description-content">\s*<p>Melt away dullness[^<]+<\/p>\s*<\/div>/, `<div id="pdp-description-content">\n                <p>${exactDesc}</p>\n              </div>`);
  content = content.replace(/<div class="pdp-info-text-content" id="pdp-mobile-description-content">Melt away dullness[^<]+<\/div>/, `<div class="pdp-info-text-content" id="pdp-mobile-description-content">${exactDesc}</div>`);
  content = content.replace(/description: 'Melt away dullness[^']+'/, `description: '${exactDesc}'`);

  fs.writeFileSync(file, content);
}

updateVitC();
updateFaceWash();
console.log('Update script completed successfully.');
