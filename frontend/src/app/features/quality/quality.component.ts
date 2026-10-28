import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityApiService, DataQualityIssue } from '../../core/services/quality-api.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.css',
})
export class QualityComponent implements OnInit {
  readonly qualityService = inject(QualityApiService);
  readonly tenantService = inject(TenantApiService);

  readonly issues = this.qualityService.issues;
  readonly selectedIssue = this.qualityService.selectedIssue;
  readonly loading = this.qualityService.loading;
  readonly worklistExport = this.qualityService.worklistExport;

  readonly activeSeverityFilter = signal<'ALL' | 'BLOCKER' | 'WARNING' | 'INFO'>('ALL');
  readonly proposing = signal<boolean>(false);
  readonly proposedValue = signal<string>('');
  readonly proposedJustification = signal<string>('');
  readonly dispatchSuccessMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.qualityService.loadIssues().subscribe();
  }

  selectIssue(issue: DataQualityIssue): void {
    this.qualityService.selectIssue(issue);
    this.dispatchSuccessMessage.set(null);
    this.proposedValue.set('');
    this.proposedJustification.set('');
  }

  filterBySeverity(sev: 'ALL' | 'BLOCKER' | 'WARNING' | 'INFO'): void {
    this.activeSeverityFilter.set(sev);
  }

  getFilteredIssues(): DataQualityIssue[] {
    const filter = this.activeSeverityFilter();
    if (filter === 'ALL') return this.issues();
    return this.issues().filter((i) => i.severity.toUpperCase() === filter);
  }

  submitCorrectionTicket(): void {
    const issue = this.selectedIssue();
    if (!issue || !this.proposedValue()) return;

    this.proposing.set(true);
    this.qualityService
      .proposeCorrection(
        issue.id,
        this.proposedValue(),
        this.proposedJustification() || 'Verified against packaging technical drawing'
      )
      .subscribe({
        next: () => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(
            `Correction Ticket dispatched to ${issue.source_spec_reference} in Trace One PLM.`
          );
        },
        error: () => this.proposing.set(false),
      });
  }

  exportWorklist(): void {
    this.qualityService.exportSourceWorklist().subscribe({
      next: (exportData) => {
        // Trigger browser JSON download for client PLM team
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Monkspaces_PLM_Worklist_${this.tenantService.activeTenantId()}_2026.json`;
        a.click();
      },
    });
  }
}
