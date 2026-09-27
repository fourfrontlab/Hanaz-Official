const http = require('http');
const fs = require('fs');
const path = require('path');
const complaintsHandler = require('./api/complaints.js');
const { adminComplaintsHandler } = require('./server/admin-complaints.js');

const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// Clean URL rewrite mappings matching vercel.json
const REWRITES = {
  '/': '/index.html',
  '/complaint': '/complaint.html',
  '/products': '/products.html',
  '/collections': '/collections.html',
  '/collections/frontpage': '/products.html',
  '/contact': '/contact.html',
  '/pages/contact-us': '/contact.html',
  '/about': '/about.html',
  '/pages/about-us': '/about.html',
  '/login': '/login.html',
  '/signup': '/signup.html',
  '/account': '/account.html',
  '/checkout': '/checkout.html',
  '/track-order': '/track-order.html',
  '/faq': '/faq.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/return-policy': '/return-policy.html',
  '/shipping-info': '/shipping-info.html',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hanaz-csrf');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // 1. API Routing
  if (pathname === '/api/complaints') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = body; }
      complaintsHandler(req, res);
    });
    return;
  }

  // Admin API Routing (for ResolveSync Admin Portal)
  if (pathname.startsWith('/api/admin/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = body; }
      adminComplaintsHandler(req, res);
    });
    return;
  }

  // 2. Clean URL rewrites
  if (REWRITES[pathname]) {
    pathname = REWRITES[pathname];
  }

  // 3. Resolve file path in public dir
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If no extension and file doesn't exist, try appending .html
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }

  // Check if file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFoundPath = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(notFoundPath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return fs.createReadStream(notFoundPath).pipe(res);
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('404 Not Found');
  }

  // Serve static file
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  fs.createReadStream(filePath).pipe(res);
});

const DEFAULT_PORT = parseInt(process.env.PORT || '3002', 10);

function startServer(port) {
  const s = server.listen(port, '0.0.0.0', () => {
    console.log(`Hanaz Storefront website running at: http://localhost:${port}`);
    console.log(`Complaint Form accessible at: http://localhost:${port}/complaint.html`);
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
