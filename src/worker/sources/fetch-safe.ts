const MAX_BYTES = 2 * 1024 * 1024;
function publicAddress(ip: string): boolean {
  if (ip.includes(':')) return /^2[0-9a-f]{3}:/i.test(ip) && !ip.toLowerCase().startsWith('2001:db8:');
  const p = ip.split('.').map(Number);
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && ![0,10,127].includes(p[0]) && p[0] < 224 && !(p[0]===169 && p[1]===254) && !(p[0]===172 && p[1]>=16 && p[1]<=31) && !(p[0]===192 && (p[1]===168 || p[1]===0)) && !(p[0]===100 && p[1]>=64 && p[1]<=127) && !(p[0]===198 && [18,19,51].includes(p[1])) && !(p[0]===203 && p[1]===0);
}
export function publicUrl(raw: string) {
  const u = new URL(raw);
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.port || !u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':') || /\.(localhost|local|internal|test|invalid)$/i.test(u.hostname)) throw new Error('Unsafe source address');
  return u;
}
async function resolvePublic(host: string): Promise<string[]> {
  const answers = await Promise.all(['A','AAAA'].map(async type => {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('DNS lookup failed');
    const data = await response.json() as { Status: number; Answer?: { type: number; data: string }[] };
    if (data.Status !== 0) throw new Error('DNS lookup failed');
    return (data.Answer ?? []).filter(a => [1,28].includes(a.type)).map(a => a.data);
  })); return answers.flat();
}
export async function safeFetch(raw: string, http: typeof fetch = fetch, resolve: (host: string) => Promise<string[]> = resolvePublic): Promise<Response> {
  let url = raw;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const u = publicUrl(url); const ips = await resolve(u.hostname);
    if (!ips.length || !ips.every(publicAddress)) throw new Error('Unsafe source address');
    const response = await http(u.href, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'MorningPaper/0.1 (+personal feed reader)', Accept: 'text/html,application/rss+xml,application/atom+xml,application/json' } });
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get('location'); await response.body?.cancel(); if (!location) throw new Error('Invalid source redirect'); url = new URL(location, u).href; continue; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Source returned ${response.status}`); }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Response too large'); }
    const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    if (reader) { try { while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > MAX_BYTES) throw new Error('Response too large'); chunks.push(next.value); } } finally { await reader.cancel(); } }
    const body = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return new Response(body, { status: response.status, headers: response.headers });
  } throw new Error('Too many source redirects');
}
