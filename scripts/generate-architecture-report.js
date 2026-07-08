#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "generated");
const mdPath = path.join(outDir, "goalix-architecture-report-ar.md");
const htmlPath = path.join(outDir, "goalix-architecture-report-ar.html");
const pdfPath = path.join(outDir, "goalix-architecture-report-ar.pdf");

const mermaidDiagrams = [
  {
    title: "High Level System",
    code: `flowchart LR
    U[Users] --> N[Nginx Reverse Proxy]
    N --> FE[Next.js Frontend]
    N --> API[Express API]
    FE --> PXY[Next.js API Proxy]
    PXY --> API
    API --> PG[(PostgreSQL)]
    API --> RD[(Redis)]
    API --> Q[BullMQ Queues]
    Q --> W[Worker Process]
    W --> PG
    API <--> SIO[Socket.IO]`,
  },
  {
    title: "Queue Pipeline",
    code: `sequenceDiagram
    participant API as Express API
    participant Redis as Redis/BullMQ
    participant Worker as Worker
    participant DB as PostgreSQL
    API->>Redis: add(jobName, payload)
    Redis-->>API: job id / queued
    Worker->>Redis: claim next job
    Worker->>DB: execute side effect
    Worker->>Redis: complete / fail / retry`,
  },
  {
    title: "Redis Dependency Map",
    code: `flowchart TB
    Redis[(Redis)] --> BullMQ[BullMQ Queues]
    Redis --> RateLimit[Rate Limit Counters]
    Redis --> Session[Auth Session Cache]
    Redis --> JsonCaches[Short JSON Caches]
    Redis --> Socket[Socket.IO Adapter]
    Redis --> Locks[Automation Locks]`,
  },
  {
    title: "Current Docker Topology",
    code: `flowchart TB
    N[Nginx] --> FE[frontend]
    N --> API[api]
    API --> PG[(postgres)]
    API --> RD[(redis)]
    WK[worker] --> PG
    WK --> RD
    M[migrate] --> PG`,
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const markdown = `# Goalix Architecture Report - Mermaid Appendix

مهم: بناء على طلبك، الـ PDF لا يحتوي Mermaid code. هذا الملف فقط يحتفظ بالأكواد الخام لو احتجت تنسخها في draw.io أو Mermaid Live Editor أو GitHub.

${mermaidDiagrams
  .map((item) => `## ${item.title}\n\n\`\`\`mermaid\n${item.code}\n\`\`\``)
  .join("\n\n")}
`;

function p(text) {
  return `<p>${text}</p>`;
}

function code(text) {
  return `<code>${escapeHtml(text)}</code>`;
}

function section(title, body, extraClass = "") {
  return `<section class="section ${extraClass}"><h2>${title}</h2>${body}</section>`;
}

function callout(title, body, type = "info") {
  return `<div class="callout ${type}"><strong>${title}</strong><div>${body}</div></div>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((header) => `<th>${header}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function cards(items) {
  return `<div class="cards">${items
    .map(
      (item) => `<article class="card">
        <h3>${item.title}</h3>
        <p>${item.body}</p>
      </article>`,
    )
    .join("")}</div>`;
}

function steps(items) {
  return `<ol class="steps">${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function flow(items) {
  return `<div class="flow">${items.map((item) => `<div class="flow-box">${item}</div>`).join("<div class=\"arrow\">←</div>")}</div>`;
}

function miniFlow(title, items) {
  return `<div class="mini-flow"><h3>${title}</h3>${flow(items)}</div>`;
}

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>Goalix Architecture Report</title>
  <style>
    @page { size: A4; margin: 13mm 11mm 16mm 11mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #142033;
      background: #f4f7f9;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      direction: rtl;
      line-height: 1.85;
      font-size: 13px;
    }
    .cover {
      min-height: 100vh;
      color: #fff;
      padding: 56px 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background:
        linear-gradient(135deg, rgba(0,0,0,.08), rgba(255,255,255,.06)),
        linear-gradient(135deg, #12324a 0%, #0f6b69 53%, #17324e 100%);
      page-break-after: always;
    }
    .kicker { color: #bdf6ff; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .cover h1 { font-size: 42px; line-height: 1.18; margin: 18px 0 14px; max-width: 820px; }
    .cover p { font-size: 18px; color: #e6fbff; max-width: 850px; margin: 0 0 28px; }
    .pills { display: flex; gap: 10px; flex-wrap: wrap; }
    .pill { padding: 8px 13px; border: 1px solid rgba(255,255,255,.38); border-radius: 999px; background: rgba(255,255,255,.12); }
    .page { background: #fff; padding: 18px 24px 34px; }
    .section { margin-bottom: 26px; page-break-inside: avoid; }
    .section.break { page-break-before: always; }
    h2 {
      font-size: 24px;
      color: #0f3554;
      margin: 20px 0 12px;
      padding-bottom: 8px;
      border-bottom: 3px solid #2ba6a0;
    }
    h3 { color: #105b63; font-size: 16px; margin: 6px 0 8px; }
    p { margin: 8px 0 10px; }
    code {
      direction: ltr;
      unicode-bidi: isolate;
      background: #edf3f7;
      color: #0d4a68;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
    }
    .lead {
      font-size: 16px;
      background: #edfafa;
      border-right: 5px solid #249b96;
      padding: 14px 16px;
      border-radius: 8px;
      color: #244052;
    }
    .callout {
      border: 1px solid #cfe0ea;
      border-right: 5px solid #2b8fb8;
      border-radius: 8px;
      padding: 11px 13px;
      margin: 12px 0;
      background: #f4fbff;
    }
    .callout.warn { background: #fff8ed; border-color: #ffd6a1; border-right-color: #f59e0b; }
    .callout.good { background: #eefaf3; border-color: #bfe8d1; border-right-color: #22a06b; }
    .callout.risk { background: #fff1f1; border-color: #f1bcbc; border-right-color: #d64545; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
    .card { border: 1px solid #d9e5ec; border-radius: 8px; background: linear-gradient(180deg, #fff, #f8fbfc); padding: 12px 13px; min-height: 96px; }
    .table-wrap { border: 1px solid #d8e4ec; border-radius: 8px; overflow: hidden; margin: 12px 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.8px; }
    th { background: #12324a; color: #fff; text-align: right; padding: 8px; }
    td { border-top: 1px solid #e4edf2; padding: 7px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f7fbfc; }
    .steps { counter-reset: item; list-style: none; padding: 0; margin: 12px 0; }
    .steps li {
      position: relative;
      margin: 8px 0;
      padding: 9px 42px 9px 12px;
      background: #f8fbfc;
      border: 1px solid #dae7ee;
      border-radius: 8px;
    }
    .steps li::before {
      counter-increment: item;
      content: counter(item);
      position: absolute;
      right: 10px;
      top: 9px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1d7f86;
      color: #fff;
      text-align: center;
      line-height: 22px;
      font-weight: 800;
    }
    .flow { display: flex; align-items: stretch; gap: 7px; flex-wrap: wrap; margin: 12px 0; }
    .flow-box {
      border: 1px solid #cfe0ea;
      background: #ffffff;
      border-radius: 8px;
      min-width: 110px;
      flex: 1;
      padding: 10px;
      text-align: center;
      color: #17324e;
      font-weight: 700;
    }
    .arrow { align-self: center; color: #1b7778; font-size: 20px; font-weight: 900; }
    .mini-flow { border: 1px solid #d9e6ee; border-radius: 8px; padding: 12px; margin: 12px 0; background: #fbfdfe; page-break-inside: avoid; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    ul { margin: 8px 22px 12px 0; padding: 0; }
    li { margin: 4px 0; }
    .small { color: #64748b; font-size: 11px; }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <div class="kicker">Goalix Architecture Deep Explanation</div>
      <h1>شرح معماري تفصيلي كامل للمشروع</h1>
      <p>نسخة موسعة: بدون Mermaid code داخل الـ PDF، وبشرح عملي لكل جزء: queue، jobs، Redis، caching، Nginx، الأداء، قاعدة البيانات، والـ flows خطوة بخطوة.</p>
      <div class="pills">
        <span class="pill">2026-07-08</span>
        <span class="pill">Next.js 16 App Router</span>
        <span class="pill">Express API</span>
        <span class="pill">PostgreSQL + Redis</span>
        <span class="pill">BullMQ Workers</span>
      </div>
    </section>

    <div class="page">
      ${section(
        "الفكرة العامة",
        `${p("Goalix مش عبارة عن صفحة Dashboard فقط. هو نظام تشغيل لأكاديمية رياضية: عندك مستخدمين بأدوار مختلفة، كل دور له شاشات وصلاحيات، وكل عملية في الواجهة تتحول لطلب API، والـ API يقرأ أو يكتب في PostgreSQL، وأحيانا يستخدم Redis لتسريع القراءة أو تأجيل شغل للـ worker.")}
        <div class="lead">أهم جملة تفهم منها النظام: PostgreSQL هو المكان الذي يحفظ الحقيقة النهائية، Redis هو طبقة مساعدة للسرعة والتوزيع والشغل الخلفي، والـ worker هو العامل الذي ينفذ المهام التي لا يجب أن تعطل المستخدم وهو ينتظر الرد.</div>
        ${cards([
          { title: "Frontend", body: "Next.js App Router. فيه مسارات admin/coach/player/parent/auth، وRTK Query لجلب البيانات وإعادة المحاولة عند refresh session أو CSRF." },
          { title: "Backend", body: "Express API. كل module له routes/controller/service/repository. هذا يجعل المنطق مقسم بدل ملف واحد ضخم." },
          { title: "Database", body: "PostgreSQL عبر Knex. أي بيانات مهمة مثل users, sessions, players, matches, attendance, chat, notifications محفوظة هناك." },
          { title: "Redis + Workers", body: "Redis يشغل queues والكاش والrate limits والSocket.IO adapter والlocks. Workers تستهلك queues وتشغل automations." },
        ])}
        ${miniFlow("الصورة الكبيرة للطلب", ["Browser", "Next.js / Nginx", "Express Middleware", "Controller", "Service", "Repository", "PostgreSQL / Redis / Queue"])}
        `,
      )}

      ${section(
        "يعني إيه Job؟ وليه نخزنها؟",
        `${p("كلمة job هنا معناها أمر شغل صغير. تخيل ورقة تعليمات مكتوب عليها: اعمل كذا، ومعاك البيانات دي. الـ API بدل ما ينفذ الشغل الطويل بنفسه وهو المستخدم مستني، يحط ورقة التعليمات دي في queue. بعد كده worker منفصل يقرأ الورقة وينفذها.")}
        ${callout("مثال بسيط", "لما يحصل تعديل حساس في النظام، محتاجين نسجل audit log. بدل ما الطلب يفضل مستني خطوة تسجيل إضافية، الـ API يجهز job اسمها log وفيها بيانات العملية. worker يقرأها ويكتبها في audit_logs.", "good")}
        ${table(
          ["المفهوم", "معناه في Goalix", "الفائدة العملية"],
          [
            ["Job name", "اسم المهمة، مثل <code>log</code> أو <code>generate-invoice</code>", "يقول للworker أي handler يشغل"],
            ["Payload / Data", "البيانات اللازمة لتنفيذ المهمة، مثل user_id/action/ip أو subscriptionId", "الworker لا يحتاج يرجع للrequest الأصلي؛ كل اللازم موجود"],
            ["Queue", "قائمة انتظار داخل Redis تديرها BullMQ", "ترتيب المهام، retry، failure tracking، وفصل الحمل عن API"],
            ["Worker", "process منفصل يقرأ jobs وينفذها", "الشغل الثقيل لا يوقف المستخدم ولا يضغط على API process"],
            ["Attempts", "محاولات إعادة التنفيذ عند الفشل، حاليا 3", "لو حصل خطأ مؤقت، job لا تضيع مباشرة"],
            ["Backoff", "انتظار يزيد تدريجيا، exponential delay يبدأ 2 ثانية", "يقلل الضغط عند فشل خدمة خارجية أو DB مؤقتا"],
            ["removeOnComplete", "الاحتفاظ بآخر 1000 job مكتملة", "تاريخ قصير للمراقبة بدون تضخيم Redis"],
            ["removeOnFail", "الاحتفاظ بآخر 5000 job فاشلة", "سهولة debug للفشل المتكرر"],
          ],
        )}
        ${p("إذن الجملة “queue بتخزن jobs” معناها: Redis يحتفظ بسجلات صغيرة لكل مهمة: اسمها، بياناتها، حالتها، عدد محاولاتها، وقت تنفيذها، وهل فشلت أو نجحت. هي لا تخزن اللاعبين ولا الأكاديميات كبديل للDB. هي تخزن أوامر تنفيذ مؤقتة أو خلفية.")}
        ${callout("ليه التخزين مفيد؟", "لأنه يسمح للنظام يقول للمستخدم: تم قبول العملية بسرعة، ثم يكمل الشغل غير العاجل في الخلفية. كمان لو عندك ضغط كبير، jobs تصطف بدل ما تكسر السيرفر. ولو worker وقع ورجع، يقدر يكمل من Redis.", "good")}
        `,
        "break",
      )}

      ${section(
        "Queue في المشروع بالضبط",
        `${p(`الملف ${code("golx-backend/src/infrastructure/queue.js")} ينشئ خمس queues: rankings, notifications, payments, ai, audit. كل queue اسمها الحقيقي يبدأ بـ prefix من env، افتراضيا ${code("goalix")}. يعني مثلا audit تصبح ${code("goalix-audit")}.`)}
        ${p("الـ API يستخدم queue.add(jobName, payload). BullMQ يحفظ job داخل Redis. worker process في production يبدأ من src/workers/run.js، يتصل بPostgreSQL وRedis، ثم يفتح workers لكل queue.")}
        ${table(
          ["Queue", "متى تتضاف؟", "ما البيانات المخزنة؟", "ماذا يفعل worker الآن؟", "هل هي مكتملة؟"],
          [
            [
              "<code>goalix-audit</code>",
              "بعد POST/PUT/PATCH/DELETE على مسارات حساسة مثل admin, auth, players, coaches, payments, academy, chat",
              "user_id, action, table_name/entity, record_id, ip_address, user_agent, session_jti, metadata فيها method/url/status/requestId",
              "يقرأ job ويعمل insert في <code>audit_logs</code>",
              "نعم، وهذه أهم queue فعالة حاليا",
            ],
            [
              "<code>goalix-rankings</code>",
              "عند طلب recalculation للweekly/monthly rankings",
              "groupId وperiodType",
              "حاليا يرجع skipped بسبب <code>ranking_worker_not_connected_to_model</code>",
              "البنية موجودة، التنفيذ الفعلي غير موصل في worker",
            ],
            [
              "<code>goalix-notifications</code>",
              "عند إرسال notification بقناة غير in_app",
              "notificationIds/channel/academyId/targetRole",
              "يرجع skipped لأن delivery provider غير configured",
              "in-app مكتملة في DB، delivery الخارجي غير مكتمل",
            ],
            [
              "<code>goalix-payments</code>",
              "بعد createSubscription",
              "subscriptionId لتوليد invoice",
              "فيه TODO لتوليد PDF invoice وتخزينه وإخطار المستخدم",
              "غير مكتمل كتكامل دفع/فاتورة",
            ],
            [
              "<code>goalix-ai</code>",
              "عند calculate performance أو assess injury risk أو nutrition plan أو AI chat",
              "playerId أو userId/prompt/context",
              "يرجع provider_not_configured",
              "API layer موجودة، worker provider غير موصل",
            ],
          ],
        )}
        ${miniFlow("Audit queue خطوة بخطوة", ["Mutation request", "Response finished", "Build audit payload", "auditQueue.add('log')", "Redis stores job", "Audit worker reads", "Insert audit_logs", "Job completed"])}
        ${callout("مهم جدا", "لو Redis غير متاح أثناء audit، الكود لا يضيع الـ audit log: يحاول fallback ويكتب مباشرة في PostgreSQL. لذلك audit queue هنا optimization وفصل حمل، وليست نقطة فشل وحيدة.", "good")}
        ${p("أما queues الأخرى فوجودها حاليا يعني أن تصميم النظام جاهز للشغل الخلفي، لكن ليس كل worker مربوط بتنفيذ حقيقي. هذا فرق مهم: architecture جاهزة، لكن بعض integrations لم تكتمل.")}
        `,
      )}

      ${section(
        "Redis: هو بيعمل إيه غير الكاش؟",
        `${p("Redis في Goalix هو shared runtime. يعني حاجة سريعة في الذاكرة تستخدمها كل processes. استخداماته كثيرة: queues، session cache، rate limit counters، socket fanout، distributed locks، وكاشات JSON قصيرة.")}
        ${table(
          ["الاستخدام", "ما الذي يتخزن؟", "لماذا؟", "لو Redis وقع؟"],
          [
            ["BullMQ queues", "Jobs وحالتها ومحاولاتها", "تشغيل background tasks وفصلها عن API", "workers لا تعمل بشكل طبيعي، API يدخل degraded حسب المكان"],
            ["Auth session cache", "session key لكل access token + user sessions set + touch lock", "تقليل ضربات DB عند كل request وتخفيف تحديث last_seen", "يرجع لفحص DB session"],
            ["Auth user cache", "snapshot للمستخدم بعد sanitize", "تسريع /me والبيانات المتكررة", "يرجع للDB"],
            ["Permissions cache", "نتيجة حساب صلاحيات الدور", "الصلاحيات تقرأ كثيرا وتتغير قليلا", "يرجع للDB"],
            ["MFA challenge", "challengeId -> userId مؤقت", "التحقق الثاني في login لا يحتاج state طويل", "يوجد fallback PostgreSQL"],
            ["Rate limiting", "عدادات لكل IP أو user", "منع abuse بشكل موزع بين instances", "fallback MemoryStore محلي، أقل دقة مع تعدد instances"],
            ["Attendance cache", "overview JSON لمدة 30 ثانية مع version", "شاشة attendance ممكن تكون ثقيلة", "cache miss ثم DB"],
            ["Academy branches cache", "صفحات branches حسب academy/version/page/limit", "تقليل قراءة branches المتكررة", "cache miss ثم DB"],
            ["Notification unread count", "عدد غير المقروء لكل user", "العداد يظهر في كل dashboard تقريبا", "cache miss ثم DB"],
            ["Chat conversations cache", "قائمة المحادثات لكل user", "الشات يقرأ نفس القائمة كثيرا", "cache miss ثم DB"],
            ["Socket.IO adapter", "pub/sub بين API instances", "لو user متصل على instance والحدث خرج من instance آخر، Redis يوصله", "realtime يصبح محلي فقط"],
            ["Automation locks", "مفاتيح lock مؤقتة SET NX PX", "منع تكرار نفس automation على أكثر من worker", "في production قد يتم skip لحماية التكرار"],
          ],
        )}
        ${p("الكود عامل Redis كـ optional optimization في مناطق كثيرة: getJsonCache يرجع undefined عند الخطأ، وsetJsonCache يفشل بصمت، لأن DB هي المصدر الحقيقي. لكن في production compose Redis مطلوب صحيا قبل تشغيل api/worker.")}
        ${miniFlow("قراءة فيها Redis cache", ["Service receives request", "Build cache key", "Try Redis get", "Hit: return cached JSON", "Miss: query PostgreSQL", "Set Redis TTL", "Return result"])}
        ${miniFlow("كتابة تلغي كاش", ["Mutation", "Write PostgreSQL", "Bump version or delete keys", "Next read builds new key", "Fresh DB result cached"])}
        `,
        "break",
      )}

      ${section(
        "Caching: إيه اللي بيتكاش وليه؟",
        `${p("مش كل حاجة في النظام متكاشة. الكاش مستخدم في الحاجات التي تقرأ كثيرا، نتيجتها آمنة للتخزين القصير، وتقدر ترجع من DB لو الكاش فشل.")}
        ${table(
          ["Cache", "Key shape تقريبا", "TTL", "سبب اختياره"],
          [
            ["Attendance overview", "<code>goalix:cache:attendance:overview:{academy}:v{version}:{filters}</code>", "30 ثانية", "overview قد يجمع attendance حسب branch/group/date، فالكاش يقلل الضغط"],
            ["Academy branches", "<code>goalix:academy:{academy}:branches:v{version}:p{page}:l{limit}</code>", "120 ثانية افتراضيا", "branches تظهر كثيرا ولا تتغير كل ثانية"],
            ["Notification unread count", "<code>goalix:notifications:{user}:unread-count:v1</code>", "30 ثانية افتراضيا", "badge في الشريط يحتاج قراءة متكررة"],
            ["Chat conversations", "<code>goalix:chat:{user}:conversations:v1</code>", "15 ثانية افتراضيا", "قائمة الشات تتكرر مع polling/realtime refresh"],
            ["Auth user", "<code>goalix:auth:user:v1:{userId}</code>", "120 ثانية افتراضيا", "تسريع بيانات المستخدم المتكررة"],
            ["Auth permissions", "مفتاح مبني من user/role/scope", "30 ثانية افتراضيا", "تقليل حساب الصلاحيات المتكرر"],
          ],
        )}
        ${callout("ليه TTL قصير؟", "لأن النظام إداري وبياناته حساسة. كاش طويل ممكن يعرض بيانات قديمة. لذلك معظم الكاشات قصيرة أو مربوطة بـ version key يتم زيادته عند mutation.", "good")}
        `,
      )}

      ${section(
        "Load Balancer / Nginx",
        `${p(`الموجود في ${code("ops/nginx/nginx.prod.conf")} حاليا هو Nginx reverse proxy. هو يستقبل المستخدمين على 80/443، يحول HTTP إلى HTTPS، ويرسل المسارات للservice المناسبة.`)}
        ${table(
          ["المسار", "يروح فين؟", "ملاحظات"],
          [
            ["<code>/health</code>", "API health", "مسموح على HTTP وHTTPS"],
            ["<code>/api/v1/</code>", "Express API", "proxy_read_timeout وsend_timeout 120s"],
            ["<code>/socket.io/</code>", "Express API Socket.IO", "يدعم Upgrade/Connection للWebSocket"],
            ["<code>/uploads/</code>", "Express API", "لأن الملفات protected وليست static"],
            ["<code>/</code>", "Next.js frontend", "أي شيء غير API/socket/uploads"],
          ],
        )}
        ${callout("هل هو Load Balancer؟", "حاليا لا بالمعنى الأفقي. upstream goalix_api يحتوي server واحد فقط: api:3000. لو أضفت api-1 وapi-2 وapi-3، وقتها Nginx يوزع بينهم افتراضيا round-robin.", "warn")}
        ${p("Nginx لا يشغل workers ولا يوزع jobs. توزيع الـ jobs يتم لأن كل worker متصل بنفس Redis queue، وBullMQ يعطي كل job لworker واحد يستهلكها.")}
        ${miniFlow("توجيه Nginx الحالي", ["User HTTPS", "Nginx", "Route match", "API or Frontend upstream", "Service response", "User"])}
        ${p("في config الحالي يوجد keepalive 32 داخل upstreams، وmax_fails=3/fail_timeout=10s. هذه إعدادات تساعد connection reuse وتجنب server فاشل مؤقتا إذا كان عندك أكثر من upstream server لاحقا.")}
        `,
      )}

      ${section(
        "Performance: اتحسن إزاي؟",
        `${p("الأداء في Goalix ليس feature واحدة. هو مجموعة قرارات تقلل وقت الانتظار وتقلل ضغط DB وتمنع السيرفر من الانهيار تحت الحمل.")}
        ${cards([
          { title: "فصل worker عن API", body: "في production، api لا يشغل BullMQ workers. هذا يجعل الطلبات السريعة لا تتزاحم مع مهام AI/payment/notifications/ranking." },
          { title: "Connection reuse", body: "Next.js proxy يستخدم http/https agents بـ keepAlive وmaxSockets. Nginx يستخدم upstream keepalive. هذا يقلل تكلفة TCP connections." },
          { title: "Redis short caches", body: "قراءات ساخنة مثل unread count وattendance overview وchat conversations لا تضرب DB كل مرة." },
          { title: "Rate limits", body: "RedisStore للrate limits يجعل الحدود موزعة بين instances، مع fallback memory عند التعطل." },
          { title: "PostgreSQL pool/timeouts", body: "DB_POOL_MAX=10 في production compose، وstatement/lock/idle timeouts تقلل queries العالقة." },
          { title: "Slow logs", body: "SLOW_QUERY_LOG_MS وSLOW_REQUEST_LOG_MS يسمحان بمعرفة المسارات الثقيلة بدل التخمين." },
        ])}
        ${table(
          ["التحسين", "أين موجود؟", "أثره"],
          [
            ["Indexes للمسارات الساخنة", "migrations 072, 080, 086, 094", "يسرع notifications/chat/calendar/rankings/media lookups"],
            ["إزالة indexes متكررة", "migration 094", "يقلل تكلفة الكتابة والتخزين"],
            ["Autovacuum/fillfactor للجداول كثيرة التحديث", "migration 094", "يقلل bloat ويحسن updates على auth_refresh_tokens/notification_inbox/realtime_outbox/chat_conversations"],
            ["Protected upload cache header", "app.js /uploads", "private max-age للملفات المسموح بها"],
            ["Frontend RTK Query", "lib/store/api/*", "client-side caching, retries, invalidation tags"],
            ["Polling محدود", "notifications hooks", "polling كل 120 ثانية مع skip when unfocused"],
          ],
        )}
        ${callout("نقطة مهمة", "لا يصح نقول النظام يضمن 20k users من الكود فقط. الأداء الحقيقي يثبت بload test على staging يشبه production: Nginx، عدة API instances، workers، PostgreSQL منفصل، Redis منفصل، وبيانات قريبة من الواقع.", "warn")}
        `,
        "break",
      )}

      ${section(
        "Database: ماشية إزاي؟ وهل كويسة؟",
        `${p("قاعدة البيانات PostgreSQL هي source of truth. الكود يستخدم Knex، ومعظم modules لا تكتب SQL عشوائي داخل controller؛ بل تمر عبر repositories. هذا جيد للفصل والاختبار وتقليل تكرار المنطق.")}
        ${table(
          ["Domain", "أمثلة جداول/كيانات", "وظيفته"],
          [
            ["Identity/Auth/IAM", "auth_users, refresh/session tables, roles, permissions, MFA, audit_logs", "الدخول، الجلسات، الصلاحيات، التتبع الأمني"],
            ["Academy", "academy_academies, branches, birth_years, groups", "هيكل الأكاديمية والفروع والمجموعات والفئات العمرية"],
            ["People", "player_profiles, coach_profiles, parent_profiles, parent_player_links", "اللاعبين والمدربين وأولياء الأمور والربط بينهم"],
            ["Operations", "calendar_events, training sessions, matches, attendance", "التدريب، المباريات، الحضور، التقويم"],
            ["Performance", "ranking snapshots/inputs, evaluations, injury risk, AI tables", "التقييمات والترتيب والتحليلات"],
            ["Communication", "chat_conversations, chat_messages, read_receipts, notification_inbox/logs", "الشات والإشعارات وحالات القراءة"],
            ["Billing/Storage/Ops", "payments/subscriptions/media_files/lifecycle/backups", "الاشتراكات والمدفوعات والملفات والأرشفة"],
          ],
        )}
        ${callout("الحكم", "نعم، التصميم الحالي جيد كنواة OLTP ومنظم للتوسع التدريجي. لكنه يحتاج PgBouncer وpg_stat_statements وbackup drills وload tests قبل production كبير.", "good")}
        ${p("لماذا لا نعمل sharding الآن؟ لأن التعقيد عالي جدا وغير مبرر بدون قياسات. الأفضل حاليا: indexes مبنية على queries حقيقية، connection budget مضبوط، lifecycle للأرشفة، وPgBouncer عند تعدد instances.")}
        ${miniFlow("Database write flow", ["Controller validates request", "Service checks ownership/policy", "Repository transaction/write", "PostgreSQL persists", "Cache invalidated", "Event/audit emitted"])}
        `,
      )}

      ${section(
        "Backend Modules بالتفصيل",
        `${table(
          ["Module", "المسؤولية", "يعتمد على"],
          [
            ["Auth", "login, admin login, MFA, refresh, logout, session/me, password reset", "PostgreSQL, Redis session/user caches, JWT, cookies, CSRF"],
            ["Academy", "academy settings, branches, birth years, groups", "PostgreSQL, Redis branches cache, event bus"],
            ["Players", "player profiles, import/export, parent links, profile completion", "PostgreSQL, upload validation/storage في بعض المسارات"],
            ["Coaches", "coach profiles, assignments, permissions, coach portal scope", "PostgreSQL, AcademyService, RBAC"],
            ["Calendar", "training, matches, schedules, match day, evaluations, injury-risk inputs", "PostgreSQL, CustomDataService, PlayersService, Redis attendance invalidation"],
            ["Attendance", "attendance overview and histories", "PostgreSQL, Redis 30s overview cache"],
            ["Rankings", "weekly/monthly rankings, player history, recalculation request", "PostgreSQL, rankingsQueue"],
            ["Notifications", "in-app notifications, unread count, delivery logs, cleanup", "PostgreSQL, Redis unread cache, notificationsQueue, lifecycle service"],
            ["Chat", "conversations, messages, attachments, read receipts", "PostgreSQL, Redis conversations cache, Socket.IO realtime"],
            ["AI", "performance score, injury risk, nutrition plan, AI chat requests", "PostgreSQL, access policy, aiQueue"],
            ["Payments", "plans, subscriptions, payment records, invoices placeholder", "PostgreSQL, paymentsQueue"],
            ["Data lifecycle/Backups", "archive old data, scheduled backup", "PostgreSQL, Redis automation locks"],
          ],
        )}`,
      )}

      ${section(
        "Authentication Flow",
        `${p("الدخول في النظام ليس مجرد JWT. فيه cookies، refresh token/session record في DB، optional Redis session cache، CSRF، وMFA للأدوار الإدارية.")}
        ${miniFlow("Player/Parent login", ["Username/password", "AuthService verifies", "Create session in DB", "Cache session/user in Redis", "Set HttpOnly cookies", "Redirect dashboard"])}
        ${miniFlow("Admin/Coach login with MFA", ["Password verified", "MFA required?", "Create challenge", "OTP/backup code", "Create session", "Set cookies"])}
        ${steps([
          "المستخدم يرسل username/password من الواجهة.",
          "AuthService يجلب المستخدم ويتأكد من الدور والحالة وكلمة السر.",
          "لو الدور admin أو coach وMFA مطلوب، يرجع mfa_required بدل ما ينشئ session مباشرة.",
          "الـ challenge قد يحفظ في Redis كمفتاح مؤقت، ومعه fallback في PostgreSQL.",
          "بعد OTP صحيح، يتم إنشاء refresh/session record في DB.",
          "Access token وrefresh token يرسلان في cookies آمنة، وRedis يخزن session cache لتسريع الطلبات القادمة.",
          "proxy.ts في Next يفحص accessToken وrole قبل السماح بدخول /admin أو /coach أو /player أو /parent.",
        ])}
        `,
        "break",
      )}

      ${section(
        "Realtime Flow",
        `${p("Realtime في Goalix يستخدم Socket.IO. الفكرة: حفظ البيانات في DB أولا، ثم إرسال event للمتصلين. هذا مهم لأن لو event ضاع، العميل يقدر يعمل REST refresh ويرجع للحقيقة من DB.")}
        ${steps([
          "المتصفح يفتح socket connection مع cookies أو Bearer token.",
          "Socket server يستخدم authenticateAccessToken للتحقق من المستخدم.",
          "كل user يدخل room باسم user:{userId}.",
          "عند فتح conversation، العميل يرسل chat:join.",
          "الخادم يتأكد من أن المستخدم يملك حق دخول المحادثة.",
          "عند message/notification، البيانات تحفظ في PostgreSQL أولا.",
          "بعد الحفظ، Socket.IO يرسل chat:* أو notification:* للrooms المناسبة.",
          "لو Redis adapter متاح، الحدث ينتقل بين API instances. لو غير متاح، الحدث محلي للinstance فقط.",
        ])}
        ${miniFlow("Chat message", ["Send message", "Authorize conversation", "DB transaction", "Invalidate caches", "Emit socket event", "Clients refresh/update UI"])}
        `,
      )}

      ${section(
        "Protected Files / Uploads",
        `${p("الملفات في المشروع لا ينفع تتساب static public ببساطة، لأن فيها chat attachments أو ملفات تخص لاعب/أكاديمية. لذلك /uploads/* في Express يتحقق من الصلاحية قبل إرسال الملف.")}
        ${steps([
          "المستخدم يطلب /uploads/path.",
          "authMiddleware يتأكد من access token.",
          "لو path يبدأ بـ chat/، ChatService يتأكد أن المستخدم participant أو مسموح له بالattachment.",
          "لو ملف عادي، storage metadata تبحث في media_files، ثم access policy تحدد هل المستخدم يرى الملف.",
          "لو مسموح، storage adapter يرجع stream/file.",
          "لو مرفوض، النظام يرجع 404 آمن حتى لا يكشف وجود الملف، وقد يسجل audit denied لو حساس.",
        ])}
        `,
      )}

      ${section(
        "Background Automations",
        `${p("الـ automations هي شغل يتكرر بالوقت وليس بسبب request مباشر. مثال: reminders، weekly injury risk، notification cleanup، data lifecycle، backups.")}
        ${miniFlow("Automation lock flow", ["Timer fires", "Try Redis SET NX PX", "If acquired run task", "If not acquired skip", "Release by Lua compare/delete"])}
        ${table(
          ["Automation", "وظيفتها", "لماذا lock؟"],
          [
            ["Reminder scans", "match day, attendance QR, monthly measurement reminders", "حتى لا يرسل أكثر من worker نفس reminder"],
            ["Weekly injury risk", "تشغيل تحليل أسبوعي للإصابات", "حتى لا يتكرر الحساب"],
            ["Notification cleanup", "أرشفة/حذف notification records القديمة حسب retention", "حتى لا تعمل cleanup مرتين"],
            ["Data lifecycle", "أرشفة بيانات hot إلى archive tables", "حماية من تكرار batches"],
            ["Database backup", "تشغيل backup دوري إذا مستحق", "منع أكثر من backup متزامن"],
          ],
        )}
        `,
      )}

      ${section(
        "Production Scaling: ماذا نحتاج لاحقا؟",
        `${p("التصميم يسمح بالتوسع، لكن current compose يشغل API service واحد. للتوسع الحقيقي تضيف أكثر من API instance، أكثر من worker، وتضع PgBouncer أمام PostgreSQL.")}
        ${miniFlow("Target scale", ["Nginx/LB", "API instances", "PgBouncer", "PostgreSQL Primary", "Redis", "Worker pool", "S3 storage"])}
        ${table(
          ["المكون", "الوضع الحالي", "عند التوسع"],
          [
            ["Nginx", "upstream واحد للAPI وواحد للfrontend", "أضف servers متعددة أو استخدم LB managed"],
            ["API", "service واحد في compose", "عدة replicas stateless"],
            ["Workers", "worker service واحد", "عدة workers تستهلك نفس BullMQ queues"],
            ["PostgreSQL", "postgres container مباشر", "Managed Postgres أو Primary/Standby + PgBouncer"],
            ["Redis", "Redis واحد مع AOF", "Managed Redis/HA، وربما فصل queue Redis عن cache/socket Redis عند الضغط العالي"],
            ["Storage", "local volume مسموح في compose", "S3-compatible object storage للإنتاج الحقيقي"],
          ],
        )}
        `,
        "break",
      )}

      ${section(
        "حدود وملاحظات صريحة",
        `${ul([
          "الـ PDF الحالي لا يحتوي Mermaid code. الأكواد موجودة فقط في ملف Markdown الملحق.",
          "Audit queue فعالة فعلا. أما AI/ranking/payment/external notifications workers فهي في أغلبها stubs/TODO حاليا.",
          "Nginx الحالي reverse proxy وليس load balancer أفقي لأن upstream فيه server واحد.",
          "Redis مهم جدا للتشغيل الكامل، لكنه ليس مصدر الحقيقة للبيانات الأساسية.",
          "قاعدة البيانات منظمة ومناسبة كبداية قوية، لكن إثبات تحمل أرقام كبيرة يحتاج load testing ومراقبة حقيقية.",
          "يوجد تكرار في nginx config لنفس location / ثلاث مرات. السلوك غالبا ثابت، لكن الأفضل تنظيفه.",
        ])}`,
      )}

      ${section(
        "الملفات التي بني عليها التقرير",
        `${ul([
          code("app/api/v1/[...path]/route.ts"),
          code("proxy.ts"),
          code("golx-backend/src/app.js"),
          code("golx-backend/src/server.js"),
          code("golx-backend/src/infrastructure/queue.js"),
          code("golx-backend/src/infrastructure/redis.js"),
          code("golx-backend/src/workers/*.js"),
          code("golx-backend/src/bootstrap/service-factory.js"),
          code("golx-backend/src/bootstrap/route-registry.js"),
          code("golx-backend/src/bootstrap/background-automations.js"),
          code("golx-backend/src/middleware/rateLimit.middleware.js"),
          code("golx-backend/src/shared/auth-session-cache.js"),
          code("golx-backend/src/shared/redis-json-cache.js"),
          code("golx-backend/src/shared/attendance-cache.js"),
          code("ops/nginx/nginx.prod.conf"),
          code("docker-compose.prod.yml"),
        ])}
        <p class="small">Mermaid source محفوظ في Markdown، وليس داخل PDF.</p>`,
      )}
    </div>
  </main>
</body>
</html>`;

function ul(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(mdPath, markdown, "utf8");
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;padding:0 11mm;text-align:center;font-family:Arial">Goalix Architecture Deep Report - <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      margin: { top: "9mm", right: "9mm", bottom: "15mm", left: "9mm" },
    });
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ mdPath, htmlPath, pdfPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
