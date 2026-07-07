# تقرير مراجعة شاملة لمشروع GOLX Backend
## Full Architecture & Security Audit Report

---

**المشروع:** GOLX Sports Academy Platform — Backend API  
**تاريخ التقرير:** مارس 2026  
**نطاق المراجعة:** الكود المصدري الكامل لـ `golx-backend/`  
**حالة التقرير:** للاطلاع فقط — لم يُجرَ أي تعديل على الكود  

---

## فهرس المحتويات

1. نظرة عامة على المشروع
2. البنية المعمارية التفصيلية
3. قاعدة البيانات والمهاجرات
4. البنية التحتية (Infrastructure)
5. الموديولات وواجهات API
6. Workers وصفوف المهام الخلفية
7. الأمان — ما تم بناؤه بشكل صحيح
8. نقاط الضعف والمخاطر (مفصلة)
9. التوصيات مرتبةً حسب الأولوية
10. قائمة تحقق للتسليم

---

## 1. نظرة عامة على المشروع

| الجانب | التفاصيل |
|---|---|
| **الهدف** | API خلفي لإدارة أكاديمية رياضية (لاعبون، مدربون، حضور، مدفوعات، ترتيبات، AI) |
| **اللغة والبيئة** | Node.js >=20، Express.js v4 |
| **قاعدة البيانات** | PostgreSQL 16 عبر Knex ORM |
| **التخزين الوسيط** | Redis 7 |
| **نظام المهام الخلفية** | BullMQ |
| **التوثق والتسجيل** | Pino + pino-pretty |
| **التحقق من المدخلات** | Zod |
| **نقطة الدخول الرئيسية** | `src/server.js` → `src/app.js` |
| **الحاويات** | Docker + Docker Compose |
| **إصدار Node المطلوب** | >= 20.0.0 |

---

## 2. البنية المعمارية التفصيلية

### 2.1 نمط التصميم العام

يعتمد المشروع نمط **Layered Architecture** (طبقات متفصلة) مع **Dependency Injection يدوي**:

```
HTTP Request
    │
    ▼
[Middleware Stack]            ← Helmet, CORS, hpp, compression, cookieParser
    │
    ▼
[Rate Limiter]                ← apiLimiter / authLimiter
    │
    ▼
[Validation Middleware]       ← Zod schema validation
    │
    ▼
[Auth Middleware]             ← JWT verification
    │
    ▼
[RBAC Middleware]             ← Role/Permission check
    │
    ▼
[Controller]                  ← HTTP layer only, calls Service
    │
    ▼
[Service]                     ← Business logic
    │
    ▼
[Repository]                  ← Database queries via Knex
    │
    ▼
[PostgreSQL / Redis]
```

### 2.2 ملف الدخول: `src/server.js`

- يربط Redis أولاً
- يشغّل BullMQ Workers
- يرفع HTTP server على المنفذ المعرّف
- يدير إغلاق سلس (Graceful Shutdown) عبر SIGTERM/SIGINT
- في حالة الفشل يخرج بكود `process.exit(1)` بعد 10 ثوانٍ قسراً

### 2.3 ملف التطبيق: `src/app.js`

- يحمّل جميع 9 موديولات عبر Dependency Injection يدوي (تمرير `db`, `redis`, `queue` صراحة)
- ترتيب تسجيل Middleware العالمي:
  1. `helmet()` — رؤوس أمان HTTP
  2. `cors()` — قائمة origins من `env.CORS_ORIGINS`
  3. `compression()` — ضغط الاستجابات
  4. `hpp()` — منع Parameter Pollution
  5. `cookieParser()` — تفسير الكوكيز
  6. `express.json({ limit: '2mb' })` — قراءة body JSON
  7. `express.urlencoded()` — قراءة form data
  8. Rate limiters على `/api/` و endpoints المصادقة
- نقطة فحص الصحة: `GET /health` — مفتوحة بدون مصادقة
- معالج 404 عام
- معالج أخطاء عالمي في النهاية

### 2.4 هيكل المجلدات

```
golx-backend/
├── src/
│   ├── app.js                  ← تهيئة Express والـ DI
│   ├── server.js               ← نقطة الدخول
│   ├── config/
│   │   └── env.js              ← التحقق من متغيرات البيئة
│   ├── events/
│   │   └── eventBus.js         ← EventEmitter singleton
│   ├── infrastructure/
│   │   ├── database.js         ← Knex + PostgreSQL
│   │   ├── redis.js            ← ioredis client
│   │   ├── queue.js            ← BullMQ queues
│   │   └── storage.js          ← S3/R2 placeholder (غير مكتمل)
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   ├── validate.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── academy/
│   │   ├── players/
│   │   ├── coaches/
│   │   ├── attendance/
│   │   ├── rankings/
│   │   ├── payments/
│   │   ├── notifications/
│   │   └── ai/
│   ├── shared/
│   │   ├── api-response.js
│   │   ├── base.repository.js
│   │   ├── base.service.js
│   │   ├── logger.js
│   │   ├── pagination.js
│   │   └── errors/
│   │       ├── AppError.js
│   │       ├── ValidationError.js
│   │       ├── UnauthorizedError.js
│   │       ├── ForbiddenError.js
│   │       ├── NotFoundError.js
│   │       └── ConflictError.js
│   └── workers/
│       ├── index.js
│       ├── ranking.worker.js
│       ├── notification.worker.js
│       ├── payment.worker.js
│       └── ai.worker.js
├── migrations/                 ← 11 ملف مهاجرة مرقّم
├── Dockerfile
├── docker-compose.yml
├── knexfile.js
└── package.json
```

---

## 3. قاعدة البيانات والمهاجرات

يتكون نموذج البيانات من **11 ملف مهاجرة مرقمة** تُنشئ جداول المشروع بالتسلسل:

### 3.1 قائمة الجداول الكاملة

| رقم المهاجرة | الجداول المُنشأة | الغرض |
|---|---|---|
| 001_extensions | (extensions + trigger) | تفعيل `pgcrypto`، `uuid-ossp`، ودالة `trigger_set_updated_at()` |
| 002_academy_tables | `academy_academies`, `academy_branches`, `academy_birth_years`, `academy_groups`, `academy_schedules` | هيكل الأكاديمية: الفروع، سنوات الميلاد، المجموعات، الجداول |
| 003_auth_tables | `auth_users`, `auth_refresh_tokens`, `auth_password_resets` | المستخدمون، توكنات التحديث، رموز استعادة كلمة المرور |
| 004_players_tables | `player_profiles`, `player_group_assignments`, `player_measurements`, `player_injury_history` | ملفات اللاعبين، قياساتهم، إصاباتهم |
| 005_coaches_tables | `coach_profiles` (وما يتبع) | ملفات المدربين |
| 006_attendance_tables | `attendance_sessions`, `attendance_marks` | جلسات التدريب وتسجيل الحضور |
| 007_rankings_tables | `evaluation_coach_ratings`, `evaluation_discipline_scores`, `match_records`, `match_player_stats`, `ranking_snapshots`, `ranking_score_breakdown` | التقييمات، المباريات، لقطات الترتيب |
| 008_payments_tables | `payment_subscriptions`, `payment_invoices`, `payment_transactions` | الاشتراكات، الفواتير، المعاملات المالية |
| 009_notifications_tables | `notification_inbox`, `notification_device_tokens` | صندوق الإشعارات، توكنات الأجهزة (iOS/Android/Web) |
| 010_ai_tables | `ai_analyses`, `ai_recommendations`, `nutrition_plans` | تحليلات الذكاء الاصطناعي، التوصيات، خطط التغذية |
| 011_shared_tables | `audit_logs`, `media_files` | سجل تدقيق الأحداث، ملفات الوسائط |

**المجموع الكلي:** ~27 جدول

### 3.2 ملاحظات هيكل قاعدة البيانات

- **UUID للمفاتيح الرئيسية** في كل الجداول (باستثناء `audit_logs` التي تستخدم `bigIncrements`)
- **Soft Delete**: حقل `deleted_at` في الجداول الرئيسية (academies, branches, groups, players, coaches, users)
- **Foreign Keys** بقيود `onDelete: CASCADE` أو `SET NULL` حسب السياق
- **Indexes** على الحقول المستخدمة كثيراً (academy_id, user_id, player_id, status, created_at)
- **Unique Constraints** على: بريد المستخدم، هاتفه، رمز التوكن، (session_id+player_id)، (group_id+session_date)، إلخ
- **Trigger `set_updated_at`** على 20 جدول لتحديث `updated_at` تلقائياً
- **Native Enums** في PostgreSQL لكل الحقول ذات القيم المحدودة (role, status, plan, ...)
- **نوع `point`** على `academy_branches.location` لتخزين الموقع الجغرافي

### 3.3 إعدادات الاتصال (knexfile.js)

| البيئة | SSL | حجم Connection Pool |
|---|---|---|
| development | مُعطَّل | min:2, max:10 |
| test | مُعطَّل | min:1, max:5 |
| production | مُفعَّل + `rejectUnauthorized: true` | min:2, max:10, acquireTimeout:10s |

---

## 4. البنية التحتية (Infrastructure)

### 4.1 قاعدة البيانات (`src/infrastructure/database.js`)

- اتصال عبر Knex + `pg`
- SSL مشروط: مفعّل في الإنتاج فقط
- Connection Pool: min:2, max:10
- اختبار اتصال عند الإقلاع عبر `SELECT 1`؛ فشله يُنهي العملية

### 4.2 Redis (`src/infrastructure/redis.js`)

- مكتبة `ioredis` — `lazyConnect: true`
- إعادة المحاولة: الحد الأقصى 10 مرات، زيادة تدريجية حتى 2000ms
- يُستخدم لـ: تخزين hash الـ refresh tokens مؤقتاً، ودعم BullMQ
- عدم الاتصال ينهي العملية

### 4.3 نظام المهام (BullMQ — `src/infrastructure/queue.js`)

تم إنشاء 4 قوائم مهام:

| اسم القائمة | المنفذ (Worker) | التزامن | المهام |
|---|---|---|---|
| `golx-rankings` | `ranking.worker.js` | 2 | إعادة حساب الترتيبات أسبوعياً/شهرياً |
| `golx-notifications` | `notification.worker.js` | 5 | إرسال إشعار فردي أو جماعي |
| `golx-payments` | `payment.worker.js` | 3 | إنشاء فاتورة، فحص اشتراكات منتهية، معالجة استرداد |
| `golx-ai` | `ai.worker.js` | 2 | حساب أداء، تقييم خطر إصابة، خطة تغذية، AI chat |

**الإعدادات الافتراضية للمهام:**
- المحاولات: 3 مع Exponential backoff (2000ms)
- الاحتفاظ بالمكتملة: آخر 1000
- الاحتفاظ بالفاشلة: آخر 5000

### 4.4 التخزين السحابي (`src/infrastructure/storage.js`)

**الحالة الحالية:** Placeholder كامل — كل العمليات (upload, getSignedUrl, remove) تُسجّل تحذيراً وتعيد `null`.  
**الأثر:** أي ميزة رفع ملفات غير مدعومة حالياً.

### 4.5 نظام الأحداث (`src/events/eventBus.js`)

- `EventEmitter` مُغلَّف بـ Singleton
- حد أقصى 50 مستمعاً
- `publish(event, payload)`: يُصدر الحدث ويُسجّله كـ `debug`
- `subscribe(event, handler)`: يلتقط الأخطاء ويُسجّلها دون رمي exception
- مصمّم للاستبدال بـ Kafka/RabbitMQ مستقبلاً دون تغيير الكود

### 4.6 نظام التسجيل (`src/shared/logger.js`)

- مكتبة `pino` (أسرع logger في Node.js)
- **Development:** `debug` level + pino-pretty ملوّن
- **Production:** `info` level بدون pretty
- **الحساسية:** `redact` يحجب `req.headers.authorization` و`req.headers.cookie` من السجلات تلقائياً
- تسجيل context عام: `{ service: 'golx-api' }`

---

## 5. الموديولات وواجهات API

### 5.1 موديول Auth (`/api/v1/auth`)

أكثر الموديولات تعقيداً وحساسيةً.

**Endpoints:**

| الطريقة | المسار | Auth | Rate Limit | الوصف |
|---|---|---|---|---|
| POST | `/register` | لا | authLimiter (10/15min) | تسجيل مستخدم جديد |
| POST | `/login` | لا | authLimiter | تسجيل دخول |
| POST | `/logout` | نعم | لا | تسجيل الخروج |
| POST | `/refresh` | لا | authLimiter | تجديد access token |
| POST | `/forgot-password` | لا | authLimiter | طلب إعادة تعيين كلمة المرور |
| POST | `/reset-password` | لا | authLimiter | تعيين كلمة مرور جديدة |
| GET | `/me` | نعم | لا | بيانات المستخدم الحالي |

**التحقق من المدخلات (Zod Schemas):**
- `registerSchema`: بريد أو هاتف (أحدهما مطلوب)، كلمة مرور 8-128 حرفاً، دور من قائمة محددة
- `loginSchema`: بريد أو هاتف، كلمة مرور
- `forgotPasswordSchema`: بريد إلكتروني فقط
- `resetPasswordSchema`: رمز + كلمة مرور جديدة 8-128 حرفاً

**تدفق المصادقة:**
```
التسجيل/الدخول → bcrypt.compare → JWT access (15m) + JWT refresh (7d)
                → تخزين hash الـ refresh token في DB
                → تخزين hash مؤقت في Redis (7d)
                → access token في body
                → refresh token في httpOnly cookie (path: /api/v1/auth)
```

**تجديد التوكن (Token Rotation):**
```
POST /refresh → التحقق من الـ cookie
             → jwt.verify بمفتاح REFRESH_SECRET
             → بحث عن hash في DB
             → إلغاء التوكن القديم
             → إصدار accessToken جديد + refreshToken جديد
```

**استعادة كلمة المرور:**
```
POST /forgot-password → البحث عن المستخدم بالبريد
                     → إن وُجد: إنشاء token عشوائي (32 byte hex)
                     → تخزين hash SHA-256 في DB مع صلاحية 1 ساعة
                     → نشر حدث PASSWORD_RESET_REQ عبر eventBus
                     → الاستجابة دائماً نفس الرسالة (منع التعداد)
```

**Repository الخاص بـ Auth:**
- استعلامات Knex ORM مباشرة — parameterized تلقائياً
- `findByEmailOrPhone` مع شرط `whereNull('deleted_at')`
- دوال مخصصة لـ: refresh tokens, password resets, audit logs

### 5.2 موديول Academy (`/api/v1/academy`)

**ما يدير:**
- الأكاديميات (Academy)
- الفروع (Branches) مع نقاط جغرافية
- سنوات الميلاد (Birth Years)
- المجموعات (Groups) مرتبطة بسنوات ميلاد

**نمط التحكم في الوصول:** كل الـ endpoints تتطلب `authMiddleware`؛ عمليات التعديل/الحذف تتطلب `rbac('*')` (admin فقط)

### 5.3 موديول Players (`/api/v1/players`)

**ما يدير:**
- ملفات اللاعبين (إنشاء، قراءة، تعديل، حذف ناعم)
- ملخص شامل للاعب (`/summary`)
- القياسات الجسدية (وزن، طول)
- سجل الإصابات

**أذونات:**
- `players:read` — للاطلاع
- `measurements:read/write` — للقياسات
- `rbac('*')` — للإنشاء والتعديل والحذف

### 5.4 موديول Coaches (`/api/v1/coaches`)

- ملفات المدربين وعملياتها الأساسية (CRUD)

### 5.5 موديول Attendance (`/api/v1/attendance`)

**ما يدير:**
- جلسات التدريب: إنشاء، قراءة، تحديث الحالة (scheduled → active → completed/cancelled)
- تسجيل الحضور (Batch) لجلسة كاملة
- تقرير الحضور العام

**أذونات:** `sessions:read/write`، `attendance:read/write`

### 5.6 موديول Rankings (`/api/v1/rankings`)

**ما يدير:**
- الترتيبات الأسبوعية والشهرية
- تقييمات المدربين (`evaluations`)
- المباريات وإحصاءات اللاعبين فيها
- إعادة حساب الترتيب يدوياً

**خوارزمية الترتيب المخططة (في ranking.worker):**
```
الدرجة الكلية =
  تقييم المدرب    × 35%
+ نسبة الحضور    × 20%
+ الانضباط       × 15%
+ إحصاءات المباريات × 20%
+ درجة الذكاء الاصطناعي × 10%
```
*(الخوارزمية موثقة في الـ worker لكنها TODO حتى الآن)*

### 5.7 موديول Payments (`/api/v1/payments`)

**ما يدير:**
- خطط الدفع (Plans)
- الاشتراكات (Subscriptions): شهري/ربع سنوي/سنوي
- الفواتير (Invoices)
- المعاملات (Transactions) مع مرجع بوابة الدفع
- تقارير المدفوعات

**ملاحظة:** لا يوجد تكامل فعلي مع بوابة دفع بعد — workers تحتوي TODO

### 5.8 موديول Notifications (`/api/v1/notifications`)

**ما يدير:**
- عرض الإشعارات وعدد غير المقروء
- إرسال إشعار فردي أو جماعي (حسب الأكاديمية والدور)
- تحديد الإشعار كمقروء (فردياً أو جماعياً)
- سجل الإشعارات المُرسَلة
- توكنات الأجهزة (iOS, Android, Web) في جدول `notification_device_tokens`

**ملاحظة:** التكامل مع Push/Email/SMS موجود كـ TODO في الـ worker

### 5.9 موديول AI (`/api/v1/ai`)

**ما يدير:**
- درجات الأداء (Performance Scores)
- تقييم خطر الإصابة (Injury Risk Estimation)
- خطط التغذية المخصصة (Nutrition Plans)
- AI Chat (محادثة مع نموذج AI)

**ملاحظة:** كل AI workers موجودة كـ TODO (Structure جاهز، دمج النموذج الحقيقي لم يُنجز)

---

## 6. Workers وصفوف المهام الخلفية

### 6.1 بنية تشغيل الـ Workers

- تبدأ جميع الـ Workers في `server.js` بعد الاتصال بـ Redis
- يمكن تشغيلها بشكل مستقل عبر `npm run worker`
- إغلاق سليم عبر `stopWorkers()` الذي يستدعي `worker.close()` لكل worker

### 6.2 جدول الـ Workers التفصيلي

| Worker | اسم القائمة | المهام | حالة التنفيذ | التزامن |
|---|---|---|---|---|
| ranking.worker | `rankings` | `recalculate-rankings` | TODO — هيكل جاهز فقط | 2 |
| notification.worker | `notifications` | `deliver-notification`, `bulk-notification` | TODO — لا يوجد تكامل مع مزود | 5 |
| payment.worker | `payments` | `generate-invoice`, `check-expiring-subscriptions`, `process-refund` | TODO — لا يوجد تكامل مع بوابة دفع | 3 |
| ai.worker | `ai` | `calculate-performance`, `assess-injury-risk`, `generate-nutrition-plan`, `ai-chat` | TODO — لا يوجد تكامل مع نموذج AI | 2 |

**تنبيه هام:** جميع الـ Workers هي هيكل جاهز فقط (Scaffolding) — لا يوجد منطق فعلي مُنفَّذ، كل المهام تُسجَّل ثم تنتهي دون فعل حقيقي.

---

## 7. الأمان — ما تم بناؤه بشكل صحيح

### 7.1 إدارة المتغيرات البيئية الحساسة

**الملف:** `src/config/env.js` — يستخدم Zod للتحقق من البيئة عند الإقلاع

| المتغير | القيد | السبب |
|---|---|---|
| `JWT_SECRET` | ≥ 32 حرفاً | لضمان entropy كافٍ |
| `JWT_REFRESH_SECRET` | ≥ 32 حرفاً | مفتاح منفصل مختلف عن access |
| `BCRYPT_ROUNDS` | 10-15 | منع rounds منخفضة جداً أو بطيئة جداً |
| `JWT_ACCESS_EXPIRY` | افتراضي: 15m | نافذة تعرض قصيرة |
| `JWT_REFRESH_EXPIRY` | افتراضي: 7d | فقط لتجديد التوكن |

إذا فشل التحقق تتوقف العملية فوراً مع رسالة واضحة.

### 7.2 تجزئة كلمات المرور

- مكتبة `bcrypt` المعتمدة صناعياً
- rounds من env (10-15)، لا يوجد hardcoded value
- استخدام `bcrypt.compare` للمقارنة دون إمكانية استعادة كلمة المرور

### 7.3 نمط JWT الآمن

- **مفتاحان منفصلان:** `JWT_SECRET` للـ access و`JWT_REFRESH_SECRET` للـ refresh
- **فترات صلاحية مناسبة:** access 15 دقيقة، refresh 7 أيام
- **لا يُخزَّن التوكن كاملاً في DB** — فقط hash SHA-256
- **Token Rotation:** عند كل تحديث يُلغى القديم ويُصدر جديد
- **إلغاء شامل:** عند تغيير كلمة المرور تُلغى جميع refresh tokens للمستخدم

### 7.4 أمان الكوكيز

```javascript
res.cookie('refreshToken', token, {
    httpOnly: true,        // لا يمكن لـ JavaScript قراءتها
    secure: process.env.NODE_ENV === 'production',  // HTTPS فقط
    sameSite: 'strict',    // منع إرسالها في طلبات cross-site
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',  // محدودة بمسار auth فقط
});
```

### 7.5 Rate Limiting

| المحدِّد | الحد | النافذة | المُطبَّق على |
|---|---|---|---|
| `apiLimiter` | 100 طلب | 15 دقيقة | كل `/api/` |
| `authLimiter` | 10 طلبات | 15 دقيقة | `/register`, `/login`, `/refresh`, `/forgot-password`, `/reset-password` |

### 7.6 التحقق من المدخلات

- `validate.middleware.js` يقبل Zod schemas لـ `body`, `query`, `params`
- عند فشل التحقق تُعاد بيانات مفيدة: اسم الحقل، الرسالة، المصدر
- الـ `req.body/query/params` تُستبدَل ببيانات مُنقَّحة من Zod

### 7.7 RBAC (نظام الأدوار والأذونات)

أربعة أدوار مع أذونات محددة:

| الدور | الأذونات |
|---|---|
| `admin` | `['*']` — كل شيء |
| `coach` | قراءة اللاعبين، إدارة الحضور والتقييمات والقياسات والجداول والمباريات |
| `player` | قراءة ملفه الشخصي، تقدمه، الحضور، الترتيبات، القياسات، التغذية |
| `parent` | قراءة بيانات طفله، المدفوعات، الإشعارات، الحضور، الجداول |

### 7.8 معالجة الأخطاء المركزية

`errorHandler.middleware.js` يعالج:
- `AppError` وأصنافها الفرعية بمعلومات هيكلية
- أخطاء DB (23505 = تكرار، 23503 = foreign key)
- أخطاء JWT
- **في الإنتاج:** رسالة خطأ عامة `'Internal server error'` بدلاً من رسالة الاستثناء الأصلية

### 7.9 رؤوس الأمان (Helmet)

`helmet()` يضيف تلقائياً:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- وغيرها

### 7.10 حماية إضافية

- `hpp()` (HTTP Parameter Pollution protection) — يمنع تمرير معاملات مكرة
- `cors()` بقائمة origins صريحة من env
- `compression()` لا يؤثر على الأمان لكن يحسّن الأداء
- `redact` في logger يخفي Authorization header وcookies من السجلات

### 7.11 Soft Delete

`BaseRepository.baseQuery()` يُضيف `whereNull('deleted_at')` تلقائياً لكل query عبر الجداول التي تملك هذا العمود — يمنع ظهور بيانات محذوفة.

### 7.12 Audit Log

جدول `audit_logs` موجود ويُستخدَم في `AuthRepository.createAuditLog()` لتسجيل عمليات login مع IP والمستخدم.

---

## 8. نقاط الضعف والمخاطر (مفصلة)

### 🔴 عالية الخطورة

---

#### ⚠️ 8.1 أسرار ثابتة (Hardcoded Credentials) في `docker-compose.yml`

**الموقع:** `docker-compose.yml` → السطر 10

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

**المشكلة:** كلمة مرور Postgres ثابتة في ملف يُحتمل نشره في Git repository.

**الخطر:**
- إذا كان الريبو عاماً أو الملف مشاركاً = بيانات اعتماد DB مكشوفة
- The API database URL now uses the `POSTGRES_PASSWORD` environment variable instead of a committed password.

**التوصية:** استخدام Docker Secrets أو متغيرات بيئة خارج الريبو، وإضافة `docker-compose.yml` إلى `.gitignore` أو استخدام `docker-compose.override.yml`

---

#### ⚠️ 8.2 المنافذ الداخلية مكشوفة على المضيف

**الموقع:** `docker-compose.yml`

```yaml
postgres:
    ports:
      - "5432:5432"   # مكشوف للعالم
redis:
    ports:
      - "6379:6379"   # مكشوف للعالم
```

**الخطر:**
- أي شخص يعرف IP السيرفر يستطيع الوصول المباشر لـ Postgres وRedis
- Redis بدون كلمة مرور (لا يوجد `requirepass` في إعداد الـ redis service)
- PostgreSQL should use a non-committed password from environment configuration.

**التوصية:**
- حذف `ports` من postgres وredis في الإنتاج
- إضافة `requirepass` لـ Redis
- استخدام Docker networks الداخلية فقط

---

#### ⚠️ 8.3 Redis بدون مصادقة

**الموقع:** `docker-compose.yml` → redis service + `src/infrastructure/queue.js`

**المشكلة:** لا توجد كلمة مرور على Redis، وفي `queue.js` يُبنى الاتصال مباشرة بـ hostname/port فقط:

```javascript
const redisConnection = {
    host: new URL(env.REDIS_URL).hostname,
    port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};
```

**الخطر:**
- إذا كان البورت 6379 مكشوفاً = أي شخص يقدر يقرأ/يكتب في Redis
- البيانات المخزنة: hashes لتوكنات المصادقة + بيانات الـ queues

---

### 🟠 متوسطة الخطورة

---

#### ⚠️ 8.4 غياب حماية CSRF للـ Refresh Token

**الموقع:** `src/modules/auth/auth.controller.js` → `_setRefreshCookie`

**المشكلة:** الـ refresh token محفوظ في cookie. رغم `sameSite: 'strict'`، هذا لا يكفي في سيناريوهات:
- تطبيقات تعمل على نطاقات مختلفة (mobile app + web)
- إذا احتجت تغيير `sameSite` مستقبلاً

**الخطر:**
- هجوم CSRF قد يستغل الـ cookie لإصدار access token جديد

**التوصية:** إضافة CSRF token للـ stateful endpoints، أو اعتماد نمط Double Submit Cookie، أو تغيير إرسال الـ refresh token لـ Authorization header مع تحقق إضافي.

---

#### ⚠️ 8.5 لا يوجد إبطال فوري لـ Access Tokens

**الموقع:** `src/middleware/auth.middleware.js`

**المشكلة:** `auth.middleware.js` يتحقق من التوقيع والصلاحية فقط — لا يستعلم من DB أو Redis.

**الخطر:**
- إذا سُرق access token، يظل فعالاً حتى انتهاء صلاحيته (15 دقيقة)
- تسجيل الخروج لا يُبطل access tokens — فقط refresh tokens
- إذا اكتُشف اختراق، لا توجد طريقة لإبطال access token للمستخدم فوراً

**التوصية:** إضافة `jti` (JWT ID) في الـ payload، وتخزينه في Redis مع الصلاحية، والتحقق منه في `auth.middleware.js`.

---

#### ⚠️ 8.6 نشر Reset Token الخام عبر EventBus

**الموقع:** `src/modules/auth/auth.service.js`

```javascript
eventBus.publish(AUTH_EVENTS.PASSWORD_RESET_REQ, {
    userId: user.id,
    email: user.email,
    resetToken,   // ← التوكن الخام (hex string) موجود هنا
});
```

**المشكلة:** `eventBus.publish()` يُسجّل الـ payload كاملاً كـ `debug` في الـ logger:

```javascript
// في eventBus.js:
logger.debug({ event, payload }, `Event published: ${event}`);
```

**الخطر:**
- إذا كان log level = `debug` في بيئة يطّلع عليها أشخاص، الـ resetToken موجود في السجلات
- أي مستمع على الـ eventBus يتلقى التوكن الخام كاملاً

**التوصية:** أرسل فقط `userId` في الـ event، واسمح للـ notification worker بإنشاء رابط الاستعادة من DB باستخدام `userId`.

---

#### ⚠️ 8.7 غياب تحقق من ملكية الموارد (Authorization Bypass Risk)

**الموقع:** عدة موديولات (players, coaches, academy)

**المشكلة:** RBAC تتحقق فقط من الدور، لكن لا يوجد تحقق صريح من أن المستخدم ينتمي لنفس الأكاديمية التي يُحاول الوصول لبياناتها.

**مثال:**
- مدرب في أكاديمية A قد يُرسل طلب `GET /api/v1/players/:id` لاعب من أكاديمية B
- إذا كان الـ service لا يُصفّي على `academy_id` = `req.user.academyId`، تُعاد البيانات

**الخطر:** تسرب بيانات بين أكاديميات مختلفة (Insecure Direct Object Reference — IDOR)

**التوصية:** كل service يجب أن يُقيّد الاستعلام بـ `academy_id` مأخوذاً من `req.user.academyId`.

---

### 🟡 منخفضة/متوسطة الخطورة

---

#### ⚠️ 8.8 Workers جميعها TODO — لم تُنفَّذ

**الموقع:** `src/workers/*.worker.js`

**المشكلة:** الـ 4 workers (rankings, notifications, payments, ai) لا تؤدي أي عمل فعلي. المهام تُسجَّل وتنتهي.

**الخطر:**
- المدفوعات لا تُعالج — الفواتير لا تُنشأ، الاشتراكات لا تنتهي
- الإشعارات لا تُرسَل رغم وجودها في الـ queue
- الذكاء الاصطناعي والترتيبات لا تعمل

**التوصية:** يجب تحديد الـ workers الحرجة (خاصة payments وnotifications) وإنجازها قبل الإنتاج.

---

#### ⚠️ 8.9 Dockerfile بدون مرحلة Multi-stage

**الموقع:** `Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**المشكلة:**
- `COPY . .` ينسخ كل شيء بما في ذلك ملفات التطوير، `.env` لو موجود، والـ migrations
- لا يوجد `.dockerignore` — محتمل نسخ `node_modules` المحلية إن وُجدت
- لا يوجد مستخدم non-root — التطبيق يعمل كـ `root` داخل الحاوية

**التوصية:**
- إضافة `.dockerignore` يستثني: `.env`, `*.log`, `node_modules`, `.git`
- إضافة `RUN addgroup -S app && adduser -S app -G app` ثم `USER app`

---

#### ⚠️ 8.10 Rate Limiting يعتمد على IP فقط

**الموقع:** `src/middleware/rateLimit.middleware.js`

**المشكلة:** `express-rate-limit` بالإعداد الافتراضي يستخدم IP العميل. وراء Reverse Proxy (Nginx/Load Balancer)، قد يعتمد على `req.ip` التي تكون IP الـ proxy.

**الخطر:**
- جميع المستخدمين خلف نفس الـ proxy يشتركون في نفس الحد
- مهاجم خارج الـ proxy قد لا يخضع للحد الصحيح

**التوصية:** ضبط `app.set('trust proxy', 1)` في Express إذا كان هناك Reverse Proxy.

---

#### ⚠️ 8.11 غياب Helmet CSP مُخصَّص

**الموقع:** `src/app.js`

```javascript
app.use(helmet());   // إعدادات افتراضية فقط
```

**المشكلة:** `helmet()` بالإعدادات الافتراضية يُطبّق سياسة CSP عامة. لا توجد سياسة CSP مُخصَّصة ومحكمة.

**التوصية:** تكوين CSP صريح يحدد المصادر المسموحة.

---

#### ⚠️ 8.12 عدم وجود اختبارات آلية

**الموقع:** `package.json` → `"test": "jest --runInBand"`

**المشكلة:** Jest وsupertest موجودان كـ devDependencies لكن لا يوجد دليل `/tests` أو ملفات `*.test.js` مرئية.

**الخطر:**
- لا يوجد اختبار للـ auth flows، token rotation، وsecurity scenarios
- أي تعديل مستقبلي قد يكسر سلامة الأمان دون اكتشاف

**التوصية:** كتابة اختبارات تكامل لـ auth flows الحرجة كحد أدنى.

---

#### ⚠️ 8.13 `is_verified` في البيانات لكن لا يوجد آلية تحقق

**الموقع:** `src/modules/auth/auth.service.js` → `_sanitizeUser()`

```javascript
isVerified: user.is_verified,
```

**المشكلة:** حقل `is_verified` موجود في البيانات المُعادة لكن لا يوجد في `auth_users` migration ولا توجد آلية إرسال رسالة تحقق أو التحقق من الحقل قبل السماح بالدخول.

**الخطر:** إمكانية تسجيل مستخدمين بأي بريد/هاتف دون تحقق من ملكيتهم له.

---

#### ⚠️ 8.14 Pagination بدون حماية كافية

**الموقع:** `src/shared/pagination.js`

```javascript
if (limit > env.MAX_PAGE_LIMIT) limit = env.MAX_PAGE_LIMIT;
```

**الملاحظة:** الحد الأقصى الافتراضي `MAX_PAGE_LIMIT = 100` — مقبول لكن يجب مراقبة الاستعلامات القوية.

---

#### ⚠️ 8.15 `healthcheck` endpoint مكشوف بلا مصادقة

**الموقع:** `src/app.js`

```javascript
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**الملاحظة:** لا يكشف بيانات حساسة (فقط status + timestamp). مقبول كـ liveness probe لكن يجب التأكد من أنه لا يكشف معلومات DB أو Redis.

---

## 9. التوصيات مرتبةً حسب الأولوية

### الأولوية الأولى — عاجل (قبل الإنتاج / فورياً)

| # | الإجراء | الملف المعني |
|---|---|---|
| 1 | حذف كلمة المرور الثابتة من `docker-compose.yml` وإدارة الأسرار خارج الريبو | `docker-compose.yml` |
| 2 | إزالة `ports` لـ postgres وredis أو تقييدها لـ 127.0.0.1 | `docker-compose.yml` |
| 3 | إضافة كلمة مرور لـ Redis (`requirepass`) | `docker-compose.yml` + `src/infrastructure/redis.js` |
| 4 | إضافة `.dockerignore` يستثني `.env`, `*.log`, `.git` | إنشاء ملف جديد |
| 5 | تشغيل التطبيق بمستخدم non-root في Dockerfile | `Dockerfile` |
| 6 | التحقق من أن `CORS_ORIGINS` في الإنتاج محدد بـ domain حقيقي | `src/config/env.js` |

### الأولوية الثانية — مهم جداً (أسبوعان)

| # | الإجراء |
|---|---|
| 7 | إزالة `resetToken` من payload eventBus وإرسال `userId` فقط |
| 8 | إضافة تحقق من ملكية الموارد (academy_id) في كل service |
| 9 | تنفيذ إبطال فوري للـ access tokens عبر JTI + Redis blacklist |
| 10 | تنفيذ آلية تحقق من البريد/الهاتف (`is_verified`) |
| 11 | إضافة `trust proxy` إعداد إذا كان هناك Nginx/Load Balancer |

### الأولوية الثالثة — تحسينات مهمة (شهر)

| # | الإجراء |
|---|---|
| 12 | كتابة اختبارات Jest لـ auth flows (register, login, refresh, reset) |
| 13 | تنفيذ الـ workers الحرجة (notifications → payments → rankings → ai) |
| 14 | تكوين Helmet CSP مُخصَّص |
| 15 | تنفيذ التخزين السحابي (storage.js) بصلاحيات محدودة |
| 16 | وضع خطة دورية لتدوير JWT secrets |
| 17 | إضافة `npm audit` في CI/CD pipeline |

---

## 10. قائمة تحقق للتسليم (Checklist)

### أمان البنية التحتية

- [ ] لا توجد كلمات مرور ثابتة في `docker-compose.yml`
- [ ] منافذ Postgres/Redis غير مكشوفة للإنترنت العام
- [ ] Redis محمي بكلمة مرور
- [ ] `.dockerignore` تستثني `.env` وملفات حساسة
- [ ] التطبيق يعمل بمستخدم non-root في Docker

### أمان المصادقة

- [ ] `JWT_SECRET` و`JWT_REFRESH_SECRET` أطول من 32 حرفاً ومعقدان
- [ ] `BCRYPT_ROUNDS` لا تقل عن 12 في الإنتاج
- [ ] Refresh token يُلغى عند تغيير كلمة المرور
- [ ] `resetToken` الخام لا يظهر في log
- [ ] آلية تحقق من البريد/الهاتف مُنفَّذة

### أمان التحكم في الوصول

- [ ] كل service يُقيّد الاستعلام بـ `academy_id` = `req.user.academyId`
- [ ] جميع endpoints الحرجة محمية بـ `authMiddleware` + `rbac`
- [ ] لا يوجد endpoint يترك دون rate limiting مناسب

### أمان الشبكة والـ Transport

- [ ] TLS/HTTPS مُفعَّل أمام التطبيق
- [ ] `secure: true` للكوكيز يعمل فعلياً في الإنتاج
- [ ] `CORS_ORIGINS` محدد بـ domains حقيقية فقط

### الجودة والاستمرارية

- [ ] Workers حرجة مُنفَّذة قبل الإطلاق (notifications, payments)
- [ ] اختبارات لـ auth flows موجودة
- [ ] CI/CD pipeline يشمل `npm audit`
- [ ] Audit logs تُسجَّل لعمليات الكتابة الحساسة

---

## ملحق — تقرير الحزم والتبعيات

| الحزمة | الإصدار في package.json | الغرض | ملاحظة |
|---|---|---|---|
| `express` | ^4.21.0 | HTTP framework | — |
| `knex` | ^3.1.0 | Query builder + migrations | — |
| `pg` | ^8.13.0 | PostgreSQL driver | — |
| `ioredis` | ^5.4.1 | Redis client | — |
| `bullmq` | ^5.15.0 | Job queues | — |
| `zod` | ^3.23.8 | Schema validation | — |
| `jsonwebtoken` | ^9.0.2 | JWT generation/verification | — |
| `bcrypt` | ^5.1.1 | Password hashing | — |
| `helmet` | ^8.0.0 | HTTP security headers | — |
| `cors` | ^2.8.5 | CORS middleware | — |
| `express-rate-limit` | ^7.4.1 | Rate limiting | — |
| `pino` | ^9.5.0 | Fast logger | — |
| `pino-pretty` | ^11.3.0 | Dev log formatter | — |
| `uuid` | ^10.0.0 | UUID generation | — |
| `cookie-parser` | ^1.4.7 | Cookie parsing | — |
| `compression` | ^1.7.5 | Response compression | — |
| `hpp` | ^0.2.3 | HTTP Parameter Pollution prevention | — |
| `dotenv` | ^16.4.5 | Load .env file | — |

**تنبيه:** يُوصى بتشغيل `npm audit` للاطلاع على أي ثغرات معروفة في هذه الإصدارات.

---

*نهاية التقرير*

*هذا التقرير أُعدَّ بناءً على مراجعة ثابتة (static analysis) للكود المصدري فقط ولم يُجرَ أي اختبار اختراق ديناميكي. تُنصح بإجراء penetration testing قبل الإطلاق الإنتاجي.*
