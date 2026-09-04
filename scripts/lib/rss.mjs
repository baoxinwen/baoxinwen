/**
 * 博客 RSS 拉取与解析（零依赖，最小化提取 title/link/pubDate）。
 * 仅服务博客卡这一次要数据：拉取失败由调用方降级（保留上次产物，不阻塞其它卡片）。
 */

/** RSS XML → [{ title, link, date:'MM-DD' }]（纯函数；时间按 UTC+offset 归日） */
export function parseRssItems(xml, { max = 5, tzOffset = 8 } = {}) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = m[0];
    const pick = (tag) => {
      const t = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      if (!t) return '';
      return t[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    };
    const title = pick('title');
    const link = pick('link');
    if (!title || !link) continue;
    const raw = pick('pubDate');
    const d = new Date(raw);
    let date = '';
    if (!Number.isNaN(d.getTime())) {
      const shifted = new Date(d.getTime() + tzOffset * 3_600_000);
      date = `${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
    }
    items.push({ title, link, date });
    if (items.length >= max) break;
  }
  return items;
}

/**
 * 拉取最新文章。失败抛错由调用方降级；条目为空视为失败（空卡无意义）。
 * @returns {Promise<{title:string, link:string, date:string}[]>}
 */
export async function fetchBlogPosts({ rssUrl, fetchImpl = fetch, max = 5, tzOffset = 8, timeoutMs = 15_000 }) {
  // signal 超时：上游挂起时快速失败，不等 workflow 级兜底
  const res = await fetchImpl(rssUrl, {
    headers: { 'User-Agent': 'profile-assets-generator', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`rss HTTP ${res.status}`);
  const posts = parseRssItems(await res.text(), { max, tzOffset });
  if (!posts.length) throw new Error('rss 未解析到任何文章条目');
  return posts;
}
