/**
 * A top-level destination in the app's chrome, declared once and rendered by every
 * navigation adapter.
 *
 * @typedef {object} Section
 * @property {string} id
 * @property {string} labelKey
 * @property {string} icon
 * @property {string} route Where the section's navigation entry points.
 * @property {string[]} owns Extra URL prefixes this section owns, such as drill-down pages reached from it.
 * @property {boolean} usesRange The Rewind date range applies to this section's data.
 * @property {number} order Position in every adapter, low first.
 */

/** @type {readonly Section[]} */
export const SECTIONS = [
  {
    id: 'library',
    labelKey: 'nav.library',
    icon: 'heroRectangleStack',
    route: '/library',
    owns: [],
    usesRange: false,
    order: 10,
  },
  {
    id: 'analytics',
    labelKey: 'nav.analytics',
    icon: 'heroChartPie',
    route: '/',
    owns: ['/artist'],
    usesRange: true,
    order: 20,
  },
];

/**
 * The section owning a URL, matched on the longest prefix so drill-downs beat the root.
 *
 * @param {string} url
 * @param {readonly Section[]} sections
 * @returns {Section | null}
 */
export function sectionFor(url, sections) {
  const path = url.split(/[?#]/)[0] ?? '';
  /** @type {Section | null} */
  let best = null;
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

/** @param {string} prefix @param {string} path @returns {boolean} */
function covers(prefix, path) {
  if (prefix === '/') return path === '/' || path === '';
  return path === prefix || path.startsWith(prefix + '/');
}
