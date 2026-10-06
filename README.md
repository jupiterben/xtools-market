# XTools Market

以 GitHub 仓库维护、GitHub Actions 校验、GitHub Pages 托管的静态工具市场。不需要 API 服务器、数据库或 Docker。

正式市场源：**https://jupiterben.github.io/xtools-market/**

客户端读取签名目录，在本地完成搜索、分类与版本比较，再下载并验证工具包。已安装工具继续离线使用。

## 启动与验证

```powershell
npm ci
npm run check
npm test
npm run registry:verify
npm run tools:check
npm run build
npx playwright install chromium
npm run test:web
npm run preview
```

`npm run build` 生成 `_site/`，`npm run preview` 仅用于本地预览，监听 `127.0.0.1:1430`。生产不运行 Node 服务。

静态文件：

| 路径 | 用途 |
| --- | --- |
| `index.html` | Grid Card 首页：搜索、分类、工具详情、唤起客户端安装、复制市场源 |
| `market.css` / `market.js` / `favicon.png` | 自托管首页资源，不依赖外部 CDN |
| `catalog.json` | Ed25519 签名目录，包含元数据和已发布版本 |
| `packages/<sha256>.xtool` | HTML 工具包的原始字节，以数据扩展名下载 |
| `health.json` | 静态产物状态与工具数量 |

`registry/catalog.json` 的 `payload` 是待验签的原始 UTF-8 JSON 字符串，`signature` 是 Ed25519 签名（hex）。公钥见 `registry/trust.json`，客户端必须事先固定公钥，不能从同一个不可信请求临时采信公钥。目录包含工具信息、API 版本、包长度和 SHA-256。

发布器先验证签名和所有包，再按白名单导出首页及其资源、目录、包和健康文件。首页由已验证的最新版本信息在构建时生成，禁用 JavaScript 时仍能查看工具并使用安装链接；搜索、分类、详情弹窗和复制在浏览器本地完成。

网页的“安装”使用自定义 URL 协议，例如 `xtools://install?id=json`，由浏览器请求打开 XTools 客户端，不直接下载 `.xtool`。网页显示打开客户端的提示、重试入口和客户端 Releases 链接，不尝试判断客户端是否已安装，也不把唤起当作安装成功。需要安装支持此协议的新版客户端；旧安装包需升级。

客户端兼容冷启动和已运行实例，只接受工具 ID，从客户端配置的受信任市场读取并验证目录后展示工具详情，由用户确认安装当前最新版本。协议不允许指定任意下载 URL、市场源或跳过签名验证；下载和 SHA-256 校验仍由客户端完成。

`.xtool` 只是分发扩展名，字节与签名摘要不变；不会在 Pages 域名下作为 HTML 页面执行。发布产物不包含 `.keys`、工具源码、node_modules 或 Git 数据。GitHub Pages 的站点子路径必须保留，拼接时用 `catalog.json` 而不是 `/catalog.json`。

## 工具发布

首版采用 GitOps 发布，不开放匿名上传。`tools/` 是官方工具源码，`registry/` 是签名发布产物。每款工具独立构建，包绑定工具 ID，版本不可覆盖。已有版本内容变化必须提升 `tools/catalog.json` 的版本号。

```powershell
# 仅首次建立一个全新市场时运行，已有 trust.json 不要重新生成
npm run keys:init

# 私钥默认放在 .keys/market.pem，或通过 SIGNING_KEY_FILE 指向安全位置
npm run tools:release
npm run registry:verify
```

提交源码和签名后的 registry 产物，通过 PR 审核后合并 main。新机器需要原私钥才能发布新工具；私钥不在 Git、Actions 日志或 Pages 产物中。请安全备份，丢失需做客户端信任迁移。CI 只有公钥，可验证产物而不能伪造新工具包。

当前 8 款工具的源码按工具 ID 分组，每款工具有独立的 `index.html` 和 `main.ts` 入口：

```text
tools/
  base64/       # Base64 编解码
  diff/         # 文本差异
  hash/         # 哈希计算
  json/         # JSON 工作室
  regex/        # 正则表达式：独立界面、presets.ts 和 style.css
  timestamp/    # 时间戳转换
  url/          # URL 编解码
  uuid/         # UUID 生成器
  shared/       # 共享 UI、自动处理调度、样式、消息协议、Worker 和转换引擎
  catalog.json  # 工具元数据和版本
  tsconfig.json
```

发布和源码校验统一构建 `tools/<id>/index.html`，输出 `.build/<id>/index.html`，不再按工具名设置特殊入口。新增工具时，在 `catalog.json` 注册元数据并建立对应 ID 的目录和入口。除正则外，其余工具的 `main.ts` 复用 `shared/main.ts`；正则界面修改不会改变其他工具的包。各工具保留独立版本和绑定 ID 的包，共用转换引擎。更细粒度的按需拆分依赖、第三方上传审核、用户评分、撤销列表和客户端自动更新不在这一版范围内。签名证明发布来源，不证明代码无漏洞；发布前必须审查工具代码。

### 低点击操作流程

- 8 款工具共用自动处理调度：输入停顿 250ms 后更新，切换选项立即更新。中文输入法组合期间暂停，超时或失败不会自动重试；新输入会取消旧任务并清空过期结果。
- JSON：格式化 / 压缩、2 / 4 空格直接切换。Base64 / URL：编码 / 解码直接切换，结果旁“反向转换”将结果作为输入并切换方向。
- 时间戳：默认自动识别常见秒与毫秒格式（13 位及以上整数部分视为毫秒），可显式切换；“当前时间”按所选单位填入并转换。历史短毫秒值或超长秒值请显式选单位。
- UUID：打开即生成 5 个，数量输入与 1 / 5 / 10 / 20 / 100 快捷数量自动生成，“重新生成”得到新的一批。清空后的撤销恢复原 UUID，不重新随机生成。
- 哈希算法一键切换；文本差异同时监听两边输入，支持一键交换两段文本。
- 结果区就近复制，受限环境下给出手动复制反馈；清空、示例、反向转换及正则预设替换可撤销（最多 10 步，只驻留当前工具内存）。
- 文本编辑器默认留空，不必先删除示例；时间戳和 UUID 直接显示初始结果。示例文本与当前编解码方向匹配。
- 不提供“运行”作为必经步骤；Ctrl/Cmd+Enter 可立即重新处理当前输入。超时保护、大小限制、市场签名和沙箱隔离不变。

本次版本：正则 `1.2.0`，其余 7 款 `1.1.0`。历史签名包保留，不覆盖已有版本。

### 正则表达式 1.2.0

- 表达式编辑区铺满可用宽度，初始高度 104px，支持换行和纵向拖动调整。
- 12 个预设：常见邮箱、HTTP/HTTPS 网址、IPv4、日期格式、24 小时时间、整数、小数、中文汉字、UUID v4、十六进制颜色、连续空白、空白行。
- 预设直接展示为快捷项，点击一次即应用并匹配。默认“替换”整条表达式和标记；切换到“插入”模式后，在光标或选区处插入并合并必需标记。两者都保留待匹配文本；“载入示例”才载入所选预设的示例文本。
- 保留全局匹配、捕获组输出、1000 个匹配上限与 Worker 超时保护。修改表达式、输入或标记会清空旧结果并取消进行中的匹配。
- 预设是文本匹配模板，不是业务数据验证器；日期只检查格式及月/日范围，不检查闰年或具体月份的天数，邮箱与网址也不验证实际可用性。

`npm run tools:preview -- regex` 会验证签名并生成 `.build/preview-regex.html`；`npm run tools:preview -- all` 生成 `.build/preview-tools.html`，可切换所有工具并保留本次预览输入。两者可直接在浏览器打开，使用与客户端相同的沙箱和消息协议。已安装旧版工具不会因源码变化自动更新；市场发布新包后需卸载并重新安装工具。

## GitHub CI/CD

- `CI`：PR / main 上运行类型检查、签名与完整性测试、源代码与已签名包一致性检查、静态构建及本地 HTTP 下载验证。
- `Deploy Market Pages`：main 验证通过后上传 `_site`，通过官方 Pages Actions 原子部署，再检查根首页 HTTP 200、页面资源、目录版本、CORS 和全部包摘要。
- 浏览器测试覆盖搜索分类、详情弹窗、安装协议链接与重试提示、不触发包下载、剪贴板失败反馈、无 JavaScript 访问、深浅主题和桌面/手机布局。
- 只有 deploy job 获得 `pages:write` 和 `id-token:write`，PR 没有发布权限。不需要 PAT、SSH 密码或 CI 签名私钥。
- Pages Source 必须为 **GitHub Actions**（仓库 Settings → Pages）。当前仓库已启用工作流部署。
- 手动运行工作流也只允许 main 发布，避免旧分支覆盖市场。
- Dependabot 检查 npm 和 GitHub Actions。依赖改变若导致已发布工具包字节变化，CI 会拒绝，需要提升工具版本并重新签名。

正式发布验证也可手动执行：

```powershell
npm run site:verify -- https://jupiterben.github.io/xtools-market/
```

生产不再使用 `/v1/*` API，旧 Docker 发布工作流已移除，之前的 GHCR 镜像保留但不再更新。客户端需升级到静态源协议。仓库本身是唯一维护入口，不频繁调用 GitHub API，因此浏览工具无需 GitHub 登录或 token。

## 回滚与边界

回滚市场内容时，在 main 恢复可信的目录并发布；保留仍被缓存目录引用的历史包，避免缓存中的下载引用失效。不要直接删除已发布版本。签名验证不等于防回放，密钥轮换、目录过期和撤销策略仍待后续实现。

Pages 缓存传播可能有短暂延迟，部署后验证会重试。它适合体积较小的公开官方工具目录，不提供私有账户、评分、计费或任意第三方上传。客户端仍固定公钥且在本地受限容器运行工具，用户输入不上传到 GitHub。
