/**
 * 生成器行为测试：node --test scripts/test/generate.test.mjs
 * 全部离线：fetch 可注入，不触网。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKENS, esc, wrapCJK, visLen, truncateCJK, langColor, typeRotator, EASE_IN_OUT, FONT_SANS, FONT_MONO } from '../lib/tokens.mjs';
import { calendarStats, hoursFromEvents, eventSpanDays, aggregateLanguages, normalize, fetchProfileData } from '../lib/github.mjs';
import { parseRssItems, fetchBlogPosts } from '../lib/rss.mjs';
import { renderAll, renderStats, renderStreakHours, renderLangs, renderBlog } from '../lib/render.mjs';

/* ------------------------------------------------------------ token */

test('token 深浅两版键集一致且为合法颜色', () => {
  const keys = Object.keys(TOKENS.light).sort();
  assert.deepEqual(Object.keys(TOKENS.dark).sort(), keys);
  // 颜色 token:6 位 hex 或 rgba()(玻璃方向的半透明卡面/光晕/发丝线需要 alpha)
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const RGBA = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*(0|1)(\.\d+)?\)$/;
  for (const mode of ['light', 'dark']) {
    for (const [k, v] of Object.entries(TOKENS[mode])) {
      if (k === 'shadowOpacity') {
        assert.ok(Array.isArray(v) && v.length === 2, `${mode}.shadowOpacity 应为二元组`);
        for (const n of v) assert.ok(n >= 0 && n <= 1, `${mode}.shadowOpacity 应在 [0,1]`);
        continue;
      }
      if (k === 'cardOpacity') {
        assert.ok(typeof v === 'number' && v > 0 && v < 1, `${mode}.cardOpacity 应在 (0,1)`);
        continue;
      }
      assert.ok(HEX.test(v) || RGBA.test(v), `${mode}.${k} 应为 6 位 hex 或 rgba(): ${v}`);
    }
  }
});

test('字体栈包含 CJK 回退且不依赖网络字体', () => {
  for (const f of [FONT_SANS, FONT_MONO]) {
    assert.ok(!/https?:|url\(/.test(f), '不得引用外部资源');
  }
  assert.match(FONT_SANS, /PingFang SC/);
  assert.match(FONT_SANS, /Microsoft YaHei/);
  assert.match(FONT_MONO, /Consolas/);
});

/* ------------------------------------------------------------ 原语 */

test('esc 转义 XML 特殊字符', () => {
  assert.equal(esc('a&b<c>"d"'), 'a&amp;b&lt;c&gt;&quot;d&quot;');
});

test('visLen：CJK 记两格、拉丁记一格', () => {
  assert.equal(visLen('后端'), 4);
  assert.equal(visLen('Rust'), 4);
  assert.equal(visLen('在学 Rust'), 9);
});

test('wrapCJK 按全角单位断行且不丢字', () => {
  const rows = wrapCJK('私人自托管旅行足迹地图：高德地图记录旅程与时间线', 10);
  assert.ok(rows.length >= 2);
  assert.equal(rows.join('').length, '私人自托管旅行足迹地图：高德地图记录旅程与时间线'.length);
  assert.equal(wrapCJK('', 10).join(''), '');
});

test('typeRotator：CSS 动画 + 自定义曲线 + 负相位延迟 + reduced-motion 降级', () => {
  const svg = typeRotator(10, 20, ['甲', '乙'], { fill: '#000' });
  // CSS 而非 SMIL（SMIL 无法响应 prefers-reduced-motion）
  assert.ok(!svg.includes('<animate'), '不得再输出 SMIL <animate>');
  assert.match(svg, /<style>/);
  assert.match(svg, new RegExp(`animation:trFade 7\\.5s ${EASE_IN_OUT.replace(/([()])/g, '\\$1')} infinite`));
  // 每条文案一条延迟，负相位错开（与旧 SMIL begin=-3.75s 语义一致）
  const delays = [...svg.matchAll(/animation-delay:(-?[\d.]+)s/g)].map((m) => Number(m[1]));
  assert.deepEqual(delays, [-3.75, 0]);
  // 关键帧与原 keyTimes 对齐（0/5%/32%/40%/100%），reduced-motion 只显示首条
  assert.match(svg, /@keyframes trFade\{0%\{opacity:0\}5%\{opacity:1\}32%\{opacity:1\}40%\{opacity:0\}100%\{opacity:0\}\}/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\{\.tr\{animation:none\}\.tr-a\{opacity:1\}\}/);
  assert.match(svg, /class="tr tr-a"[^>]*>甲<\/text>/);
});

test('未知语言回退灰色，已知语言命中 linguist 色', () => {
  assert.equal(langColor('TypeScript'), '#3178c6');
  assert.equal(langColor('不存在语'), '#8b949e');
});

/* ------------------------------------------------------------ 博客 RSS */

const RSS_XML = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>
<item><title><![CDATA[甲：CDATA 标题]]></title><link>https://xsfly.com/a</link><pubDate>Mon, 31 Aug 2026 17:30:00 +0000</pubDate></item>
<item><title>乙：普通标题</title><link>https://xsfly.com/b</link><pubDate>Mon, 24 Aug 2026 12:00:00 +0800</pubDate></item>
<item><title>丙：无日期</title><link>https://xsfly.com/c</link><pubDate>不是日期</pubDate></item>
<item><title>丁：缺链接</title><pubDate>Mon, 24 Aug 2026 12:00:00 +0800</pubDate></item>
</channel></rss>`;

test('parseRssItems：CDATA/普通标题、pubDate 按时区归日、坏条目跳过、max 截断', () => {
  const items = parseRssItems(RSS_XML, { max: 5, tzOffset: 8 });
  assert.equal(items.length, 3, '缺 link 的条目应跳过');
  assert.equal(items[0].title, '甲：CDATA 标题');
  assert.equal(items[0].link, 'https://xsfly.com/a');
  assert.equal(items[0].date, '09-01', '8/31 17:30 UTC → 北京 9/1');
  assert.equal(items[1].date, '08-24');
  assert.equal(items[2].date, '', '非法日期留空');
  assert.deepEqual(parseRssItems(RSS_XML, { max: 2, tzOffset: 8 }).map((i) => i.title), ['甲：CDATA 标题', '乙：普通标题']);
});

test('parseRssItems：XML 实体解码一次后再入卡', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>
<item><title>汤姆 &amp; 杰瑞 &#39;s &#x4E16;界</title><link>https://xsfly.com/e</link><pubDate>Mon, 31 Aug 2026 17:30:00 +0000</pubDate></item>
<item><title>A &amp;amp; B（双重转义只解一层）</title><link>https://xsfly.com/f</link><pubDate>Mon, 31 Aug 2026 17:30:00 +0000</pubDate></item>
</channel></rss>`;
  const items = parseRssItems(xml, { max: 5, tzOffset: 8 });
  assert.equal(items[0].title, "汤姆 & 杰瑞 's 世界", '命名/十进制/十六进制实体各解码一次');
  assert.equal(items[1].title, 'A &amp; B（双重转义只解一层）', '只解一层，不迭代解码');
});

test('fetchBlogPosts：HTTP 失败与空条目都抛错（由调用方降级跳卡）', async () => {
  await assert.rejects(
    () => fetchBlogPosts({ rssUrl: 'https://x/rss', fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /rss HTTP 503/,
  );
  await assert.rejects(
    () => fetchBlogPosts({ rssUrl: 'https://x/rss', fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<rss><channel></channel></rss>' }) }),
    /未解析到任何文章/,
  );
});

test('truncateCJK：单行截断以省略号收尾，不超宽不截', () => {
  assert.equal(truncateCJK('短标题', 56), '短标题');
  const cut = truncateCJK('很长的标题'.repeat(20), 10);
  assert.ok(cut.endsWith('…'), cut);
  // maxUnits 为全角单位（1 CJK 字 = 1 单位 = 2 格 visLen），省略号额外占 1 单位
  assert.ok(visLen(cut) <= 2 * 10 + visLen('…'), `截断结果宽度应约为 maxUnits 全角 + 省略号: ${visLen(cut)}`);
});

/* ------------------------------------------------------- 数据管线 */

test('calendarStats：连击/活跃/最佳单日（含今天未贡献的跳过规则）', () => {
  const days = [
    { date: 'd1', contributionCount: 1 },
    { date: 'd2', contributionCount: 5 },
    { date: 'd3', contributionCount: 0 }, // 断
    { date: 'd4', contributionCount: 2 },
    { date: 'd5', contributionCount: 3 },
    { date: 'd6', contributionCount: 0 }, // 今天还没贡献 → 不算断
  ];
  const s = calendarStats(days);
  assert.deepEqual(s, { current: 2, longest: 2, activeDays: 4, bestDay: 5 });
});

test('calendarStats：全零日历不炸', () => {
  const s = calendarStats(Array.from({ length: 7 }, (_, i) => ({ date: String(i), contributionCount: 0 })));
  assert.deepEqual(s, { current: 0, longest: 0, activeDays: 0, bestDay: 0 });
});

test('hoursFromEvents 按 UTC+8 归桶', () => {
  // 16:00 UTC = 北京 0 点（次日）
  const events = [
    { created_at: '2026-09-01T16:00:00Z' },
    { created_at: '2026-09-01T16:30:00Z' },
    { created_at: '2026-09-01T06:00:00Z' }, // 北京 14 点
  ];
  const hours = hoursFromEvents(events);
  assert.equal(hours[0], 2);
  assert.equal(hours[14], 1);
  assert.equal(hours.reduce((a, b) => a + b, 0), 3);
  // 非法时间被忽略
  assert.equal(hoursFromEvents([{ created_at: 'garbage' }]).reduce((a, b) => a + b, 0), 0);
});

test('hoursFromEvents：负时区偏移不丢事件（UTC 前段小时归本地前一日晚间桶', () => {
  // UTC 2 点 = UTC-5 的前一日 21 点；(2-5)%24 在 JS 里是 -3，事件曾被静默丢弃
  const events = [
    { created_at: '2026-09-01T02:00:00Z' },
    { created_at: '2026-09-01T04:30:00Z' },
    { created_at: '2026-09-01T23:00:00Z' }, // UTC-5 = 18 点
  ];
  const hours = hoursFromEvents(events, -5);
  assert.equal(hours[21], 1);
  assert.equal(hours[23], 1);
  assert.equal(hours[18], 1);
  assert.equal(hours.reduce((a, b) => a + b, 0), 3, '全部事件必须落在 0-23 桶内，不得丢失');
  assert.equal(Object.keys(hours).length, 24, '不得产生负数下标的扩展属性');
});

test('eventSpanDays：含首尾天数、封顶 90、空数据为 0', () => {
  assert.equal(eventSpanDays([{ created_at: '2026-09-01T06:00:00Z' }]), 1);
  assert.equal(eventSpanDays([
    { created_at: '2026-09-01T06:00:00Z' },
    { created_at: '2026-09-10T23:00:00Z' },
  ]), 10);
  assert.equal(eventSpanDays([
    { created_at: '2026-01-01T00:00:00Z' },
    { created_at: '2026-09-01T00:00:00Z' },
  ]), 90, '跨度封顶 90 天（API 只保留 90 天）');
  assert.equal(eventSpanDays([]), 0);
  assert.equal(eventSpanDays([{ created_at: 'garbage' }]), 0);
});

test('fetchHours：page 参数递增分页拉满，不重复计同一页', async () => {
  const seen = new Map();
  const makeEvents = (n, at) => Array.from({ length: n }, () => ({ created_at: at }));
  const pagedFetch = (url) => {
    const u = new URL(url);
    seen.set(Number(u.searchParams.get('page')), true);
    const page = Number(u.searchParams.get('page'));
    // 页 1/2 满 100 条，页 3 不足 100 条 → 应在第 3 页后停止
    const n = page <= 2 ? 100 : 30;
    return Promise.resolve({ ok: true, status: 200, json: async () => makeEvents(n, page === 3 ? '2026-09-10T06:00:00Z' : '2026-09-01T06:00:00Z') });
  };
  const { hours, spanDays } = await fetchProfileData({ user: 'x', token: 't', fetchImpl: (url) => {
    if (String(url).includes('graphql')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: GQL_FIXTURE }) });
    }
    return pagedFetch(url);
  } });
  assert.deepEqual([...seen.keys()].sort(), [1, 2, 3], '应请求 page=1,2,3 且各一次');
  assert.equal(hours[14], 230, '230 条事件全落北京 14 点桶（100+100+30，无重复计数）');
  assert.equal(spanDays, 10);
});

test('aggregateLanguages：字节聚合 + Other 归桶 + 空数据', () => {
  const repos = [
    { languages: { edges: [{ size: 700, node: { name: 'TypeScript' } }, { size: 100, node: { name: 'Shell' } }] } },
    { languages: { edges: [{ size: 200, node: { name: 'TypeScript' } }] } },
    { languages: { edges: [{ size: 300, node: { name: 'Rust' } }] } },
  ];
  const rows = aggregateLanguages(repos, 2);
  // 总 1300：TS 900→69%，Rust 300→23%，Shell 100→8%
  assert.deepEqual(rows, [
    { name: 'TypeScript', pct: 69 },
    { name: 'Rust', pct: 23 },
    { name: 'Other', pct: 8 },
  ]);
  assert.deepEqual(aggregateLanguages([{ languages: { edges: [] } }]), []);
  assert.deepEqual(aggregateLanguages([]), []);
});

const GQL_FIXTURE = {
  user: {
    repositories: {
      totalCount: 2,
      nodes: [
        { stargazerCount: 3, languages: { edges: [{ size: 60, node: { name: 'Python' } }, { size: 40, node: { name: 'HTML' } }] } },
        { stargazerCount: 10, languages: { edges: [{ size: 60, node: { name: 'Python' } }, { size: 40, node: { name: 'TypeScript' } }] } },
      ],
    },
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: 42,
        weeks: [{ contributionDays: [
          { date: 'a', contributionCount: 7 },
          { date: 'b', contributionCount: 0 },
          { date: 'c', contributionCount: 35 },
        ] }],
      },
    },
  },
};

test('normalize：星数/仓库/语言/日历归一', () => {
  const n = normalize(GQL_FIXTURE);
  assert.equal(n.stars, 13);
  assert.equal(n.repos, 2);
  assert.equal(n.contribs, 42);
  assert.equal(n.langs[0].name, 'Python');
  assert.equal(n.current, 1);
  assert.equal(n.longest, 1);
  assert.equal(n.bestDay, 35);
  assert.equal(n.activeDays, 2);
});

const okFetch = (url) => async (url_, opts) => {
  if (String(url_).includes('graphql')) {
    return { ok: true, status: 200, json: async () => ({ data: GQL_FIXTURE }) };
  }
  return { ok: true, status: 200, json: async () => [{ created_at: '2026-09-01T06:00:00Z', type: 'PushEvent' }] };
};

test('fetchProfileData 成功路径：GraphQL + events（注入 fetch，离线）', async () => {
  const data = await fetchProfileData({ user: 'baoxinwen', token: 't', fetchImpl: okFetch() });
  assert.equal(data.stars, 13);
  assert.equal(data.hours[14], 1);
  assert.equal(data.spanDays, 1);
  assert.equal(data.tzOffset, 8);
});

test('fetchProfileData：GraphQL 失败必须抛错（不产出假数据）', async () => {
  const bad = async () => ({ ok: false, status: 502, json: async () => ({}) });
  await assert.rejects(() => fetchProfileData({ user: 'x', token: 't', fetchImpl: bad }), /GraphQL HTTP 502/);
});

test('fetchProfileData：events 失败降级为 hours=null，不阻断', async () => {
  const fetchImpl = async (url_) => {
    if (String(url_).includes('graphql')) {
      return { ok: true, status: 200, json: async () => ({ data: GQL_FIXTURE }) };
    }
    return { ok: false, status: 403, json: async () => ({}) };
  };
  const data = await fetchProfileData({ user: 'x', token: 't', fetchImpl });
  assert.equal(data.hours, null);
  assert.equal(data.stars, 13);
});

test('fetchProfileData：用户不存在抛错', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: { user: null } }) });
  await assert.rejects(() => fetchProfileData({ user: 'ghost', token: 't', fetchImpl }), /不存在/);
});

test('仓库查询按星数排序取前 100（>100 仓库时 STARS 口径尽量一致', async () => {
  let query = '';
  const fetchImpl = async (url, opts) => {
    if (String(url).includes('graphql')) {
      query = JSON.parse(opts.body).query;
      return { ok: true, status: 200, json: async () => ({ data: GQL_FIXTURE }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  await fetchProfileData({ user: 'x', token: 't', fetchImpl });
  assert.match(query, /orderBy:\s*\{\s*field:\s*STARGAZERS,\s*direction:\s*DESC\s*\}/, 'repositories 应带 orderBy STARGAZERS');
});

test('出站请求携带 AbortSignal', async () => {
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url: String(url), signal: opts?.signal });
    if (String(url).includes('graphql')) {
      return { ok: true, status: 200, json: async () => ({ data: GQL_FIXTURE }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  await fetchProfileData({ user: 'x', token: 't', fetchImpl });
  assert.ok(seen.length >= 2, 'GraphQL 与 events 请求都应发出');
  for (const s of seen) {
    assert.ok(s.signal instanceof AbortSignal, `出站请求应带 AbortSignal: ${s.url}`);
  }
});

test('上游挂起时按超时快速失败，不等 workflow 级兜底', async () => {
  // AbortSignal.timeout 的定时器是 unref 的：纯 stub 无真实 I/O 时事件循环会先排空，
  // 自持一个活跃句柄让 20ms 的 abort 有机会触发（真实 fetch 有在途 socket，无此问题）
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const hanging = (url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error(`request timed out (${opts.signal.reason?.name})`)));
    });
    await assert.rejects(() => fetchBlogPosts({ rssUrl: 'https://x/rss', fetchImpl: hanging, timeoutMs: 20 }), /timed out/);
    await assert.rejects(() => fetchProfileData({ user: 'x', token: 't', fetchImpl: hanging, timeoutMs: 20 }), /timed out/);
  } finally {
    clearTimeout(keepAlive);
  }
});

/* ------------------------------------------------------------ 博客卡渲染 */

const BLOG_INPUT = {
  site: '浮生闲记',
  slogan: '以文字为舟，溯流时光之河',
  url: 'xsfly.com',
  posts: [
    { title: '文章一：标题', link: '', date: '09-01' },
    { title: '文章二：标题', link: '', date: '08-24' },
    { title: '文章三：标题', link: '', date: '08-12' },
    { title: '文章四：标题', link: '', date: '07-30' },
    { title: '文章五：标题', link: '', date: '07-18' },
  ],
};

test('renderBlog：全页单一强调色入画、5 行文章、标语与链接齐备', () => {
  const svg = renderBlog(TOKENS.light, BLOG_INPUT);
  assert.match(svg, /viewBox="0 0 830 210"/);
  assert.match(svg, new RegExp(TOKENS.light.accent), '浅色应含冰青强调色');
  assert.ok(!svg.includes('#DC2F55') && !svg.includes('#F2799B'), '玫红品牌色已废除');
  assert.match(svg, /以文字为舟，溯流时光之河/);
  assert.match(svg, /→ xsfly\.com/);
  assert.match(svg, /fill-opacity="0\.6"/, '浅色玻璃卡面应带透过率');
  assert.equal((svg.match(/font-size="12\.5"/g) || []).length, 5, '5 条文章标题行');
  const dark = renderBlog(TOKENS.dark, BLOG_INPUT);
  assert.match(dark, new RegExp(TOKENS.dark.accent), '深色应含亮青强调色');
  assert.match(dark, /fill-opacity="0\.045"/, '深色玻璃卡面应为 4.5% 白');
});

test('renderBlog：超长标题单行截断不溢出', () => {
  const long = { ...BLOG_INPUT, posts: [{ title: '很长的标题'.repeat(20), link: '', date: '09-01' }] };
  const svg = renderBlog(TOKENS.light, long);
  assert.match(svg, /…<\/text>/, '超长标题应以省略号收尾');
});

/* ------------------------------------------------------------ 渲染 */

const RENDER_INPUT = {
  tokens: TOKENS,
  hero: { user: 'baoxinwen', taglines: ['后端工程师 · 自托管工具匠人', '正在学 Rust'], meta: ['blog    浮生闲记'] },
  projects: [
    { name: 'footprint', desc: '私人自托管旅行足迹地图，Docker Compose 一键部署', stack: 'Python · Flask', repo: 'baoxinwen/footprint', lang: 'Python' },
    { name: 'CopyTree', desc: '右键复制目录树', stack: 'Python', repo: 'baoxinwen/CopyTree' },
    { name: 'hotsearch-monitor', desc: '热搜聚合监控', stack: 'TypeScript', repo: 'baoxinwen/hotsearch-monitor' },
    { name: 'PromptMate', desc: '提示词管理', stack: 'Rust', repo: 'baoxinwen/PromptMate' },
  ],
  stars: 13, contribs: 865, repos: 19,
  langs: [{ name: 'TypeScript', pct: 37 }, { name: 'Python', pct: 26 }, { name: 'Other', pct: 37 }],
  current: 10, longest: 10, activeDays: 95, bestDay: 54,
  hours: [5, 5, 2, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 15, 0, 3, 2, 5, 2, 0, 0, 0, 2, 2],
};

test('renderAll：28 个资产成对输出，结构完整无坏值', () => {
  const all = renderAll(RENDER_INPUT);
  assert.equal(all.length, 28); // (1 hero + 5 头 + 3 数据 + 4 项目 + 1 页脚) × 2
  const names = new Set(all.map((a) => a.name));
  for (const n of names) {
    assert.ok(all.some((a) => a.name === n && a.mode === 'light'), `${n} 缺 light`);
    assert.ok(all.some((a) => a.name === n && a.mode === 'dark'), `${n} 缺 dark`);
  }
  for (const { name, mode, svg } of all) {
    assert.match(svg, /^<svg xmlns=/, `${name}.${mode} 根元素`);
    assert.match(svg, /aria-label=/, `${name}.${mode} 无障碍标签`);
    assert.ok(!/NaN|undefined|\bnull\b/.test(svg), `${name}.${mode} 含坏值`);
    assert.ok(!svg.includes('—'), `${name}.${mode} 疑似占位符`);
  }
});

test('renderAll：同一组件深浅两版颜色不同（picture 切换有意义）', () => {
  const all = renderAll(RENDER_INPUT);
  const light = all.find((a) => a.name === 'stats' && a.mode === 'light').svg;
  const dark = all.find((a) => a.name === 'stats' && a.mode === 'dark').svg;
  assert.notEqual(light, dark);
  assert.match(light, new RegExp(TOKENS.light.ink));
  assert.match(dark, new RegExp(TOKENS.dark.ink));
});

test('renderAll：全部资产零 SMIL 动画；<style> 只出现在 hero', () => {
  const all = renderAll(RENDER_INPUT);
  for (const { name, mode, svg } of all) {
    assert.ok(!svg.includes('<animate'), `${name}.${mode} 不得含 SMIL <animate>`);
    if (name !== 'hero') assert.ok(!svg.includes('<style>'), `${name}.${mode} 不应含 <style>`);
  }
  const hero = all.find((a) => a.name === 'hero' && a.mode === 'light').svg;
  assert.match(hero, /@keyframes trFade/);
  assert.match(hero, /@keyframes pl/);
  assert.match(hero, /prefers-reduced-motion/g);
});

test('卡片投影 filter 每个资产只定义一次（defs 重复 push 回归）', () => {
  const all = renderAll(RENDER_INPUT);
  for (const { name, mode, svg } of all) {
    for (const m of svg.matchAll(/id="(sh-[^"]+)"/g)) {
      const count = svg.split(`id="${m[1]}"`).length - 1;
      assert.equal(count, 1, `${name}.${mode} 的 ${m[1]} 定义了 ${count} 次（应只 1 次）`);
    }
  }
});

test('区块头发丝线起点按 CJK 感知宽度估算（混排标题不留大空隙）', () => {
  const all = renderAll(RENDER_INPUT);
  // “GitHub 数据” visLen=11：期望起点 66 + 11×14.5×0.72 + 22 ≈ 203
  const hd = all.find((a) => a.name === 'hd-data' && a.mode === 'light').svg;
  const m = hd.match(/<line x1="([\d.]+)" y1="24"/);
  const x1 = Number(m[1]);
  assert.ok(x1 > 190 && x1 < 216, `发丝线起点应为 ~203，实际 ${x1}`);
  // 纯 CJK 标题（关于：66 + 4×10.44 + 22 ≈ 129.8）
  const about = all.find((a) => a.name === 'hd-about' && a.mode === 'light').svg;
  const m2 = about.match(/<line x1="([\d.]+)" y1="24"/);
  assert.ok(Number(m2[1]) > 122 && Number(m2[1]) < 138, `关于头发丝线起点异常: ${m2[1]}`);
});

test('页脚与 hero 年份取当前年份（不硬编码）', () => {
  const all = renderAll(RENDER_INPUT);
  const year = String(new Date().getFullYear());
  assert.match(all.find((a) => a.name === 'footer' && a.mode === 'light').svg, new RegExp(`© ${year} baoxinwen`));
  assert.match(all.find((a) => a.name === 'hero' && a.mode === 'light').svg, new RegExp(`open to build · ${year}`));
});

test('页脚不承诺每日更新（GitHub schedule 为尽力而为，实测会缺跑', () => {
  const all = renderAll(RENDER_INPUT);
  const footer = all.find((a) => a.name === 'footer' && a.mode === 'light').svg;
  assert.ok(!/updated daily/i.test(footer), `页脚不得承诺 updated daily:\n${footer}`);
});

test('时段图标签反映真实跨度：有数据显示天数，降级显示“近期”', () => {
  const withSpan = renderStreakHours(TOKENS.light, [{ v: '1 天', label: 'l', en: 'e' }], RENDER_INPUT.hours, { tz: 8, spanDays: 10 });
  assert.match(withSpan, /活跃时段 · 近 10 天公开活动/);
  const degraded = renderStreakHours(TOKENS.light, [{ v: '1 天', label: 'l', en: 'e' }], Array(24).fill(0));
  assert.match(degraded, /活跃时段 · 近期公开活动/);
});

test('卡片投影：浅色玻璃卡带紫调柔影，深色不用投影（靠描边 + 内高光分层）', () => {
  const all = renderAll(RENDER_INPUT);
  const light = all.find((a) => a.name === 'hero' && a.mode === 'light').svg;
  const dark = all.find((a) => a.name === 'hero' && a.mode === 'dark').svg;
  assert.match(light, new RegExp(`filter id="sh-hero"[\\s\\S]*flood-color="${TOKENS.light.shadowColor}"`));
  assert.match(light, /filter="url\(#sh-hero\)"/);
  assert.ok(!dark.includes('feDropShadow'), '深色玻璃卡应无投影');
  assert.match(dark, /fill-opacity="0\.045"/, '深色卡面为半透明白');
  assert.match(dark, /stroke="rgba\(255,255,255,0\.09\)"/, '深色发丝描边');
  assert.match(dark, /stroke="rgba\(255,255,255,0\.12\)"/, '深色上缘内高光');
  // 区块头保持扁平，不套卡不带投影
  const header = all.find((a) => a.name === 'hd-about' && a.mode === 'light').svg;
  assert.ok(!header.includes('feDropShadow'), '区块头应无投影');
});

test('光晕：hero 双粒漂移（含动画 CSS），stats/streak/project 静态单粒，其余无光晕', () => {
  const all = renderAll(RENDER_INPUT);
  const hero = all.find((a) => a.name === 'hero' && a.mode === 'dark').svg;
  assert.match(hero, /class="gl1"/);
  assert.match(hero, /class="gl2"/);
  assert.match(hero, /@keyframes glA/);
  assert.match(hero, /prefers-reduced-motion: reduce\)\{\.gl1,\.gl2\{animation:none\}/);
  for (const name of ['stats', 'streak', 'project-1']) {
    const svg = all.find((a) => a.name === name && a.mode === 'dark').svg;
    assert.ok(svg.includes(`fill="${TOKENS.dark.glowA}"`) || svg.includes(`fill="${TOKENS.dark.glowB}"`), `${name} 应有静态光晕`);
    assert.ok(!svg.includes('<style>'), `${name} 不应含动画 CSS（动效集中在 hero）`);
  }
  for (const name of ['langs', 'hd-about', 'footer']) {
    const svg = all.find((a) => a.name === name && a.mode === 'dark').svg;
    assert.ok(!svg.includes('gl-'), `${name} 不应有光晕`);
  }
  // blog 卡在 renderAll 中按数据可选输出(renderBlog 直测见上)
  const blog = all.find((a) => a.name === 'blog' && a.mode === 'dark');
  if (blog) assert.ok(!blog.svg.includes('gl-'), 'blog 不应有光晕');
});

test('项目卡：编号、主语言色点（无语言则省略）', () => {
  const all = renderAll(RENDER_INPUT);
  const p1 = all.find((a) => a.name === 'project-1' && a.mode === 'light').svg;
  const p2 = all.find((a) => a.name === 'project-2' && a.mode === 'light').svg;
  assert.match(p1, /01 \/ 04/);
  assert.match(p1, /circle cx="33\.5" cy="141" r="3\.5" fill="#3572A5"/, 'Python 语言色点');
  assert.ok(!p2.includes('cx="33.5"'), '无主语言时不画色点');
});

test('renderStats：真实数字入画，零值正常渲染', () => {
  const svg = renderStats(TOKENS.light, [
    { v: '0', label: 'STARS' }, { v: '865', label: 'CONTRIBS / YR' },
  ]);
  assert.match(svg, />0<\/text>/);
  assert.match(svg, />865<\/text>/);
});

test('renderStreakHours：全零时段只画基线，不标峰值', () => {
  const svg = renderStreakHours(TOKENS.light, [{ v: '0 天', label: '当前连击', en: 'current' }], Array(24).fill(0));
  assert.ok(!/NaN/.test(svg));
  assert.ok(!svg.includes(`fill="${TOKENS.light.accent}"`), '全零时不应有 accent 峰值柱');
});

test('renderLangs：官方语言色入画', () => {
  const svg = renderLangs(TOKENS.light, [{ name: 'TypeScript', pct: 100 }]);
  assert.match(svg, /#3178c6/);
});

test('renderLangs：舍入和超过 100% 时按总和归一，堆叠条不越内容右缘', () => {
  // 真实分布多数段向上取整：6 段各 16.7% → 全 17%，和 102
  const six = ['TypeScript', 'Python', 'HTML', 'JavaScript', 'Vue', 'CSS'].map((name) => ({ name, pct: 17 }));
  const svg = renderLangs(TOKENS.light, six);
  const ends = [...svg.matchAll(/<rect x="([\d.]+)" y="60" width="([\d.]+)"/g)]
    .map((m) => Number(m[1]) + Number(m[2]));
  assert.equal(ends.length, 6);
  const lastEnd = Math.max(...ends);
  assert.ok(lastEnd <= 786 + 0.5, `末段右缘 ${lastEnd} 应 <= 786（内容右缘 RIGHT）`);
});

test('renderLangs：无语言数据时渲染空态文案而非空白卡', () => {
  const svg = renderLangs(TOKENS.light, []);
  assert.match(svg, /viewBox="0 0 830 130"/, '保持标准卡高，README 引用不落空');
  assert.match(svg, /NO PUBLIC LANGUAGE DATA YET/);
  assert.ok(!/<rect x="44" y="60"/.test(svg), '空态不画堆叠条');
});

test('renderLangs：行数多时自适应增高，最后一行不贴底边', () => {
  const names = ['TypeScript', 'Python', 'HTML', 'JavaScript', 'Vue', 'CSS', 'Go', 'Rust', 'Shell'];
  const rows = (n) => renderLangs(TOKENS.light, names.slice(0, n).map((name, i) => ({ name, pct: i ? 1 : 92 })));
  // 6 条（3 行）→ 182；7 条（4 行）→ 208；底距恒为 24
  assert.match(rows(6), /viewBox="0 0 830 182"/);
  assert.match(rows(7), /viewBox="0 0 830 208"/);
  const nine = rows(9);
  const h = Number(nine.match(/height="(\d+)"/)[1]);
  assert.equal(h - (106 + (Math.ceil(9 / 2) - 1) * 26), 24, '末行基线与卡底距离应恒为 24');
});
