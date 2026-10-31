/**
 * 新着マーカーの RSS 2.0（T47）。ビルドのたびに公開データ（markers.json）から作る（vite.config.ts）。
 * 公開は push 時も毎晩の同期のあとも Actions のビルドを通るので、どちらでも新着が載る。
 * リンクは地図の共有 URL（?m=<ID>。T42）。開くとそのマーカーが開いた地図になる。
 */

export const SITE_URL = 'https://loca-project.github.io';
/** 載せる件数（新しく登録された順） */
export const FEED_LIMIT = 50;

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // XML 1.0 で使えない制御文字を落とす（タブ・改行は残す）
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const rfc822 = (ms) => new Date(ms).toUTCString();

function describe(m) {
  const place = [m.prefecture, m.city].filter(Boolean).join(' ');
  const who = m.official ? `公式の紹介: ${m.official.provider}` : m.createdBy ? `投稿: ${m.createdBy}` : '';
  return [place, m.memo, who].filter(Boolean).join(' / ');
}

/**
 * @param {{ markers: Array<Record<string, any>>, siteUrl?: string, generatedAt?: number }} input
 * @returns {{ xml: string, items: number }}
 */
export function buildFeed({ markers, siteUrl = SITE_URL, generatedAt = Date.now() }) {
  const base = siteUrl.replace(/\/+$/, '');
  const latest = markers
    .filter((m) => m && m.id && !m.deleted && Number.isFinite(m.createdAt))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, FEED_LIMIT);

  const items = latest.map((m) => {
    const link = `${base}/?m=${encodeURIComponent(m.id)}`;
    return [
      '    <item>',
      `      <title>${escapeXml(m.title || '（題名なし）')}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">loca-marker-${escapeXml(m.id)}</guid>`,
      `      <pubDate>${rfc822(m.createdAt)}</pubDate>`,
      `      <description>${escapeXml(describe(m))}</description>`,
      '    </item>',
    ].join('\n');
  });

  const lastBuild = latest[0]?.createdAt ?? generatedAt;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Loca の新着マーカー</title>',
    `    <link>${escapeXml(`${base}/`)}</link>`,
    `    <atom:link href="${escapeXml(`${base}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    '    <description>Loca の地図に新しく登録された動画</description>',
    '    <language>ja</language>',
    `    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
  return { xml, items: items.length };
}
