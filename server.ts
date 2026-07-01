import { serve } from "bun";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const ROOT = new URL import.meta.resolve("./");

export default serve({
  hostname: HOST,
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("./index.html"), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const file = Bun.file("." + url.pathname);
    if (file.exists) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
  error(error) {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});
