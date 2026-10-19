import { expect, it } from 'vitest';
import { parseFeed, parseHtmlLinks, normalizeArticleUrl, collectSources } from '../../src/worker/sources/collect';
import { safeFetch } from '../../src/worker/sources/fetch-safe';
import { defaultSettings } from '../../src/shared/contracts';
it('reads RSS and Atom links and normalizes tracking duplicates', () => {
  expect(parseFeed('<rss><channel><item><title>Work</title><link>https://example.com/work?utm_source=x</link><description>Evidence</description></item></channel></rss>', 'https://example.com/')[0]).toMatchObject({ title: 'Work', url: 'https://example.com/work?utm_source=x', contentStatus: 'excerpt' });
  expect(parseFeed('<feed><entry><title>Atom</title><link href="https://example.com/atom"/><updated>2026-10-18T00:00:00Z</updated></entry></feed>', 'https://example.com/')[0].url).toBe('https://example.com/atom');
  expect(normalizeArticleUrl('https://example.com/work?utm_source=x#section')).toBe('https://example.com/work');
  expect(parseHtmlLinks('<a href="/news/a">Research A</a><a href="/news">News</a>', 'https://www.anthropic.com/news')).toHaveLength(1);
});
it('isolates feed failure and only advances successful checkpoints', async () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const result = await collectSources({ ...defaultSettings, sources: defaultSettings.sources.filter(s => ['tc','openai'].includes(s.id)) }, {}, now, async (url) => {
    if (String(url).includes('openai')) throw new Error('Offline');
    if (String(url).includes('/feed/')) return new Response('<rss><channel><item><title>New</title><link>https://example.com/new</link><pubDate>Sat, 17 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Old</title><link>https://example.com/old</link><pubDate>Sat, 10 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>');
    throw new Error('Body unavailable');
  });
  expect(result.articles).toHaveLength(1);
  expect(result.articles[0].contentStatus).toBe('title-only');
  expect(result.checkpoints.tc).toBe(now.toISOString());
  expect(result.checkpoints.openai).toBeUndefined();
  expect(result.outcomes.find(o => o.sourceId === 'openai')?.ok).toBe(false);
});
it('blocks private hosts, unsafe redirects, oversized bodies and non-HTTP schemes', async () => {
  const http = async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } });
  for (const url of ['http://127.0.0.1/', 'https://localhost/', 'file:///etc/passwd', 'https://[::1]/']) await expect(safeFetch(url, http as typeof fetch)).rejects.toThrow();
  const resolver = async () => ['93.184.216.34'];
  await expect(safeFetch('https://example.com', http as typeof fetch, resolver)).rejects.toThrow();
  await expect(safeFetch('https://example.com', (async () => new Response('a'.repeat(2*1024*1024+1))) as typeof fetch, resolver)).rejects.toThrow('large');
  await expect(safeFetch('https://example.com', http as typeof fetch, async () => ['10.1.1.1'])).rejects.toThrow();
});
it('retains candidates outside the body budget for a later run',async()=>{
 const sources=[defaultSettings.sources.find(s=>s.id==='tc')!];
 const xml='<rss><channel>'+Array.from({length:25},(_,i)=>`<item><title>Item ${i}</title><link>https://example.com/${i}</link><pubDate>Sat, 17 Oct 2026 12:00:00 GMT</pubDate></item>`).join('')+'</channel></rss>';
 const http=async(url:string)=>new Response(url.includes('/feed/')?xml:'<article>'+('Evidence text. '.repeat(40))+'</article>');
 const first=await collectSources({...defaultSettings,sources},{},new Date('2026-10-18T00:00:00Z'),http);
 expect(first.pending).toHaveLength(5);
 const next=await collectSources({...defaultSettings,sources},first.checkpoints,new Date('2026-10-19T00:00:00Z'),http,first.pending);
 expect(next.articles.find(a=>a.url==='https://example.com/24')?.content.length).toBeGreaterThan(200);
});
it('does not advance Hacker News past failed item discovery',async()=>{
 const result=await collectSources({...defaultSettings,sources:[defaultSettings.sources[0]]},{},new Date('2026-10-18T00:00:00Z'),async url=>{
  if(url.includes('topstories'))return Response.json([1,2]);if(url.includes('/item/2'))throw new Error('Item timeout');if(url.includes('/item/1'))return Response.json({id:1,type:'story',title:'Research',url:'https://example.com/work',time:1792281600,score:100});return new Response('');
 });
 expect(result.checkpoints.hn).toBeUndefined();expect(result.outcomes[0].ok).toBe(false);
});
