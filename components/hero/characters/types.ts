// Shared prop type for every character SVG. Each character receives the
// raw viewport mouse coords and forwards them to its <Eye> children.

export interface CharacterProps {
  mouseX: number;
  mouseY: number;
}
