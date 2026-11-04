with open('frontend/src/app/features/quality/quality.component.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Update status mapping
code = code.replace(
    "if (iss.status === 'resolved') status = 'RESOLVED';",
    "if (iss.status === 'resolved' || iss.status === 'resolved_in_source') status = 'RESOLVED';"
)

# Update closeGapAction
target_action = """  closeGapAction(gapId: string): void {
    this.proposing.set(true);
    // Real API call to update backend database
    this.qualityService
      .proposeCorrection(gapId, 'Verified & Calibrated Spec', 'Validated against calibrated packaging technical drawing')
      .subscribe({
        next: () => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(`[DISPATCHED] Upstream change request ticket logged for ${gapId} in database.`);
          this.qualityService.loadIssues().subscribe();
        },
        error: () => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(`[UPDATED] Gap ${gapId} verified in local session.`);
        },
      });
  }"""

replacement_action = """  closeGapAction(gapId: string): void {
    this.proposing.set(true);
    // Real API call to resolve gap in database
    this.qualityService
      .resolveInSource(gapId)
      .subscribe({
        next: (resolved) => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(`[RESOLVED] Gap ${gapId} successfully closed and verified in master database!`);
          this.qualityService.loadIssues().subscribe();
          this.foundationService.loadProducts().subscribe();
          this.tenantService.loadTenants().subscribe();
        },
        error: () => {
          // Fallback to propose correction
          this.qualityService
            .proposeCorrection(gapId, 'Verified & Calibrated Spec', 'Validated against calibrated packaging technical drawing')
            .subscribe({
              next: () => {
                this.proposing.set(false);
                this.dispatchSuccessMessage.set(`[DISPATCHED] Upstream change request ticket logged for ${gapId} in database.`);
                this.qualityService.loadIssues().subscribe();
              },
              error: () => this.proposing.set(false),
            });
        },
      });
  }"""

if target_action in code:
    code = code.replace(target_action, replacement_action)
    with open('frontend/src/app/features/quality/quality.component.ts', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Successfully updated quality.component.ts")
else:
    print("Target action not found in quality.component.ts")
