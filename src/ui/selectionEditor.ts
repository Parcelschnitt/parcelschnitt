/**
 * Selection frame over a page image: drag to move, drag a corner to resize, arrow keys to
 * move (Shift: larger steps). Positions are set through the CSSOM (`style.setProperty`),
 * which the CSP allows, never through style attributes.
 */
import {
  moveBox,
  resizeBox,
  toPercent,
  type Box,
  type Handle,
  type PageSize,
} from './selection.ts';

const KEY_STEP_PT = 72 / 25.4; // 1 mm
const KEY_STEP_LARGE_PT = KEY_STEP_PT * 10;
const HANDLES: readonly Handle[] = ['nw', 'ne', 'sw', 'se'];

type Drag = { kind: 'move' } | { kind: 'resize'; handle: Handle };

export class SelectionEditor {
  private readonly canvas: HTMLCanvasElement;
  private readonly frame: HTMLDivElement;
  private page: PageSize = { widthPt: 1, heightPt: 1 };
  private current: Box = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private drag: { mode: Drag; startX: number; startY: number; startBox: Box } | null = null;
  private readonly onChange: (box: Box) => void;
  private readonly onCommit: (box: Box) => void;

  /**
   * @param onChange called while the frame changes
   * @param onCommit called when an edit is finished (pointer released, key pressed)
   */
  constructor(
    container: HTMLElement,
    frameLabel: string,
    onChange: (box: Box) => void,
    onCommit: (box: Box) => void,
  ) {
    this.onChange = onChange;
    this.onCommit = onCommit;
    const stage = document.createElement('div');
    stage.className = 'selection-stage';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');

    this.frame = document.createElement('div');
    this.frame.className = 'selection-frame';
    this.frame.tabIndex = 0;
    this.frame.setAttribute('role', 'group');
    this.frame.setAttribute('aria-label', frameLabel);
    for (const handle of HANDLES) {
      const knob = document.createElement('div');
      knob.className = `selection-handle ${handle}`;
      knob.dataset['handle'] = handle;
      this.frame.append(knob);
    }
    stage.append(this.canvas, this.frame);
    container.replaceChildren(stage);

    this.frame.addEventListener('pointerdown', this.onPointerDown);
    this.frame.addEventListener('keydown', this.onKeyDown);
  }

  setLabel(frameLabel: string): void {
    this.frame.setAttribute('aria-label', frameLabel);
  }

  /** Shows a page image (the bitmap stays usable: it is drawn, not transferred). */
  setPage(bitmap: ImageBitmap, page: PageSize, box: Box): void {
    this.page = page;
    this.canvas.width = bitmap.width;
    this.canvas.height = bitmap.height;
    this.canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    this.setBox(box);
  }

  setBox(box: Box): void {
    this.current = box;
    const p = toPercent(box, this.page);
    this.frame.style.setProperty('left', `${p.left}%`);
    this.frame.style.setProperty('top', `${p.top}%`);
    this.frame.style.setProperty('width', `${p.width}%`);
    this.frame.style.setProperty('height', `${p.height}%`);
  }

  get box(): Box {
    return this.current;
  }

  /** PDF points per CSS pixel at the current display size. */
  private ptPerPx(): number {
    const shown = this.canvas.getBoundingClientRect().width;
    return shown > 0 ? this.page.widthPt / shown : 1;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target : null;
    const handle = target?.dataset['handle'] as Handle | undefined;
    this.drag = {
      mode: handle ? { kind: 'resize', handle } : { kind: 'move' },
      startX: event.clientX,
      startY: event.clientY,
      startBox: this.current,
    };
    this.frame.setPointerCapture(event.pointerId);
    this.frame.addEventListener('pointermove', this.onPointerMove);
    this.frame.addEventListener('pointerup', this.onPointerUp);
    this.frame.addEventListener('pointercancel', this.onPointerUp);
    this.frame.focus();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    const scale = this.ptPerPx();
    const dx = (event.clientX - this.drag.startX) * scale;
    const dy = (event.clientY - this.drag.startY) * scale;
    const { mode, startBox } = this.drag;
    const next =
      mode.kind === 'move'
        ? moveBox(startBox, dx, dy, this.page)
        : resizeBox(startBox, mode.handle, dx, dy, this.page);
    this.setBox(next);
    this.onChange(next);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.drag) return;
    this.drag = null;
    this.frame.releasePointerCapture(event.pointerId);
    this.frame.removeEventListener('pointermove', this.onPointerMove);
    this.frame.removeEventListener('pointerup', this.onPointerUp);
    this.frame.removeEventListener('pointercancel', this.onPointerUp);
    this.onCommit(this.current);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? KEY_STEP_LARGE_PT : KEY_STEP_PT;
    const delta: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const next = moveBox(this.current, move[0], move[1], this.page);
    this.setBox(next);
    this.onChange(next);
    this.onCommit(next);
  };
}
