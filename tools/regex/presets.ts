export interface RegexPreset {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  sample: string;
}

export const regexPresets: readonly RegexPreset[] = [
  { id: 'email', name: '邮箱（常见格式）', pattern: String.raw`\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`, flags: 'gi', sample: 'Contact: hello@example.com\nSupport: dev@xtools.app' },
  { id: 'url', name: '网址（HTTP / HTTPS）', pattern: String.raw`https?:\/\/[^\s<>"']+`, flags: 'gi', sample: 'https://example.com/docs?q=regex\nhttp://localhost:3000/' },
  { id: 'ipv4', name: 'IPv4 地址', pattern: String.raw`(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?![\w.])`, flags: 'g', sample: '127.0.0.1\n192.168.1.10\n255.255.255.255' },
  { id: 'date', name: '日期（YYYY-MM-DD 格式）', pattern: String.raw`\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b`, flags: 'g', sample: '2026-09-30\n2026-12-01' },
  { id: 'time', name: '时间（24 小时 HH:mm:ss）', pattern: String.raw`\b(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\b`, flags: 'g', sample: '09:30:00\n23:59:59' },
  { id: 'integer', name: '整数', pattern: String.raw`(?<![\w.+-])[+-]?\d+(?![\w.])`, flags: 'g', sample: '-42 0 +18 2026' },
  { id: 'decimal', name: '小数', pattern: String.raw`(?<![\w.+-])[+-]?\d+\.\d+(?![\w.])`, flags: 'g', sample: '-3.14 +0.5 12.75' },
  { id: 'chinese', name: '中文汉字', pattern: String.raw`\p{Script=Han}+`, flags: 'gu', sample: '你好，开发者。Hello, XTools!' },
  { id: 'uuid', name: 'UUID v4', pattern: String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b`, flags: 'gi', sample: '550e8400-e29b-41d4-a716-446655440000' },
  { id: 'hex-color', name: '十六进制颜色（3 / 6 位）', pattern: String.raw`#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![\w])`, flags: 'gi', sample: '#fff #257257 #A0B1C2' },
  { id: 'whitespace', name: '连续空白', pattern: String.raw`\s+`, flags: 'g', sample: 'alpha  beta\tgamma\nnext line' },
  { id: 'blank-line', name: '空白行', pattern: String.raw`^[ \t]*\r?$`, flags: 'gm', sample: 'first\n\n   \nlast' },
];

export function mergeRegexFlags(current: string, required: string): string {
  return [...'gimsu'].filter((flag) => current.includes(flag) || required.includes(flag)).join('');
}
