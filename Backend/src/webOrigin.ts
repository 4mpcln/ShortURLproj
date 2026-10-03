export function isAllowedWebOrigin(origin: string, webOrigin: string, development: boolean) {
  if (origin === webOrigin) return true;
  if (!development) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}
