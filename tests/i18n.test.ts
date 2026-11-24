// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readBundle } from './i18n.js';

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholders a message uses, so a translation can't drop or rename one. */
const placeholders = (message: string) =>
  [...message.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

const TRANSLATIONS = [
  ['Italian', 'it'],
  ['Spanish', 'es'],
] as const;

describe.each(TRANSLATIONS)('the %s bundle', (_name, locale) => {
  const en = readBundle('en');
  const bundle = readBundle(locale);

  it('translates every English key and adds none', () => {
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps every placeholder', () => {
    for (const [key, message] of Object.entries(en)) {
      expect(placeholders(bundle[key] ?? ''), key).toEqual(placeholders(message));
    }
  });
});
