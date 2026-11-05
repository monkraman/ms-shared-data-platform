import os

# 1. Update styles.css with Global Design Token cascade & Toast CSS
path_styles = 'frontend/src/styles.css'
with open(path_styles, 'r', encoding='utf-8') as f:
    styles = f.read()

token_addition = '''
/* ─── Global Tenant Design Token Cascade (Single Source of Truth) ─── */
:root {
  --client-theme-accent: #09090b;
}

.app-layout {
  --brand-primary: var(--client-theme-accent, #09090b);
  --btn-primary-bg: var(--client-theme-accent, #09090b);
  --accent-color: var(--client-theme-accent, #09090b);
}

/* Universal Primary CTA Buttons bound to Tenant Brand Accent */
.btn-primary,
button.btn-primary,
.btn-board-pack,
.btn-resolve,
.btn-resolve-main,
.simulate-action-btn,
.btn-defra,
.btn-empty-action {
  background-color: var(--client-theme-accent, var(--btn-primary-bg, #09090b)) !important;
  color: #ffffff !important;
  border: 1px solid transparent !important;
  transition: all var(--transition-fast) !important;
}

.btn-primary:hover,
button.btn-primary:hover,
.btn-board-pack:hover,
.btn-resolve:hover,
.btn-resolve-main:hover,
.simulate-action-btn:hover,
.btn-defra:hover,
.btn-empty-action:hover {
  filter: brightness(0.88);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18) !important;
}

/* Active Segment Pills & Toggle Tabs bound to Tenant Brand Accent */
.mode-btn.active,
.subview-tab-btn.active,
.tab-btn.active,
.preset-btn.active {
  background-color: var(--client-theme-accent, #09090b) !important;
  color: #ffffff !important;
  border-color: var(--client-theme-accent, #09090b) !important;
}

/* Form Checkbox Accent */
input[type="checkbox"]:checked {
  accent-color: var(--client-theme-accent, #09090b);
}

/* ─── Global Enterprise Toast Notification ─── */
.global-toast-container {
  position: fixed;
  bottom: 24px;
  right: 28px;
  z-index: 99999;
  display: flex;
  align-items: stretch;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e4e4e7);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  min-width: 320px;
  max-width: 460px;
  animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toastSlideIn {
  from {
    transform: translateY(20px) scale(0.96);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.toast-accent-bar {
  width: 5px;
  flex-shrink: 0;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  width: 100%;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-message {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #09090b);
  line-height: 1.4;
  flex: 1;
}

.btn-toast-dismiss {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-muted, #71717a);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color var(--transition-fast);
}

.btn-toast-dismiss:hover {
  color: var(--text-primary, #09090b);
}
'''

if 'Global Tenant Design Token Cascade' not in styles:
    styles += token_addition
    with open(path_styles, 'w', encoding='utf-8') as f:
        f.write(styles)
    print('styles.css updated with design tokens & toast css')
else:
    print('styles.css already has design tokens')

