with open('hanaz-customer/pdp-face-wash.html', encoding='utf-8') as f:
    fw = f.read()

old_fw = ('pdp-description-content">\n'
'                <p>HANAZ C-Active Brightening Cleanser & Face Wash contains 3% niacinamide and 1% sodium ascorbyl phosphate. Available in a 100 ml bottle.</p>\n'
'              </div>\n'
'            </div>')

new_fw = ('pdp-description-content">\n'
'                <p>Melt away dullness without compromising your skin barrier. '
'The HANAZ C-Active Brightening Cleanser &amp; Face Wash is a 100% sulfate and soap-free, non-comedogenic formula '
'designed for real, honest results. Powered by 3% Niacinamide and 1% Sodium Ascorbyl Phosphate (Vitamin C), '
'this gentle daily cleanser effectively lifts away excess oil, urban dust, and daily pollutants without clogging pores. '
'Infused with Jojoba Seed Oil to completely eliminate post-wash tightness, it cleanses deeply without stripping your natural moisture &mdash; '
'leaving your complexion instantly refreshed, balanced, and glowing. 100 ml.</p>\n'
'              </div>\n'
'            </div>')

if old_fw in fw:
    fw = fw.replace(old_fw, new_fw)
    print("FW description replaced OK")
else:
    print("FW description NOT found — checking nearby text")
    idx = fw.find('pdp-description-content')
    print(repr(fw[idx:idx+400]))

with open('hanaz-customer/pdp-face-wash.html', 'w', encoding='utf-8') as f:
    f.write(fw)
