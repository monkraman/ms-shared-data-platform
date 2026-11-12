/**
 * Sidebar navigation for platform screens, in groups. An item shows only when the user has
 * its permission (from `GET /api/v1/auth/me`), and a group only when it has visible items.
 * Module features use `module.<id>` permissions, which come from the workspace's modules,
 * so switching a module off in Client workspaces removes its screens for that client.
 */
export interface NavItem {
  label: string;
  path: string;
  /** SVG path data for a 16px, 1.5-stroke icon. */
  icon: string;
  /** Shown when the user has this permission, or any of them when it is a list. */
  permission?: string | string[];
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
        label: 'Data explorer',
        path: '/app/data-explorer',
        permission: 'platform.datapoints.read',
        icon: 'M2 3.5h4v3H2zM10 2h4v3h-4zM10 11h4v3h-4zM6 5h2v7.5h2M8 3.5h2',
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
    label: 'Overview',
    items: [
      {
        label: 'Setup',
        path: '/app/setup',
        permission: ['imports.manage', 'users.manage'],
        icon: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        label: 'Data collection',
        path: '/app/data',
        permission: ['data.read', 'imports.manage'],
        icon: 'M8 2.5c3 0 5.5.9 5.5 2s-2.5 2-5.5 2-5.5-.9-5.5-2 2.5-2 5.5-2zM2.5 4.5v7c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-7M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
      },
      {
        label: 'Data gaps',
        path: '/app/gaps',
        permission: 'gaps.read',
        icon: 'M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 10l3.5 3.5',
      },
      {
        label: 'Data validation',
        path: '/app/validation',
        permission: 'products.read',
        icon: 'M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4zM5.8 8l1.6 1.6 3.1-3.1',
      },
      {
        label: 'SKU library',
        path: '/app/products',
        permission: 'products.read',
        icon: 'M8 1.5 14 4.5v7L8 14.5 2 11.5v-7zM2 4.5l6 3 6-3M8 7.5v7',
      },
    ],
  },
  {
    label: 'Comply',
    items: [
      {
        label: 'Compliance',
        path: '/app/compliance',
        permission: 'compliance.read',
        icon: 'M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3M6 8h5M6 10.5h5',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Hotspots',
        path: '/app/insights',
        permission: 'module.epr',
        icon: 'M2.5 13.5h11M4.5 11V7M8 11V4M11.5 11V8.5',
      },
      {
        label: 'Scenarios',
        path: '/app/scenarios',
        permission: 'module.epr',
        icon: 'M8 1.5 14.5 8 8 14.5 1.5 8z',
      },
      {
        label: 'Horizon scanning',
        path: '/app/horizon',
        permission: 'compliance.read',
        icon: 'M1.5 11.5h13M3.5 11.5a4.5 4.5 0 0 1 9 0M8 2v2M3.4 4.4l1.4 1.4M12.6 4.4l-1.4 1.4',
      },
      {
        label: 'Actions',
        path: '/app/actions',
        permission: 'compliance.read',
        icon: 'M3 3.5h10v9H3zM5.5 6.5l1.2 1.2 2.3-2.3M5.5 10h5',
      },
    ],
  },
];

/** Kept for code that wants a flat list. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
