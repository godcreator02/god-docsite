export const demoMarkToken = '[[demo]]';

export type DemoTextPiece = { kind: 'text'; value: string } | { kind: 'mark' };

export function splitTextByDemoMark(text: string): DemoTextPiece[] {
  const pieces: DemoTextPiece[] = [];
  const segments = text.split(demoMarkToken);
  segments.forEach((segment, index) => {
    if (index > 0) pieces.push({ kind: 'mark' });
    if (segment.length > 0) pieces.push({ kind: 'text', value: segment });
  });
  return pieces;
}
