import re

content = open('hanaz-customer/pdp-face-wash.html', encoding='utf-8').read()

# Find ALL meta description tags
print("=== META DESCRIPTION TAGS ===")
for m in re.finditer(r'<meta[^>]+name=["\']description["\'][^>]*>', content, re.IGNORECASE):
    line = content[:m.start()].count('\n') + 1
    print(f"  Line {line}: {m.group()}")

print()
print("=== OG:DESCRIPTION TAGS ===")
for m in re.finditer(r'<meta[^>]+og:description[^>]*>', content, re.IGNORECASE):
    line = content[:m.start()].count('\n') + 1
    print(f"  Line {line}: {m.group()}")

print()
print("=== JS seo-desc references ===")
for m in re.finditer(r'seo-desc[^\n]{0,200}', content):
    line = content[:m.start()].count('\n') + 1
    print(f"  Line {line}: {m.group()[:200]}")

print()
print("=== JS setAttribute on description ===")
for m in re.finditer(r'setAttribute\s*\(["\']content["\'][^\n]{0,200}', content):
    line = content[:m.start()].count('\n') + 1
    print(f"  Line {line}: {m.group()[:200]}")
