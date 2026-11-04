with open('frontend/src/app/features/quality/quality.component.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = '<div class="header-badge">MAKE IT RIGHT &middot; DATA QUALITY &amp; REMEDIATION</div>'
replacement = '<div class="breadcrumb-trail">Data quality &middot; Remediation</div>'

if target in text:
    text = text.replace(target, replacement)
    with open('frontend/src/app/features/quality/quality.component.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced header-badge in quality.component.html")
else:
    print("target not found")
