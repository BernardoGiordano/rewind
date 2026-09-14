/** The app's top-level sections, rendered by every Shell navigation adapter. */
export interface Section {
  id: string;
  label: string;
  route: string;
  icon: string;
  /** Match the URL exactly — needed for the root route. */
  exact: boolean;
}

export const SECTIONS: Section[] = [
  { id: 'rewind', label: 'Rewind', route: '/', icon: 'heroChartPie', exact: true },
  { id: 'library', label: 'Library', route: '/library', icon: 'heroRectangleStack', exact: false },
];
