import { buildVietmapUrl, getVietmapApiKey, proxyResponseHeaders } from '../../../../../lib/vietmap';

export async function GET(request, { params }) {
  const apiKey = getVietmapApiKey();
  if (!apiKey) {
    return new Response('VIETMAP_API_KEY chưa được cấu hình', { status: 503 });
  }

  const { path } = params;
  if (!path?.length) {
    return new Response('Missing path', { status: 400 });
  }

  const { searchParams } = new URL(request.url);

  try {
    const targetUrl = buildVietmapUrl(path, apiKey, searchParams);
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new Response(`VietMap upstream error: ${response.status}`, { status: response.status });
    }

    return new Response(response.body, {
      status: response.status,
      headers: proxyResponseHeaders(response, path),
    });
  } catch (err) {
    console.error('Lỗi proxy bản đồ VietMap:', err.message);
    return new Response('Proxy error: ' + err.message, { status: 500 });
  }
}
