with open('frontend/src/app/features/data-overview/data-overview.component.css', 'r', encoding='utf-8') as f:
    css = f.read()

flowchart_css = """
/* ─── Modern Breadcrumbs & View Toggle Controls ─── */
.breadcrumb-trail {
  font-size: 13px;
  color: #64748B;
  margin-bottom: 6px;
  font-weight: 500;
}

.view-toggle-group {
  display: inline-flex;
  background: #EEF2F6;
  padding: 3px;
  border-radius: 24px;
  border: 1px solid #E2E8F0;
  gap: 3px;
}

.btn-toggle {
  padding: 6px 14px;
  border-radius: 20px;
  border: none;
  background: transparent;
  font-size: 12.5px;
  font-weight: 600;
  color: #64748B;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-toggle:hover {
  color: #0F172A;
}

.btn-toggle.active {
  background: #0F2447;
  color: #FFFFFF;
  box-shadow: 0 2px 5px rgba(15, 36, 71, 0.15);
}

.btn-sync {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 12.5px;
  font-weight: 600;
  color: #0F172A;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease;
}

.btn-sync:hover {
  background: #F8FAFC;
  border-color: #CBD5E1;
}

/* ─── Embedded Flowchart Explorer & Frame ─── */
.flowchart-container-section {
  margin-top: 24px;
}

.flowchart-frame-wrapper {
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #E2E8F0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  background: #FFFFFF;
}

.flowchart-embedded-frame {
  width: 100%;
  height: 820px;
  border: none;
  display: block;
}

/* ─── How Each Source Reaches Us (Bottom 4 Cards) ─── */
.sources-reaches-section {
  margin-top: 32px;
}

.sources-reaches-section .section-title {
  font-size: 16px;
  font-weight: 700;
  color: #0F172A;
  margin: 0 0 14px 0;
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.source-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.source-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #0F172A;
}

.source-count {
  font-size: 11px;
  color: #64748B;
  font-weight: 600;
}

.source-mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #E6F8EE;
  color: #0E7A3E;
  padding: 3px 9px;
  border-radius: 9999px;
  margin-bottom: 10px;
  align-self: flex-start;
}

.source-mode-pill.portal {
  background: #FEF3C7;
  color: #D97706;
}

.source-mode-pill.internal {
  background: #F1F5F9;
  color: #475569;
}

.dot-live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
}

.dot-amber {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F59E0B;
}

.dot-neutral {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748B;
}

.source-desc {
  font-size: 12px;
  color: #64748B;
  line-height: 1.45;
}

@media (max-width: 1024px) {
  .sources-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .sources-grid {
    grid-template-columns: 1fr;
  }
}
"""

if '.flowchart-embedded-frame' not in css:
    css += "\n" + flowchart_css
    with open('frontend/src/app/features/data-overview/data-overview.component.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added flowchart CSS successfully")
else:
    print("Flowchart CSS already exists")
