with open('frontend/src/app/features/dashboard/dashboard.component.css', 'r', encoding='utf-8') as f:
    css = f.read()

empty_css = """
/* ─── Forecast & Hotspots Empty State for New Clients ─── */
.forecast-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  background: #F8FAFC;
  border: 1px dashed #CBD5E1;
  border-radius: 12px;
  margin: 12px 0;
}

.empty-icon-shield {
  font-size: 32px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: #0F172A;
  margin: 0 0 6px 0;
}

.empty-desc {
  font-size: 13px;
  color: #64748B;
  max-width: 420px;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.btn-empty-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: #0F2447;
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 20px;
  text-decoration: none;
  transition: all 0.15s ease;
  box-shadow: 0 2px 5px rgba(15, 36, 71, 0.15);
}

.btn-empty-action:hover {
  background: #1E3A8A;
  transform: translateY(-1px);
}
"""

if '.forecast-empty-box' not in css:
    css += "\n" + empty_css
    with open('frontend/src/app/features/dashboard/dashboard.component.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added empty state CSS to dashboard.component.css")
else:
    print("Empty state CSS already exists")

