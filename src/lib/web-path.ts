export function webPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized;
}
