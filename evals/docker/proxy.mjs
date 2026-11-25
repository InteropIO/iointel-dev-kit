// The egress proxy for --isolation container. It is the only way out of an eval run's internal
// Docker network. Each client container is identified by its IP on that network. The engine writes
// that IP's allowlist to POLICY_DIR/<ip>.json ({ "allow": ["github.com", "*.example.com"] }) before
// the run starts. Every request is appended to LOG_DIR/<ip>.jsonl, allowed or not. An IP with no
// policy file gets nothing.
//
// Plain Node, no dependencies: it runs from the runner image (`node /opt/evals/proxy.mjs`), and
// the engine's tests import isAllowed from it.
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const POLICY_DIR = process.env.PROXY_POLICY_DIR ?? "/tmp/policies";
const LOG_DIR = process.env.PROXY_LOG_DIR ?? "/tmp/logs";
const PORTS = new Set([80, 443]);

/** Exact host names, or "*.example.com" for any subdomain (not example.com itself). */
export function isAllowed(host, allow) {
  const h = String(host).toLowerCase().replace(/\.$/, "");
  return allow.some((entry) => {
    const e = String(entry).toLowerCase();
    return e.startsWith("*.") ? h.endsWith(e.slice(1)) : h === e;
  });
}

/** "host:port" or "[v6]:port" from a CONNECT target. */
export function splitHostPort(target, defaultPort) {
  const m =
    /^\[([^\]]+)\](?::(\d+))?$/.exec(target) ??
    /^([^:]+)(?::(\d+))?$/.exec(target);
  if (!m) return undefined;
  return { host: m[1], port: m[2] ? Number(m[2]) : defaultPort };
}

function clientIp(socket) {
  return (socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

function policyFor(ip) {
  try {
    const policy = JSON.parse(
      fs.readFileSync(path.join(POLICY_DIR, `${ip}.json`), "utf8"),
    );
    return Array.isArray(policy.allow) ? policy.allow : [];
  } catch {
    return [];
  }
}

function decide(socket, host, port) {
  const ip = clientIp(socket);
  const allowed = PORTS.has(port) && isAllowed(host, policyFor(ip));
  try {
    fs.appendFileSync(
      path.join(LOG_DIR, `${ip}.jsonl`),
      JSON.stringify({ host, port, allowed, at: new Date().toISOString() }) +
        "\n",
    );
  } catch {
    // Logging must never break traffic.
  }
  return allowed;
}

const HOP_HEADERS = new Set([
  "proxy-authorization",
  "proxy-connection",
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function blockedBody(host) {
  return `blocked by the eval sandbox: ${host} is not on this run's allowlist\n`;
}

export function startProxy(port = 3128) {
  fs.mkdirSync(POLICY_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  // Plain HTTP: the client sends an absolute URL.
  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url ?? "");
    } catch {
      res.writeHead(400).end();
      return;
    }
    const targetPort = Number(url.port || 80);
    if (
      url.protocol !== "http:" ||
      !decide(req.socket, url.hostname, targetPort)
    ) {
      res
        .writeHead(403, { "content-type": "text/plain" })
        .end(blockedBody(url.hostname));
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(
        ([k]) => !HOP_HEADERS.has(k.toLowerCase()),
      ),
    );
    const upstream = http.request(
      {
        host: url.hostname,
        port: targetPort,
        method: req.method,
        path: url.pathname + url.search,
        headers,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });

  // HTTPS and anything else tunnelled: CONNECT host:port.
  server.on("connect", (req, client, head) => {
    client.on("error", () => {});
    const target = splitHostPort(req.url ?? "", 443);
    if (!target || !decide(client, target.host, target.port)) {
      const host = target?.host ?? String(req.url);
      client.end(
        `HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\nconnection: close\r\n\r\n${blockedBody(host)}`,
      );
      return;
    }
    const upstream = net.connect(target.port, target.host, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head?.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on("error", () => client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
    client.on("close", () => upstream.destroy());
  });

  server.listen(port, "0.0.0.0");
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  startProxy(Number(process.env.PROXY_PORT ?? 3128));
