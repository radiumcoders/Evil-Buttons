import SVGPathCommander from "svg-path-commander";

export function parsePathToVertices(path: string, sampleLength = 15) {
  const commander = new SVGPathCommander(path);

  const points: { x: number; y: number }[] = [];
  let lastPoint: { x: number; y: number } | null = null;

  const totalLength = commander.getTotalLength();
  let length = 0;

  while (length < totalLength) {
    const point = commander.getPointAtLength(length);

    if (!lastPoint || point.x !== lastPoint.x || point.y !== lastPoint.y) {
      points.push({ x: point.x, y: point.y });
      lastPoint = point;
    }

    length += sampleLength;
  }

  const finalPoint = commander.getPointAtLength(totalLength);
  if (
    lastPoint &&
    (finalPoint.x !== lastPoint.x || finalPoint.y !== lastPoint.y)
  ) {
    points.push({ x: finalPoint.x, y: finalPoint.y });
  }

  return points;
}