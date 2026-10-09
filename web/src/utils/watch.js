import { effect } from '@srljs/core';

/**
 * Run `fn` as an effect until `owner` disconnects. Call it from `connectedCallback`, so
 * a reconnected element starts it again.
 *
 * @param {{ lifetime: AbortSignal }} owner
 * @param {() => void | (() => void)} fn
 */
export function watch(owner, fn) {
  owner.lifetime.addEventListener('abort', effect(fn), { once: true });
}
