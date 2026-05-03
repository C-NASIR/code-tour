export function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const collapsed = prefixed.replace(/\/+/g, "/");

  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

export function joinRoutePaths(basePath: string, childPath: string): string {
  if (basePath === "/") {
    return normalizeRoutePath(childPath);
  }

  if (childPath === "/") {
    return normalizeRoutePath(basePath);
  }

  return normalizeRoutePath(`${basePath}/${childPath}`);
}
