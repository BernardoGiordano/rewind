import { registerTemplateGlobals } from '@srljs/core';

import { formatDecimal, formatYearMonthWithYear, padHour } from './utils/format.js';

export { formatDecimal, formatYearMonthWithYear, padHour };

/**
 * `part` as a percentage of `whole`, for bar widths. Zero when `whole` is.
 *
 * @param {number} part
 * @param {number} whole
 * @returns {number}
 */
export function percentOf(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Formatters every template calls by bare name, as Angular templates call pipes.
 * srl registers `num` and `dt` itself.
 */
registerTemplateGlobals({
  decimal: formatDecimal,
  monthYear: formatYearMonthWithYear,
  padHour,
  percentOf,
});
