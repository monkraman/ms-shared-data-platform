# Update app.html
with open('frontend/src/app/app.html', 'r', encoding='utf-8') as f:
    html = f.read()

target = """        @if (openGapsCount() > 0) {
        <span class="nav-badge-pill">[{{ openGapsCount() }} Gaps]</span>
        }"""

replacement = """        @if (openGapsCount() > 0) {
        <span class="nav-badge-count">{{ openGapsCount() }}</span>
        }"""

if target in html:
    html = html.replace(target, replacement)
    with open('frontend/src/app/app.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated app.html badge count")
else:
    print("app.html target not found")

# Update app.css
with open('frontend/src/app/app.css', 'r', encoding='utf-8') as f:
    css = f.read()

badge_css = """
.nav-badge-count {
  background: #E02725;
  color: #FFFFFF;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  min-width: 18px;
  text-align: center;
  line-height: 16px;
  margin-left: auto;
}
"""

if '.nav-badge-count' not in css:
    css += "\n" + badge_css
    with open('frontend/src/app/app.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added .nav-badge-count to app.css")
