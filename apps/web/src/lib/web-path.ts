const serviceBasePath = process.env.NODE_ENV === "production" ? "/app" : "";

export function webPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${serviceBasePath}${normalized === "/" ? "" : normalized}` || "/";
}

