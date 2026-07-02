import { serve } from "bun"

const HOST = process.env.HOST ?? "127.0.0.1"
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10)
const ROOT = import.meta.dir

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "1; mode=block",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
}

const HTML_HEADERS = {
  ...SECURITY_HEADERS,
  "content-type": "text/html; charset=utf-8",
}

const STATIC_HEADERS = {
  ...SECURITY_HEADERS,
  "cache-control": "no-cache",
}

const server = serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(`${ROOT}/index.html`), {
        headers: HTML_HEADERS,
      })
    }

    const file = Bun.file(ROOT + url.pathname)
    if (await file.exists()) {
      // Let Bun.file infer content-type from the file extension (css/js/svg/etc.)
      // instead of overriding it, since `x-content-type-options: nosniff` makes
      // browsers reject scripts/styles served with the wrong MIME type.
      return new Response(file, {
        headers: STATIC_HEADERS,
      })
    }

    return new Response("Not Found", {
      status: 404,
      headers: HTML_HEADERS,
    })
  },
  error(error) {
    console.error("Server error:", error)
    return new Response("Internal Server Error", {
      status: 500,
      headers: SECURITY_HEADERS,
    })
  },
})

console.log(`HHVC mockup server running at http://${server.hostname}:${server.port}`)

export default server

