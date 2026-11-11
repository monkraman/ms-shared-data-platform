import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Column, DataTableComponent } from './data-table.component';

interface Row {
  id: string;
  name: string;
  weight: number;
}

@Component({
  imports: [DataTableComponent],
  template: `<app-data-table [columns]="columns" [rows]="rows()" [loading]="loading()" [clickable]="true"
    [trackBy]="byId" (rowClick)="opened = $event" />`,
})
class HostComponent {
  columns: Column<Row>[] = [
    { key: 'name', label: 'Name', value: (r) => r.name },
    { key: 'weight', label: 'Weight', value: (r) => r.weight, align: 'end' },
  ];
  rows = signal<Row[]>([{ id: '1', name: 'Bottle', weight: 420 }]);
  loading = signal(false);
  opened: Row | null = null;
  byId = (r: Row) => r.id;
}

describe('DataTableComponent', () => {
  it('renders rows and opens one with the keyboard', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cells = [...el.querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['Bottle', '420']);
    el.querySelector('tbody tr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.opened?.id).toBe('1');
  });

  it('shows skeleton rows while loading', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tr.skeleton').length).toBe(3);
  });
});
