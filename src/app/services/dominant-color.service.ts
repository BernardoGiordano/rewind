import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class DominantColorService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cache = new Map<string, Promise<string | null>>();

  gradientFor(url: string): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve(null);
    const cached = this.cache.get(url);
    if (cached) return cached;
    const p = this.extract(url).catch(() => null);
    this.cache.set(url, p);
    return p;
  }

  private extract(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const size = 32;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);

          let sumR = 0, sumG = 0, sumB = 0, n = 0;
          let bestScore = -1, vr = 0, vg = 0, vb = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 128) continue;
            sumR += r; sumG += g; sumB += b; n++;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const lum = (r + g + b) / 3;
            const score = sat * (1 - Math.abs(lum - 150) / 255);
            if (score > bestScore) { bestScore = score; vr = r; vg = g; vb = b; }
          }
          if (n === 0) return resolve(null);

          const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
          const lighten = (c: number, a: number) => Math.min(255, Math.round(c + (255 - c) * a));
          const darken = (c: number, a: number) => Math.max(0, Math.round(c * (1 - a)));
          const from = `rgb(${lighten(vr, 0.1)}, ${lighten(vg, 0.1)}, ${lighten(vb, 0.1)})`;
          const to = `rgb(${darken(avgR, 0.82)}, ${darken(avgG, 0.82)}, ${darken(avgB, 0.82)})`;
          resolve(`linear-gradient(to bottom right, ${from}, ${to})`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}
