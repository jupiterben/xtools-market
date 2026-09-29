# XTools Market

独立于 XTools 桌面客户端的官方工具市场服务。Node.js 24 + TypeScript + Fastify，监听 `127.0.0.1:1430`。

## 启动与验证

```powershell
npm ci
npm run check
npm test
npm run registry:verify
npm run build
npm start
```

接口：

| 路径 | 用途 |
| --- | --- |
| `GET /healthz` | 健康检查 |
| `GET /v1/catalog` | Ed25519 签名目录，支持 ETag / 304 |
| `GET /v1/tools?q=json&category=数据处理&page=1&pageSize=24` | 搜索、分类、分页 |
| `GET /v1/tools/:id` | 最新版本详情 |
| `GET /v1/tools/:id/versions` | 所有已发布版本 |
| `GET /v1/packages/:sha256` | 不可变 HTML 工具包下载 |

`registry/catalog.json` 的 `payload` 是待验签的原始 UTF-8 JSON 字符串，`signature` 是 Ed25519 签名（hex）。公钥见 `registry/trust.json`，客户端必须事先固定公钥，不能从同一个不可信请求临时采信公钥。目录包含工具信息、API 版本、包长度和 SHA-256。

## 工具发布

首版采用 GitOps 发布，不开放匿名上传。`tools/` 是官方工具源码，`registry/` 是签名发布产物。每款工具独立构建，包绑定工具 ID，版本不可覆盖。已有版本内容变化必须提升 `tools/catalog.json` 的版本号。

```powershell
# 仅首次建立一个全新市场时运行，已有 trust.json 不要重新生成
npm run keys:init

# 私钥默认放在 .keys/market.pem，或通过 SIGNING_KEY_FILE 指向安全位置
npm run tools:release
npm run registry:verify
```

提交源码和签名后的 registry 产物，通过 PR 审核后合并 main。新机器需要原私钥才能发布新工具；私钥不在 Git、Docker、Actions 日志或镜像中。请安全备份，丢失需做客户端信任迁移。CI 只有公钥，可验证产物而不能伪造新工具包。

当前 8 款工具有独立版本和绑定 ID 的包，但复用同一套工具 UI/转换源码。更细粒度的按需拆分依赖、第三方上传审核、用户评分、撤销列表和客户端自动更新不在这一版范围内。签名证明发布来源，不证明代码无漏洞；发布前必须审查工具代码。

## GitHub CI/CD

- `CI`：PR / main 上运行类型检查、API 测试、签名与包完整性校验、TypeScript 构建和 Docker 健康检查。
- `Publish Container`：main / `v*` tag 验证通过后发布 GHCR 镜像，带 commit SHA、SBOM 和构建来源信息。使用 GitHub 自带 `GITHUB_TOKEN`，不需要长期 Docker 密码。
- `main` 对应 `ghcr.io/jupiterben/xtools-market:main`，版本 tag 对应版本镜像。部署建议使用运行摘要中给出的不可变 digest。
- PR 不获得发布权限；Dependabot 每周检查 npm、Actions 和基础镜像。
- 首次运行需确保仓库允许 GitHub Actions、GITHUB_TOKEN 有 package 写权限。GHCR 包默认可能是私有，服务器需要只读登录或手动把该包设为公开。

CD 当前交付经过健康检查的容器镜像，不会自动登录未知服务器。服务器/域名尚未指定，需在目标 Linux 主机执行：

```sh
export MARKET_IMAGE=ghcr.io/jupiterben/xtools-market@sha256:REPLACE_WITH_PUBLISHED_DIGEST
docker compose pull
docker compose up -d --wait
curl --fail http://127.0.0.1:1430/healthz
```

通过 Caddy/Nginx 配置 HTTPS 反向代理到回环端口。不要把管理或未加 TLS 的服务直接暴露公网。回滚时将 MARKET_IMAGE 改回上一个 digest 再执行同样命令。

## 配置与运维

| 环境变量 | 默认值 |
| --- | --- |
| `HOST` | `127.0.0.1`（镜像中为 `0.0.0.0`） |
| `PORT` | `1430` |
| `REGISTRY_DIR` | `registry` |
| `CORS_ORIGINS` | `http://127.0.0.1:1420,http://localhost:1420` |

服务启动时验证并载入目录和所有工具包，损坏时拒绝启动。运行时只读、不需要数据库或写磁盘；发布随镜像部署并可按 digest 回滚。此方案适用于体积小的官方工具目录，后续大量工具可迁移对象存储/CDN，API 协议不需要改变。

反向代理应增加公网限流；当前应用使用真实 TCP 地址限流，不盲目信任伪造 X-Forwarded-For。已安装工具及用户输入不存储在此服务。
