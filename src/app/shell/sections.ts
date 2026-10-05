/** A top-level destination in the app's chrome, declared once and rendered by every navigation adapter. */
export interface Section {
  id: string;
  label: string;
  icon: string;

  /** Where the section's navigation entry points. */
  route: string;

  /** Extra URL prefixes this section owns, such as drill-down pages reached from it. */
  owns: string[];

  /** The Rewind date range applies to this section's data. */
  usesRange: boolean;

  /** Position in every adapter, low first. */
  order: number;
}

export const SECTIONS: readonly Section[] = [
  {
    id: 'library',
    label: 'Library',
    icon: 'heroRectangleStack',
    route: '/library',
    owns: [],
    usesRange: false,
    order: 10,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'heroChartPie',
    route: '/',
    owns: ['/artist'],
    usesRange: true,
    order: 20,
  },
];

/** The section owning a URL, matched on the longest prefix so drill-downs beat the root. */
export function sectionFor(url: string, sections: readonly Section[]): Section | null {
  const path = url.split(/[?#]/)[0];
  let best: Section | null = null;
  let bestLength = -1;

  for (const section of sections) {
    for (const prefix of [section.route, ...section.owns]) {
      if (prefix.length > bestLength && covers(prefix, path)) {
        best = section;
        bestLength = prefix.length;
      }
    }
  }

  return best;
}

function covers(prefix: string, path: string): boolean {
  if (prefix === '/') return path === '/' || path === '';
  return path === prefix || path.startsWith(prefix + '/');
}
