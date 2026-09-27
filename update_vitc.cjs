const fs = require('fs');
const file = 'hanaz-customer/pdp-vitamin-c.html';
let content = fs.readFileSync(file, 'utf8');

// 1. H1
content = content.replace(/Hanaz Vitamin C Serum - 30 ml/g, 'Hanaz Vitamin C Serum — 30 ml');

// 2. Meta descriptions
content = content.replace(/<meta name="description" id="seo-desc" content="[^"]+">/, '<meta name="description" id="seo-desc" content="Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.">');
content = content.replace(/<meta property="og:description" id="seo-og-desc" content="[^"]+">/, '<meta property="og:description" id="seo-og-desc" content="Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.">');

// 3. Schema description
content = content.replace(/"description": "Shop the Hanaz Vitamin C Serum[^"]+",/, '"description": "Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.",');
content = content.replace(/const cleanDesc = "Shop the Hanaz Vitamin C Serum[^"]+";/, 'const cleanDesc = "Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.";');

// 4. Desktop description
content = content.replace(/<div id="pdp-description-content">\s*<p>.*?<\/p>\s*<\/div>/s, `<div id="pdp-description-content">
                <p>Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.</p>
              </div>`);

// 5. Mobile description
content = content.replace(/<div class="pdp-info-text-content" id="pdp-mobile-description-content">.*?<\/div>/s, '<div class="pdp-info-text-content" id="pdp-mobile-description-content">Hanaz Vitamin C Serum contains 5% 3-O-Ethyl Ascorbic Acid with glycerin, sodium hyaluronate and tocopherol. Available in a 30 ml bottle.</div>');

// 6. Ingredients
const newDesktopIng = `<div class="pdp-ingredient-list" id="pdp-ingredients-content">
                <p style="color: var(--text-muted); line-height: 1.6;">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</p>
              </div>`;
content = content.replace(/<div class="pdp-ingredient-list" id="pdp-ingredients-content">[\s\S]*?<\/div>\s*<\/div>/, newDesktopIng + '\n            </div>');
content = content.replace(/<h2>Key Ingredients<\/h2>/, '<h2>Full Ingredients</h2>');

const newMobileIng = `<div class="pdp-ingredient-list" id="pdp-mobile-ingredients-content">
                  <div class="pdp-info-text-content">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</div>
                </div>`;
content = content.replace(/<div class="pdp-ingredient-list" id="pdp-mobile-ingredients-content">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, newMobileIng + '\n              </div>\n            </div>');
content = content.replace(/<span class="pdp-info-acc-title">Key Ingredients<\/span>/, '<span class="pdp-info-acc-title">Full Ingredients</span>');

fs.writeFileSync(file, content);
