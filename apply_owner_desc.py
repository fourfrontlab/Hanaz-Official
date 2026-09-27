import re

# ── Serum ─────────────────────────────────────────────────────────────────────
with open('hanaz-customer/pdp-vitamin-c.html', encoding='utf-8') as f:
    vc = f.read()

# 1. Desktop description — replace old marketing/clinical text with owner text
old_desc = (
    '<div id="pdp-description-content">\n'
    '                <p>Our premium Vitamin C Serum is formulated with 5% 3-O-Ethyl Ascorbic Acid to deliver visible results. '
    'This powerful antioxidant serum targets hyperpigmentation, fine lines, and dull skin while protecting against environmental damage. '
    'Backed by our <a href="cert-vitamin-c-serum.html" style="text-decoration: underline;">PCSIR dermal safety certification</a>, '
    'it provides clinical-grade brightening suitable for daily use.</p>\n'
    '              </div>'
)
new_desc = (
    '<div id="pdp-description-content">\n'
    '                <p>Unlock your skin\'s true, radiant potential without false promises. '
    'The HANAZ Vitamin C Brightening Serum is a precision-formulated, leave-on treatment designed for real, visible results. '
    'Powered by 5% 3-O-Ethyl Ascorbic Acid &mdash; an advanced, highly stable form of Vitamin C &mdash; '
    'this targeted formula penetrates deeply to fade dark spots, smooth fine lines, and neutralize daily environmental stressors. '
    'Enhanced with Sodium Hyaluronate to draw deep moisture into the skin and Tocopherol for antioxidant synergy, '
    'it delivers a bouncy, hydrated, and brilliantly luminous complexion. 30 ml.</p>\n'
    '              </div>'
)
vc = vc.replace(old_desc, new_desc)

# 2. Desktop Key Ingredients – rename Pure Vitamin E to Tocopherol (matches INCI)
vc = vc.replace(
    '<li><strong>Pure Vitamin E:</strong> Neutralizes deep oxidative stress and pollution.</li>',
    '<li><strong>Tocopherol (Vitamin E):</strong> Antioxidant synergy against environmental stressors.</li>'
)

# 3. Mobile description
vc = vc.replace(
    'id="pdp-mobile-description-content">The HANAZ Vitamin C Brightening Serum is powered by',
    'id="pdp-mobile-description-content">The HANAZ Vitamin C Brightening Serum is powered by'  # already done, no-op
)

# 4. Mobile Key Ingredients – fix Drows + Mohist
vc = vc.replace(
    '<div class="pdp-ingredient-name">Pure Vitamin E</div>\n                    <p class="pdp-ingredient-desc">Neutralizes deep oxidative stress and pollution.</p>',
    '<div class="pdp-ingredient-name">Tocopherol (Vitamin E)</div>\n                    <p class="pdp-ingredient-desc">Antioxidant synergy against environmental stressors.</p>'
)

# 5. FAQ 2 – remove Niacinamide claim (not in serum INCI)
vc = vc.replace(
    '<p>Yes. The formula contains stable Vitamin C (3-O-Ethyl Ascorbic Acid) and soothing Niacinamide, making it gentle for most\n                  skin types. We still recommend performing a patch test before first use.</p>',
    '<p>Yes. The formula contains stable 5% 3-O-Ethyl Ascorbic Acid. We still recommend a patch test before first use.</p>'
)

# 6. FAQ 5 – remove Niacinamide / Hyaluronic Acid / Ferulic Acid (not in serum INCI)
vc = vc.replace(
    '<p>The serum contains 5% Stable Vitamin C (3-O-Ethyl Ascorbic Acid), Niacinamide, Hyaluronic Acid, and Ferulic Acid to\n                  brighten, hydrate, and protect the skin.</p>',
    '<p>The serum contains 5% 3-O-Ethyl Ascorbic Acid (a highly stable Vitamin C), Sodium Hyaluronate, Tocopherol and Glycerin. '
    'Full INCI: AQUA / WATER &bull; 3-O-ETHYL ASCORBIC ACID &bull; GLYCERIN &bull; SODIUM HYALURONATE &bull; '
    'POLYSORBATE 20 &bull; TOCOPHEROL &bull; DISODIUM EDTA &bull; PHENOXYETHANOL.</p>'
)

with open('hanaz-customer/pdp-vitamin-c.html', 'w', encoding='utf-8') as f:
    f.write(vc)

print("Serum done. Changes made:")
print("  1. Desktop description -> owner-supplied long text with 'penetrates deeply'")
print("  2. Desktop Key Ingredients Pure Vitamin E -> Tocopherol")
print("  3. Mobile Key Ingredients Pure Vitamin E -> Tocopherol")
print("  4. FAQ 2: removed Niacinamide claim from serum")
print("  5. FAQ 5: removed Niacinamide/HA/Ferulic Acid; replaced with real INCI")

# ── Face Wash ─────────────────────────────────────────────────────────────────
with open('hanaz-customer/pdp-face-wash.html', encoding='utf-8') as f:
    fw = f.read()

# Face wash desktop description – replace brief single-line with owner long text
fw_old = (
    '<div id="pdp-description-content">\n'
    '                <p>HANAZ C-Active Brightening Cleanser &amp; Face Wash contains 3% niacinamide and 1% sodium ascorbyl phosphate. '
    'Available in a 100 ml bottle.</p>\n'
    '              </div>'
)
fw_new = (
    '<div id="pdp-description-content">\n'
    '                <p>Melt away dullness without compromising your skin barrier. '
    'The HANAZ C-Active Brightening Cleanser &amp; Face Wash is a 100% sulfate and soap-free, non-comedogenic formula '
    'designed for real, honest results. Powered by 3% Niacinamide and 1% Sodium Ascorbyl Phosphate (Vitamin C), '
    'this gentle daily cleanser effectively lifts away excess oil, urban dust, and daily pollutants without clogging pores. '
    'Infused with Jojoba Seed Oil to completely eliminate post-wash tightness, it cleanses deeply without stripping your natural moisture &mdash; '
    'leaving your complexion instantly refreshed, balanced, and glowing. 100 ml.</p>\n'
    '              </div>'
)
fw = fw.replace(fw_old, fw_new)

# Mobile description
fw = fw.replace(
    'id="pdp-mobile-description-content">HANAZ C-Active Brightening Cleanser & Face Wash contains 3% niacinamide and 1% sodium ascorbyl phosphate. Available in a 100 ml bottle.</div>',
    'id="pdp-mobile-description-content">The HANAZ C-Active Brightening Cleanser is a sulfate-free, non-comedogenic formula with 3% Niacinamide and 1% Sodium Ascorbyl Phosphate. Jojoba Seed Oil completely eliminates post-wash tightness. 100 ml.</div>'
)

with open('hanaz-customer/pdp-face-wash.html', 'w', encoding='utf-8') as f:
    f.write(fw)

print("\nFace Wash done. Changes made:")
print("  1. Desktop description -> owner-supplied long text with non-comedogenic, penetrates deeply, eliminate post-wash tightness")
print("  2. Mobile description -> concise owner-confirmed version")
