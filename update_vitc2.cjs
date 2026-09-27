const fs = require('fs');
const file = 'hanaz-customer/pdp-vitamin-c.html';
let content = fs.readFileSync(file, 'utf8');

const newDesktopIng = `<div class="pdp-ingredient-list" id="pdp-ingredients-content">
                <ul style="list-style: disc; margin-left: 20px; line-height: 1.6; color: var(--text-muted);">
                  <li><strong>5% 3-O-Ethyl Ascorbic Acid:</strong> Fades dark spots & boosts deep radiance.</li>
                  <li><strong>Sodium Hyaluronate:</strong> Draws moisture deep to plump and smooth.</li>
                  <li><strong>Pure Vitamin E:</strong> Neutralizes deep oxidative stress and pollution.</li>
                  <li><strong>Glycerin:</strong> Locks in essential moisture for a soft, non-sticky finish.</li>
                </ul>
              </div>
            </div>

            <!-- Full Ingredients -->
            <div class="pdp-desc-block" id="pdp-block-full-ingredients">
              <h2 class="pdp-desc-title">Full Ingredients</h2>
              <div id="pdp-full-ingredients-content">
                <p style="color: var(--text-muted); line-height: 1.6;">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</p>
              </div>`;

content = content.replace(/<div class="pdp-ingredient-list" id="pdp-ingredients-content">[\s\S]*?<\/div>\s*<\/div>/, newDesktopIng + '\n            </div>');

// Remove the incorrect change from earlier if it existed
content = content.replace(/<h2>Full Ingredients<\/h2>/, '<h2>Key Ingredients</h2>');

const newMobileIng = `<div class="pdp-ingredient-list" id="pdp-mobile-ingredients-content">
                  <div class="pdp-ingredient-item">
                    <div class="pdp-ingredient-name">5% 3-O-Ethyl Ascorbic Acid</div>
                    <p class="pdp-ingredient-desc">Fades dark spots & boosts deep radiance.</p>
                  </div>
                  <div class="pdp-ingredient-item">
                    <div class="pdp-ingredient-name">Sodium Hyaluronate</div>
                    <p class="pdp-ingredient-desc">Draws moisture deep to plump and smooth.</p>
                  </div>
                  <div class="pdp-ingredient-item">
                    <div class="pdp-ingredient-name">Pure Vitamin E</div>
                    <p class="pdp-ingredient-desc">Neutralizes deep oxidative stress and pollution.</p>
                  </div>
                  <div class="pdp-ingredient-item">
                    <div class="pdp-ingredient-name">Glycerin</div>
                    <p class="pdp-ingredient-desc">Locks in essential moisture for a soft, non-sticky finish.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Full Ingredients -->
          <div class="pdp-info-acc-item" id="pdp-acc-full-ingredients">
            <button class="pdp-info-acc-header" aria-expanded="false" type="button">
              <span class="pdp-info-acc-title">Full Ingredients</span>
              <span class="pdp-info-acc-icon" aria-hidden="true">+</span>
            </button>
            <div class="pdp-info-acc-body">
              <div class="pdp-info-acc-inner">
                <div class="pdp-info-text-content" id="pdp-mobile-full-ingredients-content">AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL</div>
              </div>`;

content = content.replace(/<div class="pdp-ingredient-list" id="pdp-mobile-ingredients-content">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/, newMobileIng + '\n            </div>\n          </div>');

content = content.replace(/<span class="pdp-info-acc-title">Full Ingredients<\/span>/, '<span class="pdp-info-acc-title">Key Ingredients</span>');
// But the replace above replaces the first one, let's just make sure it's correct.
// Wait, I will just checkout pdp-vitamin-c.html again to a clean state, and run a fresh script.
