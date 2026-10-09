import { readFileSync } from 'node:fs';
import type { I18n } from '../web/src/models/types.js';

/**
 * A bundle from `web/i18n`, flattened the way srl flattens it at runtime. Keys starting
 * with `$` are translator notes and are dropped.
 */
export function readBundle(locale: string): Record<string, string> {
  const raw = JSON.parse(
    readFileSync(new URL(`../web/i18n/${locale}.json`, import.meta.url), 'utf8'),
  );
  const flat: Record<string, string> = {};
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') flat[path] = value;
      else walk(value as Record<string, unknown>, path);
    }
  };
  walk(raw, '');
  return flat;
}

/** srl's `t` over one bundle, for code that takes an {@link I18n}. */
export function bundleI18n(locale: string): I18n {
  const table = readBundle(locale);
  const plural = new Intl.PluralRules(locale);
  return {
    locale,
    t(key, params) {
      const count = params?.['count'];
      const pattern =
        (typeof count === 'number'
          ? (table[`${key}.${plural.select(count)}`] ?? table[`${key}.other`])
          : undefined) ?? table[key];
      if (pattern === undefined) return key;
      return pattern.replace(/\{(\w+)\}/g, (all, name: string) => {
        const value = params?.[name];
        if (value === undefined) return all;
        return typeof value === 'number'
          ? new Intl.NumberFormat(locale).format(value)
          : String(value);
      });
    },
  };
}
