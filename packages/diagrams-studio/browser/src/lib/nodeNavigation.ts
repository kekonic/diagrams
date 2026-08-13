export type NodeNavigationPointer = {
  id: number;
  x: number;
  y: number;
  nodeId: string;
};

/** A stationary primary-pointer gesture navigates; a drag remains exclusively a pan gesture. */
export function nodeNavigationTarget(
  start: NodeNavigationPointer | undefined,
  end: { id: number; x: number; y: number },
  movementThreshold = 5,
): string | null {
  if (!start || start.id !== end.id) return null;
  return Math.hypot(end.x - start.x, end.y - start.y) <= movementThreshold ? start.nodeId : null;
}
