export function createPageUrl(pageName: string) {
  const normalized = pageName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();

  return `/${normalized}`;
}
