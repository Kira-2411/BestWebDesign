import {
  buildVietmapUrl,
  getVietmapApiKey,
  isAllowedStyle,
  rewriteStyleForProxy,
} from '../../../../../lib/vietmap';

export async function GET(request, { params }) {
  const apiKey = getVietmapApiKey();
  if (!apiKey) {
    return new Response('VIETMAP_API_KEY chưa được cấu hình', { status: 503 });
  }

  const { name } = params;
  if (!isAllowedStyle(name)) {
    return new Response('Invalid style name', { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const targetUrl = buildVietmapUrl(`maps/styles/${name}/style.json`, apiKey);
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new Response(`VietMap style error: ${response.status}`, { status: response.status });
    }

    const text = await response.text();
    const modified = rewriteStyleForProxy(text, origin);

    return new Response(modified, {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    console.error('Lỗi tải style VietMap:', err.message);
    return new Response('Style proxy error: ' + err.message, { status: 500 });
  }
}
