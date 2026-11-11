/**
 * Sidebar navigation for platform screens. Each screen adds its entry when it ships;
 * an item shows only when the user has its permission (permissions come from the API).
 */
export interface NavItem {
  label: string;
  path: string;
  /** SVG path data for a 16px, 1.5-stroke icon. */
  icon: string;
  permission?: string;
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/app', icon: 'M3 7.5 8 3l5 4.5V13H3z', exact: true },
];
