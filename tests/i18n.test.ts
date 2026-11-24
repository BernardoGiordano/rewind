// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBundle } from './i18n.js';

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholders a message uses, so a translation can't drop or rename one. */
const placeholders = (message: string) =>
  [...message.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

/** Every locale the app ships besides English, so a new one is checked without editing this file. */
const TRANSLATIONS: string[] = JSON.parse(
  readFileSync(new URL('../web/app.manifest.json', import.meta.url), 'utf8'),
).i18n.supportedLocales.filter((locale: string) => locale !== 'en');

it('ships at least one translation', () => {
  expect(TRANSLATIONS.length).toBeGreaterThan(0);
});

describe.each(TRANSLATIONS)('the %s bundle', (locale) => {
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
