/**
 * Sidebar navigation for platform screens, in groups. Each screen adds its entry when it
 * ships; an item shows only when the user has its permission (from `GET /api/v1/auth/me`),
 * and a group shows only when it has visible items.
 */
export interface NavItem {
  label: string;
  path: string;
  /** SVG path data for a 16px, 1.5-stroke icon. */
  icon: string;
  permission?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      {
        label: 'Client workspaces',
        path: '/app/workspaces',
        permission: 'platform.tenants.read',
        icon: 'M2.5 14V3.5h7V14M9.5 6.5h4V14M4.5 6h3M4.5 8.5h3M4.5 11h3M1.5 14h13',
      },
      {
        label: 'Users',
        path: '/app/users',
        permission: 'platform.users.manage',
        icon: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M10.5 2.7a2.5 2.5 0 0 1 0 4.6M12 9.8c1.5.5 2.5 1.8 2.5 3.7',
      },
      {
        label: 'Data points',
        path: '/app/data-points',
        permission: 'platform.datapoints.read',
        icon: 'M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3',
      },
      {
        label: 'Gap rules',
        path: '/app/gap-rules',
        permission: 'platform.rules.manage',
        icon: 'M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4zM5.8 8l1.6 1.6 3.1-3.1',
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        label: 'Products',
        path: '/app/products',
        permission: 'products.read',
        icon: 'M8 1.5 14 4.5v7L8 14.5 2 11.5v-7zM2 4.5l6 3 6-3M8 7.5v7',
      },
      {
        label: 'Import',
        path: '/app/import',
        permission: 'imports.manage',
        icon: 'M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3',
      },
      {
        label: 'Data sources',
        path: '/app/data-sources',
        permission: 'imports.manage',
        icon: 'M8 2.5c3 0 5.5.9 5.5 2s-2.5 2-5.5 2-5.5-.9-5.5-2 2.5-2 5.5-2zM2.5 4.5v7c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-7M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
      },
      {
        label: 'Gaps',
        path: '/app/gaps',
        permission: 'gaps.read',
        icon: 'M8 2 14.5 13.5h-13zM8 6.5v3M8 11.5v.01',
      },
      {
        label: 'Data overview',
        path: '/app/data-overview',
        permission: 'data.read',
        icon: 'M2.5 13.5h11M4.5 11V7M8 11V4M11.5 11V8.5',
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        label: 'EPR and PPWR',
        path: '/app/compliance',
        permission: 'compliance.read',
        icon: 'M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4zM5.5 8.5h5M5.5 6h5M5.5 11h3',
      },
    ],
  },
];

/** Kept for code that wants a flat list. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
