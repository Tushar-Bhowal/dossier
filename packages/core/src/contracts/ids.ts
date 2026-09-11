// startAt lets a later pass (e.g. the coverage gap-fill loop, Task 17) continue minting after ids
// already assigned by an earlier step, without needing to know their exact values up front.
export function createIdMinter(prefix: string, startAt = 0) {
  let counter = startAt;
  return () => `${prefix}${++counter}`;
}

export function highestIdNumber(ids: string[], prefix: string): number {
  return ids.reduce((max, id) => {
    if (!id.startsWith(prefix)) return max;
    const n = Number(id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
}
