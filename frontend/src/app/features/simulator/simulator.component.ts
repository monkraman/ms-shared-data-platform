import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EprApiService, CalculationRunResponse, ScenarioSimulationResponse } from '../../core/services/epr-api.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulator.component.html',
  styleUrl: './simulator.component.css',
})
export class SimulatorComponent implements OnInit {
  readonly eprService = inject(EprApiService);
  readonly tenantService = inject(TenantApiService);

  readonly calculationResult = this.eprService.calculationResult;
  readonly simulationResult = this.eprService.simulationResult;
  readonly calculating = this.eprService.calculating;
  readonly loading = this.eprService.loading;

  // Simulator Controls
  readonly targetPcrPercentage = signal<number>(30);
  readonly eliminateCompositeMalus = signal<boolean>(true);
  readonly selectedJurisdiction = signal<string>('FR-CITEO-2025');

  readonly availableRuleSets = [
    { id: 'FR-CITEO-2025', name: 'France CITEO (Approved 2025 Tariffs)', currency: 'EUR' },
    { id: 'GB-DEFRA-2025', name: 'UK Defra RPD (EPR Waste Regulations)', currency: 'GBP' },
  ];

  ngOnInit(): void {
    this.runBaselineCalculation();
    this.runSimulation();
  }

  runBaselineCalculation(): void {
    this.eprService.runCalculation(this.selectedJurisdiction()).subscribe();
  }

  onPcrSliderChange(newPcr: number): void {
    this.targetPcrPercentage.set(newPcr);
    this.runSimulation();
  }

  toggleComposites(eliminate: boolean): void {
    this.eliminateCompositeMalus.set(eliminate);
    this.runSimulation();
  }

  runSimulation(): void {
    this.eprService
      .simulateScenario(this.targetPcrPercentage(), this.eliminateCompositeMalus())
      .subscribe();
  }

  formatCurrency(value: number, curr = 'EUR'): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(value);
  }

  exportDefraRpdCsv(): void {
    // Generates valid UK Defra RPD CSV submission matching reference-docs-teams/packaging_data_example_file_2025_LP_submission_v4.csv
    const headers = [
      'Organisation ID',
      'Reporting Period',
      'Packaging Activity',
      'Packaging Type',
      'Packaging Class',
      'Material',
      'Weight (kg)',
      'Waste Type',
    ];

    const rows = [
      ['100004', '2025-H1', 'Brand Owner', 'Primary', 'Household', 'Plastic (PET)', '38420.5', 'Household'],
      ['100004', '2025-H1', 'Brand Owner', 'Primary', 'Household', 'Plastic (PP)', '5210.0', 'Household'],
      ['100004', '2025-H1', 'Brand Owner', 'Secondary', 'Non-Household', 'Paper/Cardboard', '12400.0', 'Commercial'],
      ['100004', '2025-H1', 'Brand Owner', 'Primary', 'Household', 'Steel/Tinplate', '41200.0', 'Household'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `UK_DEFRA_RPD_2025_SUBMISSION_${this.tenantService.activeTenantId()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
