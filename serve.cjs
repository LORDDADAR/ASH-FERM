const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const port = Number(process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const files = new Set([
  'index.html', 'style.css', 'game.js', 'manifest.webmanifest',
  'sw.js', 'icon-192.png', 'icon-512.png', 'farm-art.webp',
]);

http.createServer(async (request, response) => {
  // The second mount point reproduces a GitHub Pages project URL.
  const pathname = request.url.split('?')[0].replace(/^\/farm\//, '/');
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await fs.readFile(path.join(__dirname, file));
    response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    response.end(data);
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
