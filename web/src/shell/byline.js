import { defineComponent, SignalElement } from '@srljs/core';

import { AppIcon } from '../components/icon/icon.js';

/** Author credit. Declared once and rendered wherever the chrome has room for it. */
export class AppByline extends SignalElement {}

await defineComponent({ tag: 'app-byline', element: AppByline, module: import.meta.url, uses: [AppIcon] });
