// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readBundle } from './i18n.js';

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholders a message uses, so a translation can't drop or rename one. */
const placeholders = (message: string) =>
  [...message.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

describe('the Italian bundle', () => {
  const en = readBundle('en');
  const it_ = readBundle('it');

  it('translates every English key and adds none', () => {
    expect(Object.keys(it_).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps every placeholder', () => {
    for (const [key, message] of Object.entries(en)) {
      expect(placeholders(it_[key] ?? ''), key).toEqual(placeholders(message));
    }
  });
});
