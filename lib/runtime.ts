/** Build and runtime flags. Never put secrets here. */

export function isStaticExport(): boolean {
  return process.env.NEXT_PUBLIC_STATIC === '1' || process.env.STATIC_EXPORT === '1';
}

export function publicBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!raw || raw === '/') return '';
  return raw.startsWith('/') ? raw.replace(/\/$/, '') : `/${raw.replace(/\/$/, '')}`;
}

export function withBasePath(path: string): string {
  const base = publicBasePath();
  if (!base) return path;
  if (path.startsWith(base + '/') || path === base) return path;
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}

/** Same origin API when the Next server is present. Empty when this build is static. */
export function sameOriginApi(): boolean {
  return !isStaticExport();
}
