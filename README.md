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
npm run preview
```

`npm run build` 生成 `_site/`，`npm run preview` 仅用于本地预览，监听 `127.0.0.1:1430`。生产不运行 Node 服务。

静态文件：

| 路径 | 用途 |
| --- | --- |
| `catalog.json` | Ed25519 签名目录，包含元数据和已发布版本 |
| `packages/<sha256>.xtool` | HTML 工具包的原始字节，以数据扩展名下载 |
| `health.json` | 静态产物状态与工具数量 |

`registry/catalog.json` 的 `payload` 是待验签的原始 UTF-8 JSON 字符串，`signature` 是 Ed25519 签名（hex）。公钥见 `registry/trust.json`，客户端必须事先固定公钥，不能从同一个不可信请求临时采信公钥。目录包含工具信息、API 版本、包长度和 SHA-256。

发布器先验证签名和所有包，再按白名单导出目录、包和健康文件。`.xtool` 只是分发扩展名，字节与签名摘要不变；不会在 Pages 域名下作为 HTML 页面执行。发布产物不包含 `.keys`、工具源码、node_modules 或 Git 数据。GitHub Pages 的站点子路径必须保留，拼接时用 `catalog.json` 而不是 `/catalog.json`。

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

当前 8 款工具有独立版本和绑定 ID 的包，但复用同一套工具 UI/转换源码。更细粒度的按需拆分依赖、第三方上传审核、用户评分、撤销列表和客户端自动更新不在这一版范围内。签名证明发布来源，不证明代码无漏洞；发布前必须审查工具代码。

## GitHub CI/CD

- `CI`：PR / main 上运行类型检查、签名与完整性测试、源代码与已签名包一致性检查、静态构建及本地 HTTP 下载验证。
- `Deploy Market Pages`：main 验证通过后上传 `_site`，通过官方 Pages Actions 原子部署，再读取公网文件校验目录版本、CORS 和全部包摘要。
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
