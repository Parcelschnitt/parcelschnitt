/**
 * Builds the output PDF with pdf-lib. Each label becomes one page; the source page is embedded
 * as a vector Form XObject clipped to the label content, so barcodes stay vectors.
 *
 * Cropping and rotation are separate steps (embed with a bounding box, then place with a
 * rotation) — doing both in one transformation produced offsets in the prototype.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { height, invert, normalizeQuarterTurn, transformRect, width } from './geometry.ts';
import { ParcelschnittError } from './errors.ts';
import type { Detection } from './detection.ts';
import type { Placement } from './fit.ts';
import type { PageAnalysis } from './types.ts';

export interface PlacedLabel {
  readonly detection: Detection;
  readonly placement: Placement;
}

/** Position of the rotated object's origin so that its bounding box starts at (x, y). */
function originFor(
  rotationCcw: number,
  x: number,
  y: number,
  drawnWidth: number,
  drawnHeight: number,
): { x: number; y: number } {
  switch (rotationCcw) {
    case 90:
      return { x: x + drawnHeight, y };
    case 180:
      return { x: x + drawnWidth, y: y + drawnHeight };
    case 270:
      return { x, y: y + drawnWidth };
    default:
      return { x, y };
  }
}

export async function renderLabels(
  sourceBytes: Uint8Array,
  pages: readonly PageAnalysis[],
  labels: readonly PlacedLabel[],
): Promise<Uint8Array> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  } catch {
    throw new ParcelschnittError('unreadablePdf', 'The PDF could not be read.');
  }
  const output = await PDFDocument.create({ updateMetadata: false });
  output.setProducer('Parcelschnitt');

  for (const { detection, placement } of labels) {
    const analysis = pages[detection.pageIndex];
    if (!analysis || detection.pageIndex >= source.getPageCount()) {
      throw new ParcelschnittError('pageOutOfRange', 'The label page does not exist.');
    }
    const userBox = transformRect(invert(analysis.viewTransform), detection.contentBox);
    const embedded = await output.embedPage(source.getPage(detection.pageIndex), {
      left: userBox.x0,
      bottom: userBox.y0,
      right: userBox.x1,
      top: userBox.y1,
    });

    // The viewer sees user space turned clockwise by /Rotate; the placement adds its own
    // clockwise turn. pdf-lib rotates counter-clockwise.
    const clockwise = normalizeQuarterTurn(analysis.rotate + placement.rotation);
    const counterClockwise = normalizeQuarterTurn(360 - clockwise);
    const drawnWidth = width(userBox) * placement.scale;
    const drawnHeight = height(userBox) * placement.scale;
    const origin = originFor(counterClockwise, placement.x, placement.y, drawnWidth, drawnHeight);

    const page = output.addPage([placement.pageWidthPt, placement.pageHeightPt]);
    page.drawPage(embedded, {
      x: origin.x,
      y: origin.y,
      xScale: placement.scale,
      yScale: placement.scale,
      rotate: degrees(counterClockwise),
    });
  }
  return output.save({ useObjectStreams: false });
}
