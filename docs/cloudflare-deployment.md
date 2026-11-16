# 从 Cloudflare 网页后台部署 aidesignkitchen.com

项目使用 Next.js 和 OpenNext，Worker 名为 `aidesignkitchen`。网站地址为 `https://aidesignkitchen.com`。PostgreSQL 和私有图片继续使用 Supabase，图片生成继续使用 Replicate。

## 1. 添加域名

在 Cloudflare 添加 `aidesignkitchen.com`，按后台要求在注册商更新 nameserver，等待域名状态为 Active。域名和 Worker 必须在同一 Cloudflare 账户下。更换 DNS 前核对已有记录，尤其是邮件的 MX、SPF、DKIM、DMARC。让 `support@aidesignkitchen.com` 能继续收信，并测一次外部邮件。

仓库根目录的 `wrangler.toml` 会在部署时为 Worker 绑定根域名。Cloudflare 会管理对应的 DNS 记录和证书。绑定前检查根域名是否已有冲突的记录或绑定。如需同时使用 `www`，可单独设置跳转到根域名。OAuth 和支付回调统一使用根域名。

[Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## 2. 准备 Supabase、Google 和 Replicate

- Supabase 建议使用独立的线上项目。创建名为 `kitchen-design` 的**私有** Storage bucket。复制项目 HTTPS URL 和服务端密钥（`sb_secret_…` 或旧版 `service_role`）；代码均通过名为 `SUPABASE_SERVICE_ROLE_KEY` 的变量读取。
- Supabase 的 Connect 面板提供数据库连接串。Worker 的 `DATABASE_URL` 可使用 Transaction pooler（通常为 6543，应用已关闭 prepared statements），使用 TLS 并填入真实数据库密码。不要使用只读连接串。
- 在首次使用的新数据库上运行迁移。迁移时使用同一个线上项目的 Session pooler 或可以从本机连接的 Direct connection。对已有数据库先核对迁移记录和现有表，避免对已建表但未登记迁移的库直接重跑初始迁移。

- 数据库迁移是单独的一次性准备工作，由项目的 `pnpm db:migrate` 管理。已经迁移的线上数据库可以跳过。全新数据库应在可信终端显式设置该项目的 `DATABASE_URL` 后运行迁移。Cloudflare 构建不会替你迁移数据库。

- Google Auth Platform → Clients → Web application，添加 Authorized redirect URI `https://aidesignkitchen.com/api/auth/callback/google`。授权域名与品牌信息按 Google 后台要求设置。若 OAuth 应用仍在 Testing 状态，先加测试账号；公开体验之前检查外部用户能否登录。
- 在 Replicate 创建 API Token，确认计费与 `google/nano-banana-2.1` 的模型权限可用。

[Supabase 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)

## 3. 在 Cloudflare 后台创建 Worker

1. 把准备部署的代码同步到 GitHub。确认 Cloudflare 将使用的分支上能看到根目录的 `wrangler.toml`、`open-next.config.ts`、`package.json` 和 `pnpm-lock.yaml`。
2. 打开 Cloudflare 的 **Workers & Pages → Create application → Import a repository**，并选择 GitHub 仓库。如果已有同名 Worker，在它的 **Settings → Builds** 连接仓库。选择 Worker 的 Git 构建入口，静态文件上传无法构建这个 Next.js 项目的登录、支付和生图接口。
3. 填写以下构建设置。这些命令是 Cloudflare 表单的值，由 Cloudflare 的 Linux 环境执行。

| 字段 | 填写 |
| --- | --- |
| Worker name | `aidesignkitchen`，与 `wrangler.toml` 完全一致 |
| Production branch | 实际要发布的分支，例如 `main`。想手动控制每次上线时，选专门的 `production` 分支，只在准备发布时合并代码 |
| Root directory | 仓库根目录，留空即可 |
| Build command | `pnpm exec opennextjs-cloudflare build` |
| Deploy command | `pnpm exec opennextjs-cloudflare deploy` |

如果只想让发布分支触发上线，在 **Settings → Builds → Branch control** 关闭 **Enable Preview Builds**。Cloudflare 会在你合并到生产分支时自动执行构建和发布。

4. 在创建页面的 **Build variables and secrets** 添加下表变量。已有 Worker 可在 **Settings → Builds** 修改。填完再开始正式构建。

Node.js 和 pnpm 直接使用 Workers Builds 的默认版本。Cloudflare 会根据仓库里的 `pnpm-lock.yaml` 选择 pnpm 安装依赖。

| 变量 | 值 |
| --- | --- |
| `NEXT_PUBLIC_WEB_URL` | `https://aidesignkitchen.com` |
| `NEXT_PUBLIC_PROJECT_NAME` | `AI Kitchen Design` |
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | `true` |
| `NEXT_PUBLIC_AUTH_GOOGLE_ID` | Google Web Client ID，与运行时的 `AUTH_GOOGLE_ID` 相同 |
| `NEXT_PUBLIC_AUTH_GOOGLE_ONE_TAP_ENABLED` | `false` |
| `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` | `false` |
| `NEXT_PUBLIC_LOCALE_DETECTION` | `false` |
| `NEXT_PUBLIC_DEFAULT_THEME` | `light` |
| `NEXT_PUBLIC_PAY_SUCCESS_URL` | `/my-orders` |
| `NEXT_PUBLIC_PAY_FAIL_URL` | `/pricing` |
| `NEXT_PUBLIC_PAY_CANCEL_URL` | `/pricing` |

在后台值一栏填实际内容，无需给值加引号。`.env.production.example` 供对照，无需复制出本地环境文件。修改 `NEXT_PUBLIC_*` 后，要重新构建才能更新浏览器端代码。同一个提交可到 **Deployments → View Build History → Retry build** 重试。下一次发布新提交时，合并到生产分支。

[Cloudflare 构建设置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [OpenNext 的 Workers Builds 指南](https://opennext.js.org/cloudflare/howtos/dev-deploy)

## 4. 配置运行时变量

在 Cloudflare 后台打开 **Workers & Pages → aidesignkitchen → Settings → Variables and Secrets**。按下表选择 Text 或 Secret，保存并部署运行时配置。

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `SUPABASE_URL` | Text | `https://<project-ref>.supabase.co` |
| `AUTH_GOOGLE_ID` | Text | Google OAuth Web client ID |
| `AUTH_GOOGLE_SECRET` | Secret | 同一个 Google 客户端的 secret |
| `AUTH_SECRET` | Secret | 独立生成并长期保留。可用 `openssl rand -base64 32` |
| `DATABASE_URL` | Secret | 线上 Supabase PostgreSQL 连接串 |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | 同一 Supabase 项目的服务端密钥 |
| `REPLICATE_API_TOKEN` | Secret | Replicate API Token |

首次部署会创建 Worker，应用在变量加齐之前可能还无法登录或生成。密钥只填到 Cloudflare Secrets，公开配置文件和 `NEXT_PUBLIC_*` 用于公开值。普通后台变量由 `keep_vars` 保留。已经写在 `wrangler.toml` 的值以后从该文件修改，再部署。

[Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 5. Dodo 审核与正式支付

公开站默认 `PAY_PROVIDER=dodo`、`DODO_MODE=test`、`CHECKOUT_ENABLED=false`。价格、协议和免费试用公开。可以继续用本地或独立测试环境验证 Dodo 测试支付与发积分。

正式收款获批后：

1. 在 Dodo 正式模式建立或复制三个一次性 USD 商品，确保价格分别是 $9.90、$19.90、$29.90，分别对应 50、120、200 积分。关闭与固定标价冲突的折扣和自动换币，分别核对含税价或额外税费。
2. 在正式模式创建 Webhook，地址为 `https://aidesignkitchen.com/api/pay/notify/dodo`，订阅 `payment.succeeded`。
3. 在 Worker 中配置 `DODO_PAYMENTS_API_KEY` 和 `DODO_WEBHOOK_SECRET` 为 Secret，分别填正式 API Key 与这个端点的 Signing Secret。`DODO_PRODUCTS` 在后台按 **Text** 填单行 JSON，如 `{"starter":"pdt_实际ID","standard":"pdt_实际ID","premium":"pdt_实际ID"}`。
4. 将 `wrangler.toml` 里的 `DODO_MODE` 改为 `live`，`CHECKOUT_ENABLED` 改为 `true`，重新部署。核对正式结账币种、订单回跳和积分到账。

[Dodo 账户验证](https://docs.dodopayments.com/miscellaneous/verification-process)

## 6. 正式提交审核前

- 无痕访问首页、价格页、退款政策、隐私政策和服务条款，检查 HTTPS、页脚和邮箱。
- 用线上新账号登录，领取试用积分，走一次上传、生成、历史记录、下载。
- 如果生成失败，先看 Cloudflare Logs、Supabase 和 Replicate 日志。Workers 的 CPU 限额与网络等待时间分别计算。本项目生成接口会等待结果，浏览器需要保持连接；静态配置检查无法代替线上生图实测。

[Cloudflare Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
