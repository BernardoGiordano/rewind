/**
 * The part of html2canvas-pro 2.0.2 the card export calls. The module beside this
 * file is the package's own ESM build, copied unchanged apart from its source map
 * comment. MIT licensed, see its header.
 */

export interface Html2CanvasOptions {
  scale: number;
  useCORS: boolean;
  backgroundColor: string | null;
  ignoreElements: (element: Element) => boolean;
  onclone: (document: Document, element: HTMLElement) => void | Promise<void>;
}

export default function html2canvas(
  element: HTMLElement,
  options?: Partial<Html2CanvasOptions>,
): Promise<HTMLCanvasElement>;
