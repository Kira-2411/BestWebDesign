const VIETMAP_HOST = 'maps.vietmap.vn';
const ALLOWED_STYLES = new Set(['tm', 'lm', 'dm', 'hm']);

export function getVietmapApiKey() {
  return (process.env.VIETMAP_API_KEY || '').trim();
}

export function isAllowedStyle(name) {
  return ALLOWED_STYLES.has(name);
}

/** Rewrite VietMap absolute URLs to path-based local proxy (preserves {z}/{x}/{y} templates). */
export function rewriteStyleForProxy(styleText, origin = '') {
  const proxyBase = origin ? `${origin}/api/map/proxy` : '/api/map/proxy';

  return styleText.replace(/https:\/\/maps\.vietmap\.vn\/([^"'\s]+)/g, (_, pathAndQuery) => {
    const cleanPath = pathAndQuery
      .replace(/([\?&])apikey=[^&"'\s]*/g, '$1')
      .replace(/[\?&]$/, '');
    return `${proxyBase}/${cleanPath}`;
  });
}

export function buildVietmapUrl(pathSegments, apiKey, searchParams) {
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const target = new URL(`https://${VIETMAP_HOST}/${path}`);

  if (searchParams) {
    searchParams.forEach((value, key) => {
      if (key !== 'apikey') target.searchParams.set(key, value);
    });
  }

  target.searchParams.set('apikey', apiKey);
  return target.toString();
}

export function inferContentType(pathSegments) {
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  if (path.endsWith('.pbf')) return 'application/x-protobuf';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  return null;
}

export function proxyResponseHeaders(upstream, pathSegments) {
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type') || inferContentType(pathSegments);
  const cacheControl = upstream.headers.get('cache-control');

  if (contentType) headers.set('content-type', contentType);
  if (cacheControl) headers.set('cache-control', cacheControl);

  return headers;
}
