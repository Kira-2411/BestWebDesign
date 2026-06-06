import {
  buildVietmapUrl,
  getVietmapApiKey,
  proxyResponseHeaders,
  rewriteStyleForProxy,
} from '../../../lib/vietmap';

/**
 * @deprecated Dùng /api/map/style/[name] và /api/map/proxy/[...path] thay thế.
 * Giữ route này để tương thích ngược với client cũ dùng ?url=...
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const apiKey = getVietmapApiKey();
  if (!apiKey) {
    return new Response('VIETMAP_API_KEY chưa được cấu hình', { status: 503 });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.hostname !== 'maps.vietmap.vn') {
      return new Response('Invalid hostname', { status: 403 });
    }

    const path = parsedTarget.pathname.replace(/^\//, '');
    const upstreamUrl = buildVietmapUrl(path, apiKey, parsedTarget.searchParams);
    const response = await fetch(upstreamUrl);

    if (!response.ok) {
      return new Response(`VietMap upstream error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = parsedTarget.pathname.endsWith('style.json') || contentType.includes('json');

    if (isJson) {
      const text = await response.text();
      const modified = rewriteStyleForProxy(text);
      return new Response(modified, {
        status: response.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const data = await response.arrayBuffer();
    return new Response(data, {
      status: response.status,
      headers: proxyResponseHeaders(response),
    });
  } catch (err) {
    console.error('Lỗi proxy bản đồ VietMap (legacy):', err.message);
    return new Response('Proxy error: ' + err.message, { status: 500 });
  }
}
