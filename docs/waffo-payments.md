# Waffo Pancake 接入与上线

本项目接入的是个人开发者使用的 **Waffo Pancake / waffo.ai**，不是 waffo.com 企业收单 API。代码完成不代表商户审核通过，也不代表已经验证真实收款。本次没有修改真实密钥、执行数据库迁移、部署或发起真实付款。

官方依据：

- [官方 SDK 与接入指南](https://docs.waffo.ai/integrate/skill)
- [Webhook 签名、字段与重试](https://docs.waffo.ai/api-reference/webhooks)
- [GraphQL 产品核对](https://docs.waffo.ai/api-reference/endpoints/graphql/stores-and-products)
- [AI 生图审核要求](https://docs.waffo.ai/mor/account-reviews/aigc-compliance)
- [Replicate 图片审核模型](https://replicate.com/lucataco/flux-content-filter)
- [Replicate 文件输入](https://replicate.com/docs/topics/predictions/input-files)

## 1. 后台创建商品

在同一 Waffo store 下创建 3 个 **one-time** 商品，不要建订阅商品：

| 本站 product_id | USD 价格 | 积分 | 有效期 |
| --- | ---: | ---: | --- |
| starter | 9.90 | 50 | 付款确认起 1 个自然月 |
| standard | 19.90 | 120 | 付款确认起 1 个自然月 |
| premium | 29.90 | 200 | 付款确认起 1 个自然月 |

税务类别选 `saas`，启用 USD，商品状态为 active。代码在创建结账时核对商品属于配置的 store、状态、价格和税务类别。折扣输入已关闭；当前不支持订阅、优惠码或其他币种。不要另外打开会改变实收金额的后台优惠规则。税款如适用，由 Waffo 计算，通知必须符合“本站基础价格 + 税 = 实付”。正式环境需先通过店铺审核，并把商品发布到正式环境。

## 2. 配置环境变量

完整示例见根目录 `.env.example`。本地配置 `.env.development`；线上配置 Cloudflare Worker 的 Variables / Secrets。不要把私钥放在 `NEXT_PUBLIC_*`、Git、前端代码或聊天中。

```dotenv
PAY_PROVIDER=waffo
CHECKOUT_ENABLED=false
WAFFO_MODE=test
WAFFO_MERCHANT_ID=MER_实际商户ID
WAFFO_STORE_ID=STO_实际店铺ID
WAFFO_PRODUCTS={"starter":"PROD_实际ID","standard":"PROD_实际ID","premium":"PROD_实际ID"}
```

另配置两个 **secret**：

- `WAFFO_PRIVATE_KEY`：该环境的完整 RSA PEM 私钥。支持真实换行或字面 `\n`。
- `REPLICATE_API_TOKEN`：复用原有 Replicate 服务端 token，同时用于厨房生图、原图审核和成品审核。不再需要 `OPENAI_MODERATION_API_KEY`。

保留原有 `DATABASE_URL`、认证、Supabase、Replicate 等配置。`NEXT_PUBLIC_WEB_URL` 在构建和运行环境都应是正确的网站地址；本地可用 `http://localhost:3000`，线上用 `https://aidesignkitchen.com`。

**共用现有 Supabase：** 按当前项目约定，本地测试继续使用现有 `DATABASE_URL`、Storage bucket 和认证配置，无需新建 Supabase 项目、测试数据库或重新初始化。测试订单、积分和审核记录会真实写入这套数据库，测试付款获得的积分也可被线上同一账户使用。Waffo 本身的测试/正式签名仍须正确匹配：本地先用 `WAFFO_MODE=test` 和相应测试凭证，正式收款使用 `WAFFO_MODE=prod` 及正式凭证、正式商品。共用数据库不会让错误环境的通知通过验签。

`wrangler.toml` 已改成 `PAY_PROVIDER=waffo`。2026-11-27 已将本地 `.env.development` 切为 `PAY_PROVIDER=waffo`、`WAFFO_MODE=test`、`CHECKOUT_ENABLED=false`，补齐 Waffo 凭证、商品映射及可选屏蔽库的空白配置；原有数据库、Supabase、Replicate 和认证值已保留。需要自行填入真实的 `WAFFO_MERCHANT_ID`、`WAFFO_STORE_ID`、`WAFFO_PRIVATE_KEY` 和 3 个商品 ID。不要把空白项当成已配置成功；缺失凭证时付款保持关闭，启用 Waffo 的厨房生成也会报审核配置缺失。填完并完成下面的新增表步骤后再开始测试。

`keep_vars=true` 会保留部分 Cloudflare 后台变量，但不会把本地 `.env.development` 自动上传。线上部署仍需在 Worker Variables / Secrets 配置对应值。不要在迁移和审核配置缺失时直接上线。

## 3. 在现有数据库增量新增两张表

新增 `src/db/migrations/0002_waffo_payments.sql`：

- `payment_events`：已验签通知及幂等记录；
- `kitchen_moderation`：Prompt Sift requestId、审核模型输出、规则版本与 generation_id 的关联记录。

2026-11-27 已用本地配置的 `DATABASE_URL` 只读检查：`users`、`orders`、`credits`、`kitchen_generations` 均已存在；`payment_events`、`kitchen_moderation` 尚不存在。没有执行建表或写入业务数据。

这次不需要初始化数据库。在当前 Supabase 项目的 **SQL Editor** 新建查询，完整复制 `src/db/migrations/0002_waffo_payments.sql` 的内容，在外层加 `BEGIN;` 和 `COMMIT;` 后执行即可。只新增两张表和付款订单索引；不需要执行 `0000`、`0001`，也不需要重建旧表或 Storage bucket。新审核表启用 RLS 且不向浏览器增加访问策略，项目服务端继续使用原有 `DATABASE_URL` 访问。

执行后核对：

```sql
SELECT
  to_regclass('public.payment_events') AS payment_events,
  to_regclass('public.kitchen_moderation') AS kitchen_moderation;
```

两列均返回表名即表示表已存在。`CREATE TABLE/INDEX IF NOT EXISTS` 和启用 RLS 可以重复执行，但不能用“未报错”替代同名旧表的字段核对。

本次采用只执行 `0002` 的增量方式，避免不必要地重跑全部历史迁移。现有库中有 Drizzle migration 记录；手工执行不会自动登记该记录。以后统一使用迁移命令时，需核对历史版本，`0002` 本身可重复执行。不要为了登记版本去改已有订单或积分。根目录 `pnpm db:migrate` 会按迁移历史处理全部待执行文件，不是只执行 `0002`。

## 4. 配置 HTTP Webhook

在 Waffo Dashboard → store → Settings → Webhooks 创建 HTTP channel：

```text
https://aidesignkitchen.com/api/pay/notify/waffo
```

订阅 `order.completed`、`refund.succeeded`、`refund.failed`，选择与本站 `WAFFO_MODE` 对应的环境。测试部署用它自己的域名。放行这个路径的外部 POST，不要加登录页、验证码或交互式 Cloudflare Challenge；HTTPS 和签名校验仍然保留。

若用本地 `http://localhost:3000` 测试，Waffo 无法直接访问你电脑的 localhost。完整验证自动发积分需要一个公网 HTTPS 地址转发到本地 3000，Webhook 填 `https://你的公网转发域名/api/pay/notify/waffo`；或者部署这套 Waffo 代码到可访问的 Worker，用与测试结账匹配的 `WAFFO_MODE=test`、store 和凭证接收回调。仍在运行旧代码或不同模式配置的线上接口，不能代替本地测试的通知接收端。数据库可以共用，回调处理程序和环境参数仍须匹配。

SDK 使用官方内置的分环境公钥验证原始请求体，采用官方默认 45 分钟签名容差（重试会复用原签名）。验签后还会检查 store、mode、用户标识、本站订单号、服务端 nonce、商品映射、币种、金额和税。只有事务提交后返回 200；失败返回 503 供平台重试。Dashboard 通用 sample event 不含本站订单绑定，不能用来证明真实积分发放；需完成一次真实的 **测试环境 checkout**。

## 5. 生图审核是 Waffo 的要求

`PAY_PROVIDER=waffo` 时，首次生成和 refinement 都先过 Prompt Sift，再调用原有 Replicate 生图模型；新上传原图和每次生成结果通过 Replicate 的 `lucataco/flux-content-filter` 独立审核。Refinement 复用当前账户中已保存的父结果，不新增原图审核，但仍审核新成品。只有通过的结果才会写入成品存储并展示。审核服务失败、review、block、审核记录写库失败均不会绕过检查；任务按现有失败逻辑释放保留的积分。没有异步人工审核队列，review 状态停止本次请求，用户可联系支持申诉。

图片审核固定版本 `6cde73479afa6189b52903fd968d3b5abadccc514a87b97dfc9ec43179d9f0d3`，NSFW 阈值 0.5。只有完整、有效、未标记的审核结果才能通过；模型内部 `image_error` / `text_error`、缺失分数或异常结构也按审核失败处理。审核记录保存 prediction ID、模型版本、阈值、标记和分数，不保存图片 base64、临时文件地址或原始模型错误日志。单次检查最长 90 秒（含上传和排队，另有少量取消/清理时间）；冷启动可能显著慢于页面标注的典型推理时间。Waffo 生成链路按实际剩余总时间限制审核、生图和存储等待，为成品审核与保存预留时间，避免每一步各自等满而超过路由的 300 秒预算。超时尝试取消，不自动重试创建任务，避免网络中断后重复计费。小于 1 MB 的图片内联发送，较大图片使用 Files API 临时上传，结束后尝试删除临时文件；清理失败会留下运维日志，服务商数据保留政策仍然适用。

新增公开 AUP、模型披露页，更新隐私/退款/服务条款及页脚入口。不要关闭模型自带的安全设置。切换底层模型时，披露页面跟随与生成器相同的配置读取；接入新模型还需核对授权、实际名称和安全设置。

默认规则在 `src/data/kitchen-content-blocklist.json`，是起始规则，**不是完整或自动更新的版权/人物库**。可通过 `CONTENT_SAFETY_BLOCKLIST` 运行时 JSON 覆盖，格式与此文件一致。运营方应定期（例如每周及收到举报后）维护类别、词表和版本日期，并保存人工处理记录。Replicate 过滤器主要覆盖 NSFW 和疑似版权/商标/公众人物，不能区分具体版权问题和具体人物，也不是暴力、仇恨、自残或 CSAM 的专项完整检测器。普通厨房中的品牌标识也可能被误拦截。Prompt Sift、屏蔽词、生成模型原生护栏和图片过滤共同使用，但不能保证发现所有违规内容或确认授权；仍需处理举报并在商户审核前与 Waffo 确认此方案是否满足实际业务要求。代码接入不能保证商户获批。

按 2026-11-27 查到的公开价格估算，当前 `google/nano-banana-2.1` 的 1K 生图每张 $0.0336，过滤器约 $0.00098/次（按运行时间浮动）。首次生成含原图、成品两次图片审核，约 $0.03556/张；refinement 含成品一次审核，约 $0.03458/张。1,000 次成功首次生成约 $35.56。此数不含存储、流量、Worker/数据库、付款手续费、税费和额外失败/重试的成本；模型成功而成品被拦截或保存失败时，已产生的服务商费用不会因本站释放用户积分自动退回。以 Replicate 实际账单和 Waffo 当期 Prompt Sift 计费为准。

过滤器使用 L40S，公开硬件单价 $0.000975/秒。本次真实厨房图审核的 `predict_time` 为 1.619 秒，据此估算该次约 $0.00158（并非已核对账单）；若两次审核都按这个运行时长，首次生成约 $0.03676。实际整次请求耗时约 47 秒，主要还包括上传、排队/冷启动和网络等待；不要把客户端等待秒数直接当作审核推理计费秒数。参考 [Replicate 硬件价格](https://replicate.com/pricing)。

## 6. 付款与退款的行为

付款跳回 `/payment-status?order_no=...` 后，页面读取当前登录用户自己的数据库订单状态；URL 中的订单号或返回参数不会直接发积分。关闭页面也不会阻止后续已验签 Webhook 发积分。页面等待约 30 秒后提示继续核查，**不会把未确认自动说成付款失败**；不要引导用户重复付费。

订单和积分在同一数据库事务提交，按用户加积分锁，通知按 `mode + storeId + eventType + eventId` 去重，积分发放有唯一交易号。重复/并发通知不重复发积分。退款先到会保存，付款确认时一并计算；成功退款按累计退款占原实收金额的比例回收本订单的未用积分，避免多次部分退款重复取整或误扣其他订单。全额退款订单保留在 My orders 并显示 Refunded。若生成中占用的积分在退款后因生成失败而释放，会重新核对退款额度，避免已退款积分再次可用。退款操作在 Waffo 后台办理，本站未开放用户自助退款 API；已消费积分、过期积分、拒付/争议需要人工核对，不能把积分回收等同于退钱。

当前付款确认以 Webhook 为准，没有定时轮询 Waffo 的补单 Worker。若通知重试耗尽、金额不符、缺少实收金额或数据库写入失败：保留付款凭证，核对 Waffo 订单与日志，修复配置后从 Waffo 后台重新投递通知；超过签名窗口需生成新签名的重投递（不要重放旧 HTTP 原包）。必要时联系 Waffo 支持。不要直接改 paid 状态或手工重复插入积分。

保留 Dodo 通知/回调及旧凭证，待未结旧订单处理完再停用。新订单只走 Waffo，旧订单不会自动迁到新平台；退款仍通过原收款方完成。

## 7. 上线前实测

填完本地 Waffo 凭证与商品映射，在现有数据库执行新增表 SQL 后，运行 `pnpm dev`。无需安装或初始化本地 Supabase。先登录并用账户现有积分测试一次生成，检查 `kitchen_moderation` 对应的 prompt/source_image/output_image 记录；refinement 应有 prompt/output_image 记录。审核配置完整、Prompt Sift 可用、Replicate 账户额度足够时才会成功。

要测试付款，再将本地 `CHECKOUT_ENABLED=true`、重启开发服务，并接通匹配模式的公网 Webhook。至少验证三档付款、重复投递、付款后关闭浏览器、重新登录看积分、部分/全额退款、错误签名与环境、已登录直接付款、审核阻止及服务故障不交付未审核图片。`orders` 保存订单，`payment_events` 保存有效付款/退款事件，`credits` 保存积分流水；这些就是当前共用 Supabase 里的实际记录。确认每次交付都能在 `kitchen_moderation` 追溯 requestId。

正式商户审核/KYC/结算账户、正式 key、产品发布和正式 Webhook 都完成后，才在正式部署开启 `CHECKOUT_ENABLED=true`。本次未替你提交审核、配置后台、执行迁移或跑真实付款。只有完成这些实测才能确认线上收款链路可用。

## 本次代码验证记录

2026-11-27 生成全流程复核：本轮共通过 68 项模拟场景（18 项生成路由/历史/图片访问，使用真实 SQL 事务和隔离内存 PostgreSQL；42 项图片审核；8 项生图接口），包括成功扣 1 积分、修改使用父成品与本次指令、重复请求不重复生成、并发请求拒绝、超期任务在下一次生成时释放占用积分、审核/模型/存储失败释放积分、无积分与未登录拦截、跨用户访问拒绝。修正生图轮询未校验原任务 ID、异常创建响应无法利用已返回 ID 取消、未识别 aborted 状态等防御性处理，并清理提前拒绝下载时的响应流。类型检查和 Next.js 生产构建通过，未新增自动测试文件。只读确认现有 Supabase 并发/积分唯一索引及审核表字段齐全，真实 Waffo Prompt Sift 调用返回 allow 和 requestId。没有调用付费厨房生图、修改正式用户积分或部署。

仍存在的恢复边界：模型成功后下载、成品审核或保存失败，没有自动从 Replicate 恢复并交付成品的机制；请求并非持久后台任务，进程中断不保证继续完成；失败退积分事务本身如遇数据库故障，当前只记录错误，超期 processing 任务在用户下一次生成时才尝试清理。这些边界不能用模拟验证通过表述为已解决。完整线上链路仍须真实登录、生成、保存、刷新历史和修改图片实测。

2026-11-27 图片审核切换：类型检查、Next.js 生产构建及 42 项内存逻辑验证通过，覆盖版本/阈值、审核拦截、模型内部错误、无效响应、预测 ID 不匹配、HTTP 429/5xx、创建失败不自动重试、超时取消、带扩展名的文件 ID、大图上传/清理、审核记录失败拒绝交付及移除 OpenAI 密钥依赖。额外以项目自带的公开厨房示例图真实调用 Replicate，成功完成 2.2 MB PNG 的文件上传、审核和临时文件删除，确认测试临时文件无残留。没有调用厨房生图模型、真实付款或用户数据库，也未新增自动测试文件。

此前 Waffo 支付接入验证：类型检查及 Next.js 生产编译通过。未新增自动测试文件；通过内存运行验证了金额解析、累计退款取整和 RSA 签名，并在隔离的内存 PostgreSQL 中运行实际支付服务与新增迁移，验证重复/并发通知、事务中途失败后回滚重试、订单绑定/用户/币种/环境不符拒绝、部分/全额/先到退款、退款后生成预留积分释放、SDK 请求参数、审核拦截及记录写入，以及 Webhook 的 200/401/403/503 响应。该轮外部支付与审核 HTTP 使用模拟响应，不能替代 Waffo 测试环境联调。

完整 Cloudflare Worker 打包目前仍被项目现有 OpenNext 与 `sharp@0.35.5` 原生 `.node` 模块打包兼容问题阻塞，发生在 Next.js 编译之后。本次没有为绕过它降级图片依赖或改动打包器。上线前必须解决并通过完整 Worker 构建；类似问题见 [OpenNext 上游 issue](https://github.com/opennextjs/opennextjs-cloudflare/issues/1394)。当前不能据此宣称“已验证可直接部署收款”。
