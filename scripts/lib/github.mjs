/**
 * GitHub 数据获取与归一化。
 * GraphQL 一次调用取全量画像；REST events 拉满 10 页（API 仅保留近 90 天）算时段分布
 * （次要数据，失败降级为 null）。
 * 所有函数纯数据进出（fetch 可注入），便于离线测试。
 */

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const EVENTS_ENDPOINT = (u, page) => `https://api.github.com/users/${u}/events/public?per_page=100&page=${page}`;
const TZ_OFFSET = 8; // 北京时间（可用 TZ_OFFSET 环境变量覆盖）
// 出站请求超时：上游 TCP 挂起时快速失败，不等 workflow 级 5 分钟兜底
const REQUEST_TIMEOUT_MS = 15_000;

async function graphql(query, variables, token, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS) {
  const res = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'profile-assets-generator',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(`GraphQL errors: ${payload.errors.map((e) => e.message).join('; ')}`);
  return payload.data;
}

/** 从贡献日历推导连击 / 活跃统计（纯函数） */
export function calendarStats(days) {
  let longest = 0, run = 0, activeDays = 0, bestDay = 0;
  for (const d of days) {
    const c = d.contributionCount;
    if (c > 0) { activeDays++; run++; longest = Math.max(longest, run); bestDay = Math.max(bestDay, c); }
    else run = 0;
  }
  // 当前连击：从最后一天往回数；今天还没贡献则允许从昨天起算
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const c = days[i].contributionCount;
    if (c > 0) current++;
    else if (i === days.length - 1) continue; // 今天尚无贡献，不算断
    else break;
  }
  return { current, longest, activeDays, bestDay };
}

/** events → 24 小时分布（本地时区 UTC+offset，纯函数） */
export function hoursFromEvents(events, tzOffset = TZ_OFFSET) {
  const hours = Array(24).fill(0);
  for (const e of events) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    // % 保留被除数符号：负偏移会算出负下标静默丢事件，先取模再 +24 归一到 [0,23]
    hours[((d.getUTCHours() + tzOffset) % 24 + 24) % 24]++;
  }
  return hours;
}

/** events 覆盖的活跃跨度（按 UTC 日历日差含首尾，封顶 90 —— API 只保留 90 天）；空数据为 0（纯函数） */
export function eventSpanDays(events) {
  const times = events
    .map((e) => new Date(e.created_at).getTime())
    .filter(Number.isFinite);
  if (!times.length) return 0;
  const day = (t) => Math.floor(t / 86_400_000);
  return Math.min(90, day(Math.max(...times)) - day(Math.min(...times)) + 1);
}

async function fetchHours(user, token, fetchImpl, { maxPages = 10, tzOffset = TZ_OFFSET, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const events = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchImpl(EVENTS_ENDPOINT(user, page), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'profile-assets-generator',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`events HTTP ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (batch.length < 100) break;
  }
  return { hours: hoursFromEvents(events, tzOffset), spanDays: eventSpanDays(events) };
}

/** 语言字节聚合 → 前 N + Other（纯函数） */
export function aggregateLanguages(repos, topN = 6) {
  const bytes = new Map();
  for (const r of repos) {
    for (const edge of r.languages?.edges ?? []) {
      const name = edge.node.name;
      bytes.set(name, (bytes.get(name) ?? 0) + edge.size);
    }
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const sorted = [...bytes.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, topN);
  const rest = sorted.slice(topN).reduce((a, [, v]) => a + v, 0);
  const rows = head.map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }));
  if (rest > 0) rows.push({ name: 'Other', pct: Math.round((rest / total) * 100) });
  return rows;
}

/** GraphQL 响应 → 渲染所需的数据形状（纯函数） */
export function normalize(gql) {
  const u = gql.user;
  const repos = u.repositories.nodes;
  const cal = u.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) => w.contributionDays);
  const stats = calendarStats(days);
  const primaryLangByRepo = Object.fromEntries(
    repos
      .filter((r) => r.primaryLanguage)
      .map((r) => [r.name.toLowerCase(), r.primaryLanguage.name]),
  );
  return {
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    repos: u.repositories.totalCount,
    contribs: cal.totalContributions,
    langs: aggregateLanguages(repos),
    primaryLangByRepo,
    ...stats,
  };
}

const QUERY = /* GraphQL */ `
  query($login: String!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
          name
          primaryLanguage { name }
          languages(first: 10) { edges { size node { name } } }
        }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

/**
 * 拉取主页所需的全部数据。
 * @returns {Promise<{stars:number, repos:number, contribs:number, langs:{name,pct}[], current:number, longest:number, activeDays:number, bestDay:number, hours:number[]|null, spanDays:number|null, tzOffset:number}>}
 */
export async function fetchProfileData({ user, token, fetchImpl = fetch, tzOffset = TZ_OFFSET, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const data = await graphql(QUERY, { login: user }, token, fetchImpl, timeoutMs);
  if (!data.user) throw new Error(`GitHub 用户不存在: ${user}`);
  let hours = null;
  let spanDays = null;
  try {
    const fetched = await fetchHours(user, token, fetchImpl, { tzOffset, timeoutMs });
    hours = fetched.hours;
    spanDays = fetched.spanDays;
  } catch (e) {
    console.warn(`[warn] events 获取失败，时段图降级为空分布: ${e.message}`);
  }
  return { ...normalize(data), hours, spanDays, tzOffset };
}
