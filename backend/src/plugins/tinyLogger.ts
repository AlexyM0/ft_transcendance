// src/plugins/tinyLogger.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { STATUS_CODES } from "node:http";

type TinyLoggerOpts = {
  showCookies?: boolean; // also log request Cookie + response Set-Cookie
  bodyLimit?: number; // truncate req/resp bodies to this many chars
};

/* ---------- ANSI helpers (no deps) ---------- */
const R = "\x1b[0m";
const K = {
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};
const paint = (c: string, s: string) => c + s + R;

const methodColor = (m: string) => {
  switch (m) {
    case "GET":
      return K.blue;
    case "POST":
      return K.magenta;
    case "PUT":
      return K.yellow;
    case "PATCH":
      return K.cyan;
    case "DELETE":
      return K.red;
    default:
      return K.white;
  }
};
const statusColor = (n: number) => (n < 300 ? K.green : n < 400 ? K.cyan : n < 500 ? K.yellow : K.red);

/* Safe stringify + truncate */
function previewBody(v: unknown, limit: number): string {
  try {
    let s: string;
    if (!v) s = "";
    else if (typeof v === "string") s = v;
    else if (Buffer.isBuffer(v)) s = v.toString("utf8");
    else if (typeof (v as any)?.pipe === "function") s = "[stream]";
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    return s.length > limit ? s.slice(0, limit) + "…" : s;
  } catch {
    return "[unserializable]";
  }
}

const tinyLogger: FastifyPluginAsync<TinyLoggerOpts> = async (app, opts) => {
  const showCookies = !!opts?.showCookies;
  const bodyLimit = opts?.bodyLimit ?? 500;

  // Capture response preview during onSend
  app.addHook("onSend", async (req, _reply, payload) => {
    (req as any)._respBodyPreview = previewBody(payload as any, bodyLimit);
    return payload;
  });

  app.addHook("onResponse", (req, reply, done) => {
    const method = req.method;
    const url = req.url;
    const status = reply.statusCode;
    const statusText = STATUS_CODES[status] || "";
    const reqBody = previewBody(req.body, bodyLimit);
    const repBody = (req as any)._respBodyPreview as string | undefined;

    // Header line
    const line =
      `${paint(K.dim, "[REQUEST]")} ` + `${paint(methodColor(method), method)} ` + `${paint(K.cyan, url)} ` + `${paint(K.dim, "→")} ` + `${paint(statusColor(status), `${status} ${statusText}`)} `;

    // Cookies (optional)
    const cookies: string[] = [];
    if (showCookies) {
      const reqCookie = req.headers["cookie"];
      const setCookie = reply.getHeader("set-cookie");
      if (reqCookie) cookies.push(`${paint(K.dim, "cookie=")}${reqCookie}`);
      if (setCookie) cookies.push(`${paint(K.dim, "set-cookie=")}${JSON.stringify(setCookie)}`);
    }

    console.log(cookies.length ? `${line} ${paint(K.gray, "|")} ${cookies.join(" ")}` : line);

    // Bodies (request + reply), dim so they don’t shout
    if (reqBody) {
      console.log(`${paint(K.dim, "  [REQUEST BODY]")} ${paint(K.gray, reqBody)}`);
    }
    if (repBody) {
      console.log(`${paint(K.dim, "  [REPLY BODY]  ")} ${paint(K.gray, repBody)}`);
    }

    done();
  });
};

export default fp(tinyLogger);
