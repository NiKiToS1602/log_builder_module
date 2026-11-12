import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const port = Number(process.env.PORT ?? 5173)
const pages = new Set(['/', '/employees', '/locations'])
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  const path = request.url.split('?')[0]
  const route = path.replace(/\/$/, '') || '/'
  const file = pages.has(route) ? '/index.html' : path
  const isAsset = /^\/assets\/[a-z-]+\.(svg|png)$/.test(file)
  const isSource = /^\/(index\.html|styles\.css|[a-z-]+\.js)$/.test(file)

  if (!isAsset && !isSource) {
    response.writeHead(404).end()
    return
  }

  try {
    const contents = await readFile(new URL('.' + file, import.meta.url))
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(file)],
      'Cache-Control': 'no-store',
    })
    response.end(request.method === 'HEAD' ? undefined : contents)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end()
  }
}).listen(port, '127.0.0.1', () => {
  console.log('http://127.0.0.1:' + port)
})
