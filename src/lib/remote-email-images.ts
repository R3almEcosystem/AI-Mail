import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const MAX_REMOTE_IMAGES = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export type RemoteImageAddress = { address: string; family: number };
export type RemoteImageFetchResult = {
  status: number;
  contentType: string;
  body: Uint8Array;
};
export type RemoteImageDependencies = {
  resolve?: (hostname: string) => Promise<RemoteImageAddress[]>;
  fetchPinned?: (url: URL, address: string) => Promise<RemoteImageFetchResult>;
};

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function ipv4Number(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function inIpv4Range(address: string, base: string, prefix: number) {
  const value = ipv4Number(address);
  const start = ipv4Number(base);
  if (value === null || start === null) return false;
  if (prefix === 0) return true;
  const size = 2 ** (32 - prefix);
  return Math.floor(value / size) === Math.floor(start / size);
}

export function isPublicRemoteImageAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const blocked: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, prefix]) => inIpv4Range(address, base, prefix));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (
      normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:")
    ) return false;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicRemoteImageAddress(mapped[1]);
    return true;
  }
  return false;
}

async function defaultResolve(hostname: string): Promise<RemoteImageAddress[]> {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  return addresses.map(entry => ({ address: entry.address, family: entry.family }));
}

async function defaultFetchPinned(url: URL, address: string): Promise<RemoteImageFetchResult> {
  return new Promise((resolve, reject) => {
    const family = isIP(address);
    if (!family) {
      reject(new Error("invalid address"));
      return;
    }

    const request = httpsRequest({
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
        "User-Agent": "r3alm-si-mail-image-proxy/1.0",
      },
    }, response => {
      const status = response.statusCode || 0;
      const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const contentLength = Number(response.headers["content-length"] || 0);
      if (contentLength > MAX_IMAGE_BYTES) {
        response.destroy();
        reject(new Error("image too large"));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", chunk => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          response.destroy(new Error("image too large"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("end", () => {
        resolve({
          status,
          contentType,
          body: new Uint8Array(Buffer.concat(chunks)),
        });
      });
      response.on("error", reject);
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("image timeout")));
    request.on("error", reject);
    request.end();
  });
}

async function approvedTarget(rawUrl: string, resolve: (hostname: string) => Promise<RemoteImageAddress[]>) {
  if (!rawUrl || rawUrl.length > 4096) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || (url.port && url.port !== "443")
    || !url.hostname
    || url.hostname.length > 253
  ) return null;

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".home.arpa")
  ) return null;

  let addresses: RemoteImageAddress[];
  try {
    if (isIP(hostname)) {
      addresses = [{ address: hostname, family: isIP(hostname) }];
    } else {
      addresses = await resolve(hostname);
    }
  } catch {
    return null;
  }
  if (!addresses.length || addresses.some(entry => !isPublicRemoteImageAddress(entry.address))) return null;
  return { url, address: addresses[0].address };
}

function markerReplacement(markerValue: string, replacement: string) {
  return `data-remote-src="${markerValue}"`;
}

export async function hydrateRemoteEmailImages(
  html: string,
  dependencies: RemoteImageDependencies = {},
): Promise<{ html: string; loaded: number; blocked: number }> {
  if (!html || html.length > 2_000_000) return { html, loaded: 0, blocked: 0 };

  const resolve = dependencies.resolve || defaultResolve;
  const fetchPinned = dependencies.fetchPinned || defaultFetchPinned;
  const matches = [...html.matchAll(/data-remote-src="([^"]+)"/gi)];
  if (!matches.length) return { html, loaded: 0, blocked: 0 };

  let output = html;
  let loaded = 0;
  let blocked = 0;
  let totalBytes = 0;
  const cache = new Map<string, string | null>();

  for (let index = 0; index < matches.length; index++) {
    const encoded = matches[index][1];
    const marker = markerReplacement(encoded, "");
    if (index >= MAX_REMOTE_IMAGES) {
      output = output.split(marker).join('data-remote-image-blocked="true"');
      blocked += 1;
      continue;
    }

    const rawUrl = decodeHtmlAttribute(encoded);
    let dataUrl = cache.get(rawUrl);
    if (dataUrl === undefined) {
      dataUrl = null;
      const target = await approvedTarget(rawUrl, resolve);
      if (target) {
        try {
          const fetched = await fetchPinned(target.url, target.address);
          const contentType = fetched.contentType.split(";")[0].trim().toLowerCase();
          if (
            fetched.status === 200
            && ALLOWED_IMAGE_TYPES.has(contentType)
            && fetched.body.byteLength > 0
            && fetched.body.byteLength <= MAX_IMAGE_BYTES
            && totalBytes + fetched.body.byteLength <= MAX_TOTAL_BYTES
          ) {
            totalBytes += fetched.body.byteLength;
            dataUrl = `data:${contentType};base64,${Buffer.from(fetched.body).toString("base64")}`;
          }
        } catch {
          dataUrl = null;
        }
      }
      cache.set(rawUrl, dataUrl);
    }

    if (dataUrl) {
      output = output.split(marker).join(`src="${dataUrl}"`);
      loaded += 1;
    } else {
      output = output.split(marker).join('data-remote-image-blocked="true"');
      blocked += 1;
    }
  }

  return { html: output, loaded, blocked };
}
