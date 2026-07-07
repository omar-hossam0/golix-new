/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "generated");
const htmlPath = path.join(outDir, "goalix-operations-command-runbook.html");
const pdfPath = path.join(outDir, "goalix-operations-command-runbook.pdf");
const screenshotPath = path.join(outDir, "goalix-operations-command-runbook-preview.png");

const today = new Date().toLocaleDateString("en-GB", {
  year: "numeric",
  month: "long",
  day: "2-digit",
});

const commandGroups = [
  {
    title: "1. تشغيل التطوير المحلي",
    accent: "green",
    rows: [
      ["تجهيز Redis فقط", "npm run infra:up", "يشغل Redis من docker-compose.dev.yml على localhost:6379."],
      ["إيقاف Redis المحلي", "npm run infra:down", "يوقف خدمات التطوير ويحافظ على أو يمسح حسب Docker compose behavior."],
      ["حالة Redis", "npm run infra:status", "يعرض حالة container الخاص بـ Redis."],
      ["تحرير بورتات التطوير", "npm run free:dev-ports", "مفيد لو 3000/3001/6379 متعلقة من تشغيل سابق."],
      ["تجهيز موديلات Python", "npm run models:setup", "يتأكد من جاهزية ملفات ومتطلبات نماذج الذكاء الاصطناعي."],
      ["تشغيل النظام كامل Dev", "npm run dev", "يشغل frontend + backend + المتطلبات حسب scripts/dev.js."],
      ["تشغيل Dev HTTPS", "npm run dev:https", "نفس dev لكن بشهادات HTTPS للتجارب التي تحتاج Secure Context."],
      ["تشغيل Frontend فقط", "npm run dev:frontend", "Next.js فقط على 0.0.0.0:3001."],
      ["تشغيل Backend فقط", "npm run dev:backend", "يدخل golx-backend ويشغل nodemon."],
      ["عرض روابط LAN", "npm run lan:info", "يعرض روابط الشبكة المحلية بعد التشغيل."],
      ["تجهيز LAN access", "npm run lan:setup", "يضبط إعدادات ويندوز/Firewall حسب السكريبت."],
    ],
  },
  {
    title: "2. تشغيل الإنتاج Docker",
    accent: "blue",
    rows: [
      ["بناء وتشغيل الإنتاج", "docker compose -f docker-compose.prod.yml up -d --build", "يبني frontend/backend ويشغل postgres, redis, migrate, api, worker, frontend, nginx."],
      ["عرض حالة الخدمات", "docker compose -f docker-compose.prod.yml ps", "أول أمر تشخيص بعد deploy."],
      ["متابعة اللوجات", "docker compose -f docker-compose.prod.yml logs -f api worker frontend nginx", "راقب الإقلاع، الـ health checks، وأخطاء migrations."],
      ["إعادة تشغيل API", "docker compose -f docker-compose.prod.yml restart api", "لو غيرت env أو الخدمة علقت."],
      ["إعادة تشغيل worker", "docker compose -f docker-compose.prod.yml restart worker", "لو queues أو automations وقفت."],
      ["إيقاف الإنتاج", "docker compose -f docker-compose.prod.yml down", "يوقف containers بدون حذف volumes."],
      ["تشغيل migration يدوي", "docker compose -f docker-compose.prod.yml run --rm migrate", "يشغل خدمة migrate مرة واحدة."],
      ["فتح shell داخل API", "docker compose -f docker-compose.prod.yml exec api sh", "للتشخيص من داخل الشبكة الداخلية."],
      ["فتح shell داخل worker", "docker compose -f docker-compose.prod.yml exec worker sh", "مفيد للـ backup وjobs."],
    ],
  },
  {
    title: "3. Backend وDatabase",
    accent: "lime",
    rows: [
      ["تشغيل backend dev", "cd golx-backend && npm run dev", "nodemon على src/server.js."],
      ["تشغيل backend production محلي", "cd golx-backend && npm start", "يشغل src/server.js مباشرة."],
      ["تشغيل worker", "cd golx-backend && npm run worker", "يشغل BullMQ workers والـ background automations."],
      ["تطبيق migrations", "cd golx-backend && npm run migrate", "لازم بعد أي migration جديد."],
      ["Rollback آخر migration", "cd golx-backend && npm run migrate:rollback", "استخدمه بحذر في staging أكثر من production."],
      ["إنشاء migration", "cd golx-backend && npm run migrate:make -- migration_name", "لإضافة migration جديدة."],
      ["تشغيل كل seeds", "cd golx-backend && npm run seed", "يشغل seeds من فولدر seeds."],
      ["Seed أول Admin فقط", "cd golx-backend && npm run seed:admin", "بديل legacy يعتمد على bootstrap admin الجديد."],
      ["اختبار backend", "cd golx-backend && npm test", "Jest runInBand."],
      ["Lint backend", "cd golx-backend && npm run lint", "ESLint على src."],
      ["Audit بنية الداتابيز", "cd golx-backend && npm run db:audit", "يفحص مؤشرات/معمارية الداتابيز."],
      ["Audit صارم", "cd golx-backend && npm run db:audit:strict", "يفشل عند مشاكل معماريّة معينة."],
    ],
  },
  {
    title: "4. أول Admin بعد داتابيز فاضية",
    accent: "orange",
    rows: [
      ["إنشاء أول Academy Owner", "$env:BOOTSTRAP_ADMIN_EMAIL=\"owner@example.com\"; $env:BOOTSTRAP_ADMIN_USERNAME=\"admin\"; $env:BOOTSTRAP_ADMIN_PASSWORD=\"StrongPass#123\"; $env:BOOTSTRAP_ACADEMY_NAME=\"Goalix Academy\"; cd golx-backend; npm run bootstrap:admin", "ينشئ الأكاديمية، أول أدمن، IAM roles، admin_accounts، ويترك MFA مطلوب على أول دخول."],
      ["Recovery لو أدمن موجود وتريد تحديثه", "$env:BOOTSTRAP_ADMIN_ALLOW_EXISTING=\"true\"; npm run bootstrap:admin", "استخدمه فقط لو أنت متأكد أنه recovery شرعي."],
      ["Docker bootstrap", "docker compose -f docker-compose.prod.yml run --rm -e BOOTSTRAP_ADMIN_PASSWORD=\"StrongPass#123\" -e BOOTSTRAP_ADMIN_EMAIL=\"owner@example.com\" -e BOOTSTRAP_ACADEMY_NAME=\"Goalix Academy\" api npm run bootstrap:admin", "ينفذ bootstrap داخل شبكة Docker بعد migrations."],
      ["بعد إنشاء الأدمن", "افتح /admin-login ثم فعّل MFA من /admin/settings", "النظام يسمح بالدخول الأول لكنه يقفل admin panel على Settings حتى تفعيل 2FA."],
    ],
  },
  {
    title: "5. Backup وRestore",
    accent: "red",
    rows: [
      ["Backup يدوي محلي", "cd golx-backend; $env:DATABASE_URL=\"postgresql://USER:PASSWORD@HOST:5432/golx_main\"; $env:BACKUP_DIR=\"D:\\\\goalix-backups\"; npm run backup:db", "ينتج .dump و .sha256."],
      ["Backup داخل Docker", "docker compose -f docker-compose.prod.yml exec worker npm run backup:db", "يكتب داخل /app/backups على volume goalix-backups."],
      ["Restore من CLI", "cd golx-backend; $env:CONFIRM_RESTORE=\"RESTORE GOALIX\"; npm run restore:db -- golx_golx_main_auto_2026-07-07T10-00-00.dump", "يستخدم pg_restore --clean --if-exists. عملية destructive."],
      ["Restore داخل Docker", "docker compose -f docker-compose.prod.yml exec -e CONFIRM_RESTORE=\"RESTORE GOALIX\" worker npm run restore:db -- /app/backups/file.dump", "لما التطبيق مش قادر يفتح Settings."],
      ["تفعيل زر Restore في Settings", "BACKUP_RESTORE_ENABLED=true", "مقفول افتراضيا في production. يحتاج password + عبارة RESTORE GOALIX."],
      ["تغيير تكرار auto backup", "BACKUP_INTERVAL_MINUTES=1440", "القيمة الافتراضية يوميا. 15 تعني كل 15 دقيقة."],
      ["تغيير مدة الاحتفاظ", "BACKUP_RETENTION_DAYS=14", "يحذف النسخ الأقدم عند تشغيل backup جديد."],
      ["تعطيل auto backup", "BACKUP_AUTOMATION_ENABLED=false", "الـ manual backup يظل متاحا."],
      ["فحص عدم commit dumps", "npm run security:scan-dumps", "يفشل لو dump files اتتبعت في Git."],
      ["Sanitize dump للتسليم", "cd golx-backend && npm run dump:sanitize -- input.sql output.sql", "يمسح/يموه بيانات حساسة في plain SQL dumps."],
    ],
  },
  {
    title: "6. Data Lifecycle وJobs",
    accent: "purple",
    rows: [
      ["تقرير lifecycle", "cd golx-backend && npm run data:lifecycle:report", "يعرض المرشحين للأرشفة."],
      ["Dry run", "cd golx-backend && npm run data:lifecycle:dry-run", "يختبر بدون تعديل فعلي."],
      ["تشغيل lifecycle", "cd golx-backend && npm run data:lifecycle:run", "ينقل/ينظف حسب السياسات."],
      ["تفعيل lifecycle تلقائي", "DATA_LIFECYCLE_ENABLED=true", "فعله على worker واحد فقط."],
      ["تفعيل background automations", "BACKGROUND_AUTOMATIONS_ENABLED=true", "يفضل على worker وليس API."],
      ["تفعيل injury risk automation", "INJURY_RISK_AUTOMATION_ENABLED=true", "يشغل scan أسبوعي/دوري حسب env."],
      ["تفعيل notification cleanup", "NOTIFICATION_CLEANUP_ENABLED=true", "أرشفة وتنظيف notifications القديمة."],
    ],
  },
  {
    title: "7. الجودة والاختبارات والأمان",
    accent: "cyan",
    rows: [
      ["Lint frontend", "npm run lint", "ESLint للواجهة."],
      ["Build frontend", "npm run build", "يتأكد أن Next production build شغال."],
      ["Type check", "npx tsc --noEmit", "مفيد قبل deploy."],
      ["Backend lint", "npm run backend:lint", "يشغل lint داخل golx-backend."],
      ["Backend tests", "npm run backend:test", "يشغل Jest backend."],
      ["E2E tests", "npm run test:e2e", "Playwright smoke/e2e."],
      ["Install browser for E2E", "npm run test:e2e:install", "يثبت Chromium لو ناقص."],
      ["Security audit", "npm run security:audit", "npm audit للواجهة والباك."],
      ["Quality checks", "npm run quality", "i18n + text + artifacts + dump scan."],
      ["Full verify", "npm run verify", "lint + quality + build + backend lint/test + security audit."],
    ],
  },
  {
    title: "8. Deploy وأدوات مساعدة",
    accent: "gray",
    rows: [
      ["Auto deploy watch", "npm run deploy:auto", "يشغل scripts/auto-docker-deploy.ps1."],
      ["Deploy مرة واحدة", "npm run deploy:auto:once", "مناسب لتحديث سريع."],
      ["Linux deploy script", "bash scripts/deploy-production.sh", "لبيئة Linux/VPS إن كانت مهيأة."],
      ["تشغيل سكريبت CMD", "scripts\\start-auto-docker-deploy.cmd", "مفيد من ويندوز."],
      ["Load test", "cd golx-backend && npm run load:test", "اختبار حمل أساسي."],
      ["Mixed load test", "cd golx-backend && npm run load:mixed", "سيناريوهات مختلطة."],
      ["Socket load test", "cd golx-backend && npm run load:socket", "يركز على realtime/socket."],
      ["Analyze load report", "cd golx-backend && npm run load:analyze", "تحليل نتائج الحمل."],
    ],
  },
];

const incidents = [
  ["الداتابيز فاضية لكن الجداول موجودة", "شغل migrations لو محتاج، ثم bootstrap:admin، بعدها login وفعّل MFA.", "npm run bootstrap:admin"],
  ["التطبيق مش بيفتح بعد deploy", "ابدأ بـ ps ثم logs ثم ready endpoint، وبعدها راجع env secrets.", "docker compose -f docker-compose.prod.yml ps"],
  ["Redis واقع", "في dev شغل infra:up. في prod راجع logs redis وأعد تشغيل worker بعد رجوعه.", "npm run infra:up"],
  ["API شغال لكن jobs لا تعمل", "راجع worker logs وBULLMQ_WORKERS_ENABLED وRedis.", "docker compose -f docker-compose.prod.yml logs -f worker"],
  ["عايز نسخة قبل migration خطير", "اعمل backup يدوي ثم شغل migrate.", "cd golx-backend && npm run backup:db"],
  ["الداتابيز اتمسحت والدخول مستحيل", "استرجع من CLI/worker لأن زر Settings لن يفتح بدون DB.", "CONFIRM_RESTORE=\"RESTORE GOALIX\" npm run restore:db -- file.dump"],
  ["الأدمن نسي MFA أو الجهاز ضاع", "استخدم إدارة MFA من admin آخر. لو مفيش admin آخر، استخدم bootstrap recovery بحذر أو تدخل DB مباشر مؤقت.", "BOOTSTRAP_ADMIN_ALLOW_EXISTING=true npm run bootstrap:admin"],
  ["ملفات dump ظهرت في Git", "شغل scan-dumps واحذف الملفات من التتبع. لا ترفع production dumps.", "npm run security:scan-dumps"],
  ["عايز تعرض الموقع على موبايل في نفس الشبكة", "شغل dev ثم lan:info وربما lan:setup.", "npm run lan:info"],
  ["تغيير أسرار JWT أو CSRF", "اتبع runbook rotation. لا تغير TOTP_ENCRYPTION_KEY مباشرة بدون re-encryption.", "راجع docs/production-hardening-runbook.md"],
];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function commandTable(group) {
  return `
    <section class="chapter ${group.accent}">
      <h2>${esc(group.title)}</h2>
      <table>
        <thead>
          <tr><th>الحالة / الهدف</th><th>الأمر</th><th>ملاحظات التشغيل</th></tr>
        </thead>
        <tbody>
          ${group.rows.map(([goal, command, note]) => `
            <tr>
              <td class="goal">${esc(goal)}</td>
              <td><code>${esc(command)}</code></td>
              <td>${esc(note)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Goalix Operations Command Runbook</title>
<style>
  @page { size: A4; margin: 15mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    color: #162033;
    background: #eef3f5;
    line-height: 1.55;
  }
  .page {
    background: #fff;
    min-height: 100vh;
  }
  .cover {
    min-height: 265mm;
    padding: 24mm 18mm;
    color: #06111f;
    background:
      linear-gradient(135deg, rgba(182,255,0,.92), rgba(34,211,238,.78)),
      linear-gradient(45deg, #0b1f2f, #122c3f);
    position: relative;
    overflow: hidden;
  }
  .cover::after {
    content: "";
    position: absolute;
    inset-inline-end: -50mm;
    inset-block-end: -50mm;
    width: 150mm;
    height: 150mm;
    border-radius: 50%;
    border: 18mm solid rgba(255,255,255,.23);
  }
  .brand {
    display: inline-block;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.65);
    font-weight: 800;
    letter-spacing: .04em;
  }
  .cover h1 {
    position: relative;
    max-width: 160mm;
    margin: 32mm 0 8mm;
    font-size: 42px;
    line-height: 1.15;
    letter-spacing: 0;
  }
  .cover p {
    position: relative;
    max-width: 155mm;
    font-size: 17px;
    font-weight: 600;
  }
  .meta-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 24mm;
  }
  .meta {
    background: rgba(255,255,255,.72);
    border: 1px solid rgba(255,255,255,.65);
    border-radius: 10px;
    padding: 12px;
  }
  .meta b { display: block; font-size: 12px; color: #315060; }
  .meta span { display: block; margin-top: 4px; font-size: 14px; font-weight: 800; }
  .content { padding: 14mm 13mm; }
  .toc, .principles, .chapter, .incident-section, .env-section {
    page-break-inside: avoid;
    margin-bottom: 12mm;
  }
  h2 {
    margin: 0 0 5mm;
    font-size: 22px;
    color: #0e2336;
    border-bottom: 3px solid #b6ff00;
    padding-bottom: 6px;
  }
  h3 {
    margin: 7mm 0 3mm;
    font-size: 16px;
    color: #104d5f;
  }
  .lead {
    margin: 0 0 8mm;
    color: #405160;
    font-size: 14px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 8mm 0;
  }
  .card {
    border-radius: 10px;
    border: 1px solid #d7e1e7;
    background: #f8fbfc;
    padding: 10px 12px;
    min-height: 32mm;
  }
  .card b { display: block; color: #0e3446; margin-bottom: 4px; }
  .card span { color: #536372; font-size: 12px; }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 5mm;
    table-layout: fixed;
    direction: rtl;
    page-break-inside: auto;
  }
  th {
    background: #0e2336;
    color: white;
    font-size: 12px;
    padding: 9px 8px;
    text-align: right;
  }
  td {
    border-bottom: 1px solid #dce6eb;
    border-inline-start: 1px solid #edf2f4;
    padding: 8px;
    vertical-align: top;
    font-size: 11.4px;
    overflow-wrap: anywhere;
  }
  tr:nth-child(even) td { background: #f7fafb; }
  th:first-child { border-start-start-radius: 8px; }
  th:last-child { border-start-end-radius: 8px; }
  .goal { font-weight: 800; color: #173044; width: 24%; }
  td:nth-child(2), th:nth-child(2) { width: 42%; direction: ltr; text-align: left; }
  td:nth-child(3), th:nth-child(3) { width: 34%; }
  code {
    display: block;
    direction: ltr;
    text-align: left;
    unicode-bidi: plaintext;
    white-space: pre-wrap;
    font-family: Consolas, "Courier New", monospace;
    font-size: 10.6px;
    color: #062334;
    background: #eaf5f6;
    border: 1px solid #cde5e8;
    border-radius: 7px;
    padding: 6px 7px;
  }
  .green h2 { border-color: #7bea28; }
  .blue h2 { border-color: #22d3ee; }
  .lime h2 { border-color: #b6ff00; }
  .orange h2 { border-color: #ffb020; }
  .red h2 { border-color: #ff4d4d; }
  .purple h2 { border-color: #a78bfa; }
  .cyan h2 { border-color: #06b6d4; }
  .gray h2 { border-color: #64748b; }
  .callout {
    border: 1px solid #f3c36d;
    background: #fff7e6;
    border-radius: 10px;
    padding: 12px 14px;
    margin: 6mm 0;
    color: #593b00;
  }
  .danger {
    border-color: #ffb4b4;
    background: #fff1f1;
    color: #6b1111;
  }
  .ok {
    border-color: #b6ff00;
    background: #f4ffe2;
    color: #224100;
  }
  .incident-section table td:nth-child(1), .incident-section table th:nth-child(1) { width: 28%; }
  .incident-section table td:nth-child(2), .incident-section table th:nth-child(2) { width: 42%; direction: rtl; text-align: right; }
  .incident-section table td:nth-child(3), .incident-section table th:nth-child(3) { width: 30%; direction: ltr; text-align: left; }
  .footer-note {
    margin-top: 10mm;
    color: #657482;
    font-size: 11px;
    text-align: center;
  }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="brand">GOALIX OPERATIONS</div>
      <h1>دليل أوامر التشغيل والطوارئ والنسخ الاحتياطي</h1>
      <p>Runbook عملي لإدارة Goalix في التطوير والإنتاج: تشغيل الخدمات، إصلاح الحالات الشائعة، أول أدمن بعد داتابيز فاضية، backup/restore، الاختبارات، والجودة.</p>
      <div class="meta-grid">
        <div class="meta"><b>المشروع</b><span>Goalix</span></div>
        <div class="meta"><b>آخر تحديث</b><span>${today}</span></div>
        <div class="meta"><b>النطاق</b><span>Dev + Production + DR</span></div>
      </div>
    </section>

    <section class="content">
      <section class="principles">
        <h2>قواعد تشغيل سريعة قبل أي أمر</h2>
        <p class="lead">اعتبر هذا الدليل نقطة البداية وقت الضغط. اقرأ الحالة، نفذ الأمر، ثم راقب اللوجات. أوامر restore وbootstrap مؤثرة ويجب تنفيذها من شخص موثوق.</p>
        <div class="cards">
          <div class="card"><b>لا تعمل Restore بلا Backup</b><span>زر restore والـ CLI destructive. النظام ينشئ safety backup قبل restore من الواجهة، لكن في الطوارئ خذ نسخة يدوية لو أمكن.</span></div>
          <div class="card"><b>Worker هو مكان الأتمتة</b><span>الـ backup التلقائي، cleanup، lifecycle، queues يجب أن تعمل على worker وليس API container.</span></div>
          <div class="card"><b>MFA للأدمن والمدرب</b><span>أول أدمن يتم إنشاؤه بالـ bootstrap ثم يجبره النظام على إعداد MFA قبل استخدام admin panel بالكامل.</span></div>
        </div>
        <div class="callout ok"><b>مسار التشغيل الطبيعي:</b> env جاهز -> migrations -> bootstrap admin عند الحاجة -> worker شغال -> backup automatic -> verify قبل deploy.</div>
        <div class="callout danger"><b>تحذير:</b> لو الداتابيز اتمسحت بالكامل، زر Settings لن يفتح لأن login نفسه يعتمد على الداتابيز. استخدم restore CLI من السيرفر أو Docker worker.</div>
      </section>

      <section class="toc">
        <h2>الفهرس العملي</h2>
        <div class="cards">
          ${commandGroups.map((g, i) => `<div class="card"><b>${i + 1}. ${esc(g.title.replace(/^[0-9]+\\.\\s*/, ""))}</b><span>أوامر وحالات جاهزة للتنفيذ.</span></div>`).join("")}
        </div>
      </section>

      ${commandGroups.map(commandTable).join("")}

      <section class="incident-section page-break">
        <h2>سيناريوهات الطوارئ: لو حصل كذا اعمل كذا</h2>
        <table>
          <thead><tr><th>المشكلة</th><th>التصرف الصحيح</th><th>أول أمر تبدأ به</th></tr></thead>
          <tbody>
            ${incidents.map(([problem, action, command]) => `
              <tr>
                <td class="goal">${esc(problem)}</td>
                <td>${esc(action)}</td>
                <td><code>${esc(command)}</code></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>

      <section class="env-section">
        <h2>أهم متغيرات البيئة</h2>
        <table>
          <thead><tr><th>المتغير</th><th>مثال / قيمة</th><th>وظيفته</th></tr></thead>
          <tbody>
            ${[
              ["DATABASE_URL", "postgresql://USER:PASSWORD@HOST:5432/golx_main", "اتصال PostgreSQL."],
              ["REDIS_URL", "redis://redis:6379", "اتصال Redis للـ cache/queues/realtime."],
              ["JWT_SECRET / JWT_REFRESH_SECRET", "32+ random chars", "توقيع access/refresh tokens."],
              ["CSRF_SECRET / COOKIE_SECRET", "32+ random chars", "حماية cookies وCSRF."],
              ["TOTP_ENCRYPTION_KEY", "64 hex chars or 32-byte base64", "تشفير أسرار MFA. لا تغيره مباشرة."],
              ["MFA_ENFORCED_ROLES", "admin,coach", "يجبر هذه الأدوار على MFA."],
              ["BACKUP_DIR", "/app/backups", "مكان حفظ ملفات .dump و.sha256."],
              ["BACKUP_AUTOMATION_ENABLED", "true", "تشغيل backup تلقائي من worker."],
              ["BACKUP_INTERVAL_MINUTES", "1440", "الفاصل بين النسخ التلقائية."],
              ["BACKUP_RETENTION_DAYS", "14", "حذف النسخ الأقدم."],
              ["BACKUP_RESTORE_ENABLED", "false", "تمكين زر restore في Settings في production."],
              ["BOOTSTRAP_ADMIN_PASSWORD", "StrongPass#123", "كلمة مرور أول أدمن أو recovery admin."],
              ["BOOTSTRAP_ADMIN_ALLOW_EXISTING", "false", "اسمح بتحديث أدمن موجود عند recovery فقط."],
            ].map(([k, v, d]) => `
              <tr><td class="goal">${esc(k)}</td><td><code>${esc(v)}</code></td><td>${esc(d)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </section>

      <section class="principles">
        <h2>Checklist قبل Production Deploy</h2>
        <div class="callout">
          <b>نفذ بالترتيب:</b>
          <br />1. تأكد من env secrets قوية وغير placeholder.
          <br />2. شغل migrations.
          <br />3. شغل bootstrap admin لو الداتا فاضية.
          <br />4. تأكد أن worker يعمل وأن Redis healthy.
          <br />5. أنشئ backup يدوي قبل أي تغيير كبير.
          <br />6. شغل verify أو على الأقل lint/build/backend:test.
          <br />7. اختبر login + MFA + dashboard + backup status.
        </div>
        <p class="footer-note">Generated from the current Goalix workspace scripts and operational runbooks.</p>
      </section>
    </section>
  </main>
</body>
</html>`;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();

  console.log(`HTML: ${htmlPath}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Preview: ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
