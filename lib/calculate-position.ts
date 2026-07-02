export function calculatePosition(
  value: number | string | undefined,
  containerSize: number,
  elementSize: number,
): number {
  if (typeof value === "string" && value.endsWith("%")) {
    const percentage = parseFloat(value) / 100;
    return containerSize * percentage;
  }

  if (typeof value === "number") {
    return value;
  }

  return (containerSize - elementSize) / 2;
}