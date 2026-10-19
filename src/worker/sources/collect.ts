import { XMLParser } from 'fast-xml-parser';
import { parse } from 'parse5';
import type { Article, Settings, SourceOutcome } from '../../shared/contracts';
import { safeFetch, publicUrl } from './fetch-safe';
export function normalizeArticleUrl(raw: string) { const u = publicUrl(raw); u.hash = ''; for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/.test(key)) u.searchParams.delete(key); u.searchParams.sort(); return u.href.replace(/\/$/, ''); }
export async function articleId(url: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeArticleUrl(url))))].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,24); }
const list = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
function text(node: any): string { if (['script','style','nav','header','footer','noscript','svg'].includes(node.tagName)) return ''; return node.nodeName === '#text' ? node.value : list(node.childNodes).map(text).join(' ').replace(/\s+/g,' ').trim(); }
function nodes(root: any): any[] { return [root, ...list(root.childNodes).flatMap(nodes)]; }
export function extractText(html: string) { const root = parse(html); const all = nodes(root); const main = all.find(n => n.tagName === 'article') ?? all.find(n => n.tagName === 'main'); return text(main ?? root).slice(0,20000); }
function candidate(title: string, url: string, content = '', publishedAt?: string): Article { return { id: '', title, url, content: content.slice(0,20000), contentStatus: content ? 'excerpt' : 'title-only', publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : undefined, sources: [], topics: [] }; }
export function parseFeed(xml: string, base: string): Article[] {
  const data = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: true }).parse(xml);
  return list(data.rss?.channel?.item ?? data.feed?.entry ?? data['rdf:RDF']?.item).slice(0,50).flatMap((entry: any) => {
    const links = list(entry.link); const link = links.find(l => l?.['@rel'] === 'alternate') ?? links[0];
    try { return [candidate(String(entry.title?.['#text'] ?? entry.title ?? ''), new URL(typeof link === 'string' ? link : link?.['@href'], base).href, extractText(String(entry.description ?? entry.summary?.['#text'] ?? entry.summary ?? '')), entry.pubDate ?? entry.published ?? entry.updated)]; } catch { return []; }
  });
}
export function parseHtmlLinks(html: string, base: string): Article[] {
  const origin = new URL(base); const found = new Map<string, Article>();
  for (const node of nodes(parse(html))) { if (node.tagName !== 'a') continue; const href = node.attrs?.find((a: any) => a.name === 'href')?.value; if (!href) continue;
    try { const u = new URL(href, base); if (u.origin !== origin.origin || !/^\/(news|research|engineering)\/[^/]+/.test(u.pathname)) continue; const title = text(node); if (title.length >= 5 && !found.has(u.href)) found.set(u.href, candidate(title, u.href)); } catch { /* Ignore malformed publisher links. */ }
  } return [...found.values()].slice(0,50);
}
export interface PendingArticle { sourceId:string; article:Article }
export interface CollectionResult { articles: Article[]; outcomes: SourceOutcome[]; checkpoints: Record<string,string>; pending?:PendingArticle[] }
export async function collectSources(settings: Settings, checkpoints: Record<string,string>, now: Date, http: (url: string) => Promise<Response> = safeFetch, pending:PendingArticle[]=[]): Promise<CollectionResult> {
  const enabled=new Set(settings.sources.filter(s=>s.enabled).map(s=>s.id));
  const result: CollectionResult = { articles: [], outcomes: [], checkpoints: { ...checkpoints }, pending:pending.filter(p=>!enabled.has(p.sourceId)) }; const merged = new Map<string,Article>();
  const deadline=Date.now()+4*60000;
  for (const source of settings.sources.filter(s => s.enabled)) {
    try {
      if(Date.now()>deadline)throw new Error('Collection time budget exceeded');
      let candidates: Article[];let discoveryFailed=false;
      if (source.kind === 'hackernews') {
        const ids = await (await http('https://hacker-news.firebaseio.com/v0/topstories.json')).json() as number[]; candidates = [];
        for (let index=0; index<Math.min(ids.length,50); index+=4) {
          if(Date.now()>deadline)throw new Error('Collection time budget exceeded');
          const items = await Promise.all(ids.slice(index,index+4).map(async id => { try { return await (await http(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json() as any; } catch { discoveryFailed=true;return null; } }));
          for (const item of items) if (item && !item.dead && !item.deleted && item.type === 'story') candidates.push({ ...candidate(item.title, item.url || `https://news.ycombinator.com/item?id=${item.id}`, extractText(item.text ?? ''), new Date(item.time*1000).toISOString()), points: item.score, commentsUrl: `https://news.ycombinator.com/item?id=${item.id}` });
        }
      } else { const body = await (await http(source.url)).text(); candidates = source.kind === 'rss' ? parseFeed(body,source.url) : parseHtmlLinks(body,source.url); if (!candidates.length) throw new Error('No items found; check the source format'); }
      const since = checkpoints[source.id] ? Date.parse(checkpoints[source.id])-3600000 : now.getTime()-48*3600000;
      const queued=pending.filter(p=>p.sourceId===source.id).map(p=>p.article);
      const discovered=candidates.filter(a => !a.publishedAt || Date.parse(a.publishedAt)>=since);
      const recent=[...new Map([...queued,...discovered].map(a=>[normalizeArticleUrl(a.url),a])).values()];
      for (let index=0; index<recent.length; index+=4) {
        const enriched = await Promise.all(recent.slice(index,index+4).map(async (a,j) => {
          a.url = normalizeArticleUrl(a.url); a.id = await articleId(a.url); a.sources = [source.name];
          if (index+j<20&&Date.now()<deadline) { try { const body = extractText(await (await http(a.url)).text()); if (body.length>200) { a.content=body; a.contentStatus='excerpt'; } } catch { /* Keep the evidence level supplied by the feed. */ } }
          else result.pending!.push({sourceId:source.id,article:a});
          return a;
        }));
        for (const a of enriched) { const previous=merged.get(a.id); if (previous) { previous.sources=[...new Set([...previous.sources,...a.sources])]; if(a.content.length>previous.content.length){ previous.content=a.content; previous.contentStatus=a.contentStatus; } } else merged.set(a.id,a); }
      }
      if(!discoveryFailed)result.checkpoints[source.id]=now.toISOString(); result.outcomes.push({sourceId:source.id,ok:!discoveryFailed,count:recent.length,...(discoveryFailed?{error:'Some submission details could not be checked. They remain eligible for the next run.'}:{})});
    } catch (error) { result.pending!.push(...pending.filter(p=>p.sourceId===source.id)); result.outcomes.push({sourceId:source.id,ok:false,count:0,error:error instanceof Error?error.message:'Source unavailable'}); }
  } result.articles=[...merged.values()]; return result;
}
