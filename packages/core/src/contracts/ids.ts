export function createIdMinter(prefix: string) {
  let counter = 0;
  return () => `${prefix}${++counter}`;
}
