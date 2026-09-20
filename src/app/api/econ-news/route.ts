// Today's economics headlines, fetched server-side because news feeds don't allow browser (CORS) requests.
// Only the headline, link and date are passed on; the story itself is read on the publisher's site.

type Headline = { title: string; link: string; date: string; source: string };

const FEEDS = [
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/economy/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/business/economics/rss" },
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

function parse(xml: string, source: string): Headline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  const out: Headline[] = [];
  for (const item of items) {
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const date = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title || !link) continue;
    const href = decode(link);
    if (!/^https:\/\//.test(href)) continue;
    out.push({ title: decode(title), link: href, date: date ? new Date(decode(date)).toISOString() : "", source });
  }
  return out;
}

export async function GET() {
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LockedIn/1.0)" }, next: { revalidate: 1800 } });
        if (!res.ok) return [];
        return parse(await res.text(), f.source).slice(0, 6);
      } catch {
        return [];
      }
    }),
  );
  // Interleave the sources, newest first within each.
  const merged: Headline[] = [];
  for (let i = 0; i < 6; i++) for (const list of results) if (list[i]) merged.push(list[i]);
  return Response.json(
    { headlines: merged.slice(0, 10), fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } },
  );
}
