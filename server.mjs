import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 10000);
const distDirectory = resolve(process.cwd(), 'dist');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function pathInDistribution(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const filePath = resolve(distDirectory, `.${decodedPath}`);
  return filePath === distDirectory || filePath.startsWith(`${distDirectory}${sep}`) ? filePath : null;
}

async function readStaticFile(pathname) {
  const filePath = pathInDistribution(pathname);
  if (!filePath) return null;
  try {
    const details = await stat(filePath);
    return details.isFile() ? { body: await readFile(filePath), filePath } : null;
  } catch {
    return null;
  }
}

function send(response, status, body, contentType, cacheControl = 'no-cache', includeBody = true) {
  response.writeHead(status, {
    'Cache-Control': cacheControl,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(includeBody ? body : undefined);
}

const server = createServer(async (request, response) => {
  if (!request.url || !['GET', 'HEAD'].includes(request.method || '')) {
    send(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, 'http://localhost').pathname;
  } catch {
    send(response, 400, 'Bad Request', 'text/plain; charset=utf-8');
    return;
  }

  const requestedFile = await readStaticFile(pathname);
  if (requestedFile) {
    const extension = extname(requestedFile.filePath).toLowerCase();
    const immutable = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    send(response, 200, requestedFile.body, contentTypes[extension] || 'application/octet-stream', immutable, request.method !== 'HEAD');
    return;
  }

  // Assets must return 404 when absent; browser routes fall back to the Vite SPA entry point.
  if (extname(pathname)) {
    send(response, 404, 'Not Found', 'text/plain; charset=utf-8', 'no-cache', request.method !== 'HEAD');
    return;
  }

  const indexFile = await readStaticFile('/index.html');
  if (!indexFile) {
    send(response, 503, 'Application build is unavailable', 'text/plain; charset=utf-8', 'no-cache', request.method !== 'HEAD');
    return;
  }
  send(response, 200, indexFile.body, 'text/html; charset=utf-8', 'no-cache', request.method !== 'HEAD');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`PrintF is listening on port ${port}`);
});
