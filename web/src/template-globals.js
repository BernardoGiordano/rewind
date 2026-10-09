import { locale, num, registerTemplateGlobals, t } from '@srljs/core';

import { formatDayName, formatYearMonthWithYear, padHour } from './utils/format.js';

export { padHour };

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
 * A number with between `minFraction` and `maxFraction` fraction digits.
 *
 * @param {number} value
 * @param {number} minFraction
 * @param {number} maxFraction
 * @returns {string}
 */
export function decimal(value, minFraction, maxFraction) {
  return num(value, { minimumFractionDigits: minFraction, maximumFractionDigits: maxFraction });
}

/**
 * A percentage given out of 100, such as `12.5%`.
 *
 * @param {number} value
 * @param {number} minFraction
 * @param {number} maxFraction
 * @returns {string}
 */
export function percent(value, minFraction, maxFraction) {
  return num(value / 100, {
    style: 'percent',
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });
}

/**
 * A duration in minutes with its unit, such as `12.5m`.
 *
 * @param {number} value
 * @param {number} [minFraction]
 * @param {number} [maxFraction]
 * @returns {string}
 */
export function minutes(value, minFraction = 1, maxFraction = 1) {
  return t('units.minutes', { value: decimal(value, minFraction, maxFraction) });
}

/**
 * A duration in hours with its unit, such as `3.2h`.
 *
 * @param {number} value
 * @param {number} [minFraction]
 * @param {number} [maxFraction]
 * @returns {string}
 */
export function hours(value, minFraction = 1, maxFraction = 1) {
  return t('units.hours', { value: decimal(value, minFraction, maxFraction) });
}

/**
 * A decade the API names by its first year, such as `1990s`.
 *
 * @param {number | string} start
 * @returns {string}
 */
export function decade(start) {
  return t('units.decade', { decade: String(start) });
}

/**
 * `"2025-01"` as `"Jan 25"`.
 *
 * @param {string} yearMonth
 * @returns {string}
 */
export function monthYear(yearMonth) {
  return formatYearMonthWithYear(yearMonth, locale.value);
}

/**
 * A day name the API sent, such as `Monday`, in the active language.
 *
 * @param {string} name
 * @returns {string}
 */
export function weekday(name) {
  return formatDayName(name, locale.value);
}

/**
 * A day name the API sent, abbreviated, such as `Mon`.
 *
 * @param {string} name
 * @returns {string}
 */
export function weekdayShort(name) {
  return formatDayName(name, locale.value, true);
}

/**
 * Helpers every template calls by bare name, as Angular templates call pipes. srl
 * registers `t`, `num` and `dt` itself. Each reads `locale`, so a template that calls
 * one renders again when the language changes.
 */
registerTemplateGlobals({
  decimal,
  percent,
  minutes,
  hours,
  decade,
  monthYear,
  weekday,
  weekdayShort,
  padHour,
  percentOf,
});
