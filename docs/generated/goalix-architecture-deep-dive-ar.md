# Goalix Architecture Deep Dive

## قبل أي حاجة: هذا الملف معمول عشان تفهم، مش عشان يحفظك مصطلحات

أنت طلبت شرح architecture وperformance وqueue وcaching بالتفصيل الممل، وبالذات من منظور شخص جديد تماما. لذلك هذا التقرير لا يتعامل معك كأنك عارف الفرق بين API وworker وRedis وPostgreSQL. كل جزء هنا فيه أربع طبقات: يعني إيه المفهوم أصلا، فين موجود في Goalix، إزاي الflow يمشي خطوة بخطوة، وإزاي ده يأثر على الأداء أو الأمان أو سهولة التوسع.

مهم جدا: هذا ليس ملخصا. لو عايز تقرأه صح، اقرأه كأنك بتتبع رحلة request داخل النظام. أول مرة هتقرأ أسماء كتير. ثاني مرة هتبدأ تشوف الخريطة. ثالث مرة هتقدر تجاوب لما حد يسألك: ليه Redis؟ ليه Queue؟ ليه Worker؟ ليه فيه Next proxy؟ ليه PostgreSQL هو source of truth؟ وليه مش كل حاجة تتحط في cache؟

هذا التقرير مبني على الكود الحالي في workspace:

- Frontend: `Next.js 16.2.9` و `React 19.2.4` و `Redux Toolkit Query`.
- Backend: `Express` و `Knex` و `PostgreSQL`.
- Runtime مساعد: `Redis` و `BullMQ` و `Socket.IO`.
- Deployment: `Docker Compose` فيه services منفصلة: `postgres` و `redis` و `migrate` و `api` و `worker` و `frontend` و `nginx`.
- عدد migration files الحالي في `golx-backend/migrations` هو 107 ملف، وآخرها حتى `102_expand_player_import_export_logs.js` مع وجود أرقام مكررة لبعض المسارات التاريخية.

## 1. الصورة الكبيرة جدا: Goalix عبارة عن إيه؟

Goalix ليس صفحة dashboard واحدة. هو نظام إدارة أكاديمية كرة قدم. عندك مستخدمين بأدوار مختلفة: admin، coach، player، parent. كل دور يرى صفحات مختلفة، ويقدر يعمل عمليات مختلفة، ويرى جزءا مختلفا من البيانات.

لو بصينا للنظام كأجزاء كبيرة، هنلاقي:

| الجزء | وظيفته ببساطة | فين موجود |
| --- | --- | --- |
| Browser | المستخدم يفتح الصفحات ويتفاعل مع UI | المتصفح |
| Next.js Frontend | الصفحات، layouts، components، RTK Query، حماية routes من ناحية الواجهة | `app` و `components` و `lib` |
| Next API Proxy | يمرر طلبات `/api/v1/*` من الواجهة للbackend ويحافظ على cookies والheaders | [[code:app/api/v1/[...path]/route.ts]] |
| Express API | يستقبل requests، يطبق security، auth، validation، routes، controllers | `golx-backend/src/app.js` |
| Controllers | يقرأ request ويرجع response، لكنه لا يحمل business logic الثقيل | `golx-backend/src/modules/*/*.controller.js` |
| Services | قلب منطق النظام: صلاحيات، workflows، قرارات business | `golx-backend/src/modules/*/*.service.js` |
| Repositories | طبقة التعامل مع PostgreSQL عبر Knex | `golx-backend/src/modules/*/*.repository.js` |
| PostgreSQL | المكان الذي يحفظ الحقيقة النهائية والدائمة | migrations و `database.js` |
| Redis | ذاكرة سريعة مشتركة للكاش، queues، rate limits، locks، Socket adapter | `golx-backend/src/infrastructure/redis.js` |
| BullMQ Queues | قوائم انتظار للjobs الخلفية | `golx-backend/src/infrastructure/queue.js` |
| Workers | processes منفصلة تنفذ jobs من queues | `golx-backend/src/workers` |
| Socket.IO | realtime للشات والنوتيفيكيشن | `golx-backend/src/realtime` |
| Storage | حفظ وقراءة الملفات محليا أو S3-compatible | `golx-backend/src/shared/storage.js` |
| Nginx | reverse proxy أمام frontend/backend/socket/uploads | `ops/nginx/nginx.prod.conf` |

الجملة التي لازم تحفظ معناها، مش نصها:

PostgreSQL هو الحقيقة. Redis ليس الحقيقة، لكنه يسرع ويؤجل وينسق. Worker لا يقرر لوحده، هو ينفذ تعليمات مؤجلة. Frontend لا يملك الصلاحية النهائية، هو يعرض ويطلب، والbackend هو الذي يتحقق ويحكم.

## 2. يعني إيه Source of Truth؟

Source of truth يعني المكان الذي لو اختلف مع أي مكان آخر، هو الذي نصدقه. في Goalix هذا المكان هو PostgreSQL. لو Redis فيه session cache قديم، وPostgreSQL يقول إن session revoked، نصدق PostgreSQL. لو RTK Query في المتصفح عنده list قديمة، وbackend رجع list جديدة، نصدق backend الذي قرأ من PostgreSQL. لو Socket event ضاع، العميل يعمل REST refetch ويرجع للحقيقة من PostgreSQL.

ليه ده مهم؟ لأن الكاش بطبيعته ممكن يبقى قديم لثواني. والqueue بطبيعتها ممكن يكون فيها job لم يتنفذ بعد. والfrontend بطبيعته ممكن يكون فاتح tab قديم. لذلك لازم يكون عندنا مصدر نهائي دائم. هذا المصدر هو database.

## 3. خريطة folders: كل مجلد مسؤول عن إيه؟

| المسار | معناه |
| --- | --- |
| `app` | صفحات Next.js حسب role: admin، coach، player، parent، auth |
| `components` | مكونات UI مشتركة ومكونات domain مثل chat وparents وattendance |
| `lib/store/api` | RTK Query APIs التي تعرف endpoints وcache tags |
| `lib/api` | helpers مثل CSRF وbase URL |
| `proxy.ts` | حماية route trees في Next، وإعادة كتابة uploads للbackend |
| `golx-backend/src/app.js` | تكوين Express middleware وتركيب routes |
| `golx-backend/src/server.js` | تشغيل DB/Redis/server/socket وربما workers في non-production |
| `golx-backend/src/bootstrap/service-factory.js` | ينشئ repositories/services/controllers ويربطهم ببعض |
| `golx-backend/src/bootstrap/route-registry.js` | يركب routes على `/api/v1` |
| `golx-backend/src/modules` | كل domain module: auth، academy، players، calendar، chat، notifications، AI... |
| `golx-backend/src/infrastructure` | database، redis، queue، storage infrastructure |
| `golx-backend/src/shared` | helpers مشتركة: errors، authorization، cache، storage، upload access |
| `golx-backend/src/workers` | BullMQ workers |
| `golx-backend/migrations` | تاريخ شكل قاعدة البيانات والفهارس والجداول |
| `ops/nginx` | reverse proxy production |
| `docker-compose.prod.yml` | شكل التشغيل في production-like Docker |

## 4. رحلة GET request من أول المتصفح لحد PostgreSQL

خلينا ناخد مثال بسيط: admin فتح صفحة players. ما الذي يحدث؟

1. المستخدم يدخل على route في `/admin`.
2. `proxy.ts` في Next ينظر إلى cookie اسمها `accessToken` ويحاول يتأكد أن role هو admin.
3. لو المستخدم مش داخل أو role غلط، Next يعمل redirect قبل ما الصفحة تكمل.
4. الصفحة نفسها تستخدم hook من RTK Query، مثلا من `adminApi` أو `calendarApi`.
5. RTK Query يبني request إلى `/api/v1/...`.
6. request يمر على [[code:app/api/v1/[...path]/route.ts]]، وهذا يعمل proxy للbackend الحقيقي.
7. Next proxy يستخدم HTTP agent مع keepAlive، يعني يعيد استخدام نفس connections بدل فتح connection جديد لكل request.
8. Express يستقبل request في `app.js`.
9. middleware يضيف request id، security headers، CORS، compression، cookie parser، no-store للAPI، CSRF setup، rate limit.
10. route المناسب يروح إلى controller.
11. controller يقرأ query/body/params ويستدعي service.
12. service يتحقق من الصلاحية والمنطق.
13. repository يعمل query على PostgreSQL.
14. النتيجة ترجع service ثم controller ثم Express response ثم Next proxy ثم RTK Query.
15. RTK Query يحتفظ بالنتيجة في client cache لمدة محددة، ويعرضها للصفحة.

في GET عادي، غالبا لا يوجد CSRF requirement لأنه قراءة. لكن يوجد auth وrate limit وscope checks حسب endpoint.

## 5. رحلة Mutation request: لما المستخدم يغير حاجة

Mutation يعني request يغير state: POST أو PUT أو PATCH أو DELETE. مثال: admin أنشأ branch، coach حفظ attendance، parent عمل mark read للنوتيفيكيشن.

الflow هنا أطول لأن الخطر أكبر:

1. UI يستدعي RTK Query mutation.
2. `baseQueryWithReauth` يتأكد من CSRF token قبل الإرسال.
3. request يذهب إلى `/api/v1/*` ومعه cookies و`X-CSRF-Token`.
4. Express يرفض cross-site mutations لو `sec-fetch-site` غريب.
5. Express يتحقق أن origin مسموح.
6. `requireCsrfToken` يقارن header token مع cookie token.
7. auth middleware يتحقق من access token والجلسة.
8. rate limiter يتأكد أن المستخدم أو IP لم يتخط الحدود.
9. controller يستدعي service.
10. service يتحقق من ownership وrole وpermissions.
11. repository يكتب في PostgreSQL، أحيانا داخل transaction.
12. بعد الكتابة، service يلغي cache مناسب أو يزود cache version.
13. eventBus قد ينشر حدث داخلي.
14. audit middleware بعد انتهاء response قد يجهز audit job.
15. لو Redis متاح، audit job يذهب إلى audit queue.
16. audit worker يكتب في `audit_logs`.
17. لو Redis غير متاح، audit fallback يكتب مباشرة في PostgreSQL.

لاحظ أن الكاش لا يسبق الكتابة. الكتابة تحصل في PostgreSQL أولا. بعد كده نلغي أو نغير الكاش. هذا مهم جدا حتى لا نعرض بيانات قديمة بعد mutation.

## 6. الفرق بين Controller وService وRepository

النظام يستخدم pattern واضح:

| الطبقة | تعمل إيه | لا تعمل إيه |
| --- | --- | --- |
| Controller | يترجم HTTP request إلى function call ويرجع HTTP response | لا يحشر business logic عميق |
| Service | يقرر workflow والصلاحيات والعمليات المركبة | لا يكتب SQL مباشر قدر الإمكان |
| Repository | يتعامل مع الجداول وKnex queries | لا يقرر business policy |

مثال: إرسال notification.

controller يستقبل body. service يحدد recipients، ينشئ notification rows، يلغي unread cache، ويقرر هل يحتاج external delivery queue. repository ينفذ insert/select/update على الجداول. worker الخارجي، إن كان channel ليس `in_app`، يحاول delivery لاحقا، لكنه حاليا placeholder لأن provider غير configured.

ليه الفصل ده مهم؟ لأنه لو controller كله كتب SQL ومنطق وصلاحيات في نفس المكان، أي تعديل صغير يكسر النظام. أما لما يكون المنطق في service وSQL في repository، الاختبار والصيانة أسهل.

## 7. EventBus: ليس Queue

في `golx-backend/src/events/eventBus.js` يوجد EventEmitter داخلي. ده اسمه EventBus، لكنه ليس Redis queue. الفرق:

| المفهوم | EventBus | Queue |
| --- | --- | --- |
| التخزين | لا يخزن غالبا، الحدث يمر داخل نفس process | يخزن job داخل Redis |
| الزمن | فوري داخل process | مؤجل، worker يستهلكه |
| لو process وقع | الحدث يضيع لو لم يكن محفوظا في DB | job قد يبقى في Redis حسب الحالة |
| الاستخدام | إعلام modules أن حاجة حصلت | تنفيذ شغل خلفي أو قابل للإعادة |
| المثال | `USER_LOGGED_IN` event | `auditQueue.add("log")` |

يعني لما service يعمل publish، هو لا يقول للworker الخارجي نفذ. هو فقط يعلن داخل runtime الحالي. أما queue فهي قائمة انتظار حقيقية.

## 8. الأدوار والصلاحيات: مين يشوف إيه؟

Goalix multi-role وacademy-scoped. معنى ذلك أن نفس الجدول قد يحتوي بيانات لكل الأكاديمية أو لعدة مستخدمين، لكن كل request لازم يتصفى حسب role وacademy وassignment.

| الدور | يشوف إيه أساسا | قيود مهمة |
| --- | --- | --- |
| Admin | إدارة الأكاديمية، لاعبين، مدربين، فروع، مجموعات، تقويم، تقارير | حسب permissions وacademy scope |
| Coach | players/groups/matches/training داخل assignment | لا يرى لاعب خارج تكليفه |
| Player | بيانات نفسه: profile، attendance، assignments، ranking، chat | لا يرى لاعبين آخرين |
| Parent | الأبناء المرتبطين به فقط | لا يرى child غير linked |

الواجهة قد تخفي menu غير مسموح، لكن هذا ليس أمانا كافيا. الأمان الحقيقي في backend: middleware وservice وaccess-policy.

## 9. Auth بالتفصيل: الدخول والجلسات

الدخول ليس مجرد JWT. عند login:

1. المستخدم يرسل username/password.
2. AuthService يبحث عن user في PostgreSQL.
3. يتحقق من role، active status، lockout، password hash.
4. لو admin أو coach وMFA مطلوب، ينشئ challenge.
5. challenge يحاول يتخزن في Redis لمدة 5 دقائق تحت key مثل `goalix:auth:mfa-challenge:{challengeId}`.
6. لو Redis فشل، يوجد fallback في PostgreSQL عبر auth repository.
7. بعد نجاح MFA، أو لو MFA غير مطلوب، service ينشئ access token وrefresh token.
8. refresh token لا يخزن نصا؛ يخزن hash في جدول `auth_refresh_tokens`.
9. access token يحتوي jti. هذا jti يربط الطلب الحالي بجلسة فعالة.
10. Redis يخزن session cache لتسريع الطلبات القادمة.
11. controller يضع tokens في HttpOnly cookies.

كل request بعد ذلك:

1. backend يقرأ accessToken من cookie أو Authorization Bearer.
2. يحقق signature وexpiry.
3. يبحث عن session cache في Redis.
4. لو cache موجود، الطلب يكمل بسرعة.
5. لو cache غير موجود، backend يرجع إلى PostgreSQL ويتأكد أن session غير revoked وغير expired.
6. لو PostgreSQL أكد الجلسة، يعيد cacheActiveSession في Redis.

النقطة المهمة: Redis هنا يسرع التحقق، لكنه لا يلغي سلطة PostgreSQL. لو user عمل logout all devices، service يمسح DB tokens ويحاول يمسح Redis. ولو Redis كان down، DB مازال يمنع الجلسة بعد الرجوع له.

## 10. CSRF: ليه موجود؟

لأن النظام يستخدم cookies. المتصفح يرسل cookies تلقائيا مع الطلبات لنفس الموقع. CSRF attack يحاول يخلي المتصفح يرسل mutation بدون قصد المستخدم. لذلك backend يطلب token إضافي في header.

في Goalix:

1. backend يضع cookie اسمها `csrfToken`.
2. frontend يقرأها لأنها ليست HttpOnly.
3. عند POST/PUT/PATCH/DELETE، RTK Query يضعها في `X-CSRF-Token`.
4. backend يتأكد أن header يساوي cookie وأن token signature صحيح.
5. لو token قديم أو مرفوض، frontend يعمل refresh من `/api/v1/csrf-token` ويعيد الطلب مرة واحدة فقط.

الأمان هنا في أن attacker لا يستطيع بسهولة قراءة cookie وإرسال نفس القيمة في header من موقع آخر.

## 11. Frontend architecture

الfrontend مبني على Next.js App Router. Route trees الأساسية:

| route | لمن |
| --- | --- |
| `app/(auth)` | login, admin-login, signup, forgot password, MFA setup |
| `app/admin` | admin dashboard and operations |
| `app/coach` | coach portal |
| `app/player` | player portal |
| `app/parent` | parent portal |

الواجهة لا تقرأ database مباشرة. كل البيانات تأتي من API. إدارة data في الواجهة تتم عبر RTK Query APIs:

- `adminApi`
- `coachApi`
- `calendarApi`
- `dashboardApi`
- `academyApi` موجود لكنه ليس موصل في store الحالي مثل الأربعة الآخرين.

RTK Query يعطيك:

1. cache في ذاكرة المتصفح.
2. loading/error states.
3. retries غير مباشرة عبر baseQuery reauth.
4. tags مثل `Players` و`Notifications` و`CalendarEvents`.
5. invalidation بعد mutations.

مثال: لو mutation أنشأت player، invalidatesTags تعمل invalidate ل`Players`. أي query يعتمد على Players يتحدث بدل ما يفضل يعرض قائمة قديمة.

## 12. Next API Proxy: ليه عندنا proxy داخل Next؟

الملف [[code:app/api/v1/[...path]/route.ts]] يستقبل أي request يبدأ ب`/api/v1` في frontend server، ثم يرسله إلى backend الداخلي.

فوائده:

1. الواجهة تستخدم مسار ثابت `/api/v1` بدل ما تعرف عنوان backend الحقيقي.
2. cookies والheaders تفضل ماشية بطريقة موحدة.
3. في Docker production، frontend يكلم api service عبر `http://api:3000` وليس public internet.
4. يستخدم HTTP/HTTPS agents مع keepAlive وسقف sockets.

تأثير keepAlive على الأداء: من غير keepAlive، كل request ممكن يفتح TCP connection جديد. هذا يضيف handshake ووقت وانتظار. مع keepAlive، الاتصال يبقى مفتوحا ويعاد استخدامه. تحت ضغط dashboard فيه عشرات requests، الفرق واضح.

## 13. Backend startup: server.js بيعمل إيه؟

عند تشغيل backend:

1. يستدعي `connectDatabase()` ويتأكد أن PostgreSQL يرد.
2. يستدعي `connectRedis()` ويحاول الاتصال بRedis.
3. يقرر هل يشغل workers داخل API process أم لا.
4. في production compose، `BULLMQ_WORKERS_ENABLED=false` في api، لذلك workers لا تعمل داخل api.
5. worker service المنفصل يشغل `node src/workers/run.js`.
6. server يبدأ listen على port 3000.
7. يضبط keepAliveTimeout وheadersTimeout وrequestTimeout.
8. يشغل Socket.IO على نفس HTTP server.
9. يجهز graceful shutdown: يغلق server وsocket والautomations والworkers.

هذا الفصل مهم. API يخدم المستخدمين. Worker يخدم jobs. لو AI job ثقيل أو notification job بطيء، لا يخنق نفس process الذي يرد على المستخدم.

## 14. Express middleware stack: البوابة قبل أي route

قبل أن يصل request إلى controller، يمر على طبقات:

| middleware | الهدف |
| --- | --- |
| request id | كل request له X-Request-ID لتتبعه في logs |
| slow request logging | لو request تخطى threshold، يسجل warning |
| Helmet | headers أمنية |
| CORS | يسمح origins محددة مع credentials |
| compression | يضغط responses لتقليل bytes |
| hpp | يقلل HTTP parameter pollution |
| cookie parser | قراءة cookies الموقعة |
| no-store API | يمنع browser/proxy من تخزين API responses الحساسة |
| reject cross-site mutations | يرفض requests cross-site المشبوهة |
| set CSRF cookie | يضمن وجود csrf token |
| body parsers | JSON/urlencoded بحد 512kb |
| origin check | للmutations |
| CSRF middleware | يتحقق من token |
| audit middleware | يجهز audit log للmutations الحساسة |
| apiLimiter | rate limit عام |

هذه الطبقات تجعل controller لا يبدأ من الصفر. هو يستلم request مر بالفعل على فلاتر أمان وأداء.

## 15. Database architecture: PostgreSQL فين في الصورة؟

PostgreSQL هو OLTP database. OLTP يعني قاعدة بيانات عمليات يومية: تسجيل دخول، حضور، إنشاء لاعب، تعديل مجموعة، إرسال رسالة، حفظ تقييم.

الجداول منطقيا مقسمة domains:

| Domain | أمثلة |
| --- | --- |
| Identity/Auth/IAM | users, sessions, refresh tokens, MFA, roles, permissions |
| Academy | academy, branches, birth years, groups |
| People | players, coaches, parents, parent links |
| Operations | calendar events, trainings, matches, attendance |
| Performance | rankings, evaluations, injury risk, AI inputs |
| Communication | chat conversations, messages, read receipts, notifications |
| Billing | payments, subscriptions, invoices |
| Storage/Ops | media files, audit logs, lifecycle archives, backups |

PostgreSQL مهم لأنه يدعم transactions. Transaction يعني مجموعة عمليات إما تنجح كلها أو تفشل كلها. في chat مثلا، إرسال message يجب أن يحفظ الرسالة ويحدث last message ويجهز event بطريقة متسقة. لو حصل فشل في المنتصف، لا نريد نصف رسالة.

## 16. Redis: هو إيه في Goalix؟

Redis هنا shared in-memory runtime. يعني خدمة سريعة في الذاكرة تصل لها كل processes. يستخدم في:

- cache.
- BullMQ queues.
- rate limit counters.
- Socket.IO adapter.
- automation locks.
- MFA temporary challenges.
- session cache.

لكن Redis ليس database الأساسية للplayers أو attendance أو rankings. لو Redis وقع، النظام يدخل degraded في بعض المناطق. القراءة الأساسية من DB ممكن تكمل في أماكن كثيرة. لكن queues/realtime distributed/rate limits distributed تتأثر.

في `redis.js` تم ضبط:

- `lazyConnect: true`: لا يتصل إلا عندما نطلب.
- `enableOfflineQueue: false`: لا يراكم أوامر Redis داخليا لو Redis غير جاهز.
- retry محدود: بعد 3 محاولات يتوقف.
- warnings بدون إسقاط process في development، مع production config أشد.

## 17. يعني إيه Cache؟

Cache يعني نسخة سريعة ومؤقتة من نتيجة. لا تستخدم cache لأنك تحب Redis. تستخدمها عندما تكون نفس القراءة تتكرر كثيرا، والنتيجة لا تحتاج تكون fresh كل millisecond، وتستطيع الرجوع للsource الحقيقي لو cache فشل.

في Goalix عندنا أربع طبقات cache مختلفة:

| النوع | مكانه | مثال |
| --- | --- | --- |
| Server Redis cache | Redis مشترك بين processes | unread count، auth user، attendance overview |
| Client RTK Query cache | ذاكرة المتصفح | responses داخل adminApi/coachApi/calendarApi |
| HTTP cache headers | browser/proxy behavior | uploads private max-age، API no-store |
| In-process memory cache | داخل process واحد فقط | ranking Python model prediction cache |

لا تخلط بينهم. Redis cache يعيش خارج process. RTK Query cache يعيش في tab/browser. In-memory cache يعيش في Node process واحد فقط. HTTP cache يتحكم فيه المتصفح أو proxy.

## 18. Caching الموجود حاليا بالتفصيل

| Cache | Key shape | TTL | لماذا موجود | كيف يلغى |
| --- | --- | --- | --- | --- |
| Auth session | `goalix:auth:session:{userId}:{accessJti}` | حتى 900 ثانية أو أقل حسب token/session | تسريع auth middleware | logout/refresh/logout all أو انتهاء TTL |
| User sessions set | `goalix:auth:user-sessions:{userId}` | نفس session TTL تقريبا | معرفة كل jti الخاصة بالمستخدم لمسحها | invalidate all sessions |
| Session touch lock | `goalix:auth:session-touch:{sessionId}` | interval قصير | منع تحديث last_seen على كل request | ينتهي تلقائيا |
| Auth user | `goalix:auth:user:v1:{userId}` | 120 ثانية افتراضيا | تسريع current user | TTL أو overwrite عند login |
| Permissions | `goalix:auth:permissions:v1:{userId}:{academyId}` | 30 ثانية | صلاحيات تتقرأ كثيرا وتتغير قليلا | TTL، وبعض mutations invalidate frontend |
| MFA challenge | `goalix:auth:mfa-challenge:{challengeId}` | 5 دقائق | تخزين خطوة MFA مؤقتة | getdel عند الاستخدام أو expiry |
| Attendance overview | `goalix:cache:attendance:overview:{academyId}:v{version}:{filters}` | 30 ثانية | overview قد يكون query ثقيل | bump version عند تغيير attendance/calendar |
| Branches | `goalix:academy:{academyId}:branches:v{version}:p{page}:l{limit}` | 120 ثانية | branches تتكرر ولا تتغير كل ثانية | bump version عند create/update/delete branch |
| Notification unread count | `goalix:notifications:{userId}:unread-count:v1` | 30 ثانية | badge يظهر في أغلب الصفحات | delete key عند send/read/read all |
| Chat conversations | `goalix:chat:{userId}:conversations:v1` | 15 ثانية | قائمة المحادثات تتكرر كثيرا | delete keys للمشاركين عند message/create/edit/delete |
| Rate limits | `goalix:ratelimit:{prefix}:...` | window حسب limiter | حدود موزعة بين API instances | expiry حسب window |
| Automation locks | `goalix:automation:*` | ثواني أو دقائق | منع نفس automation من العمل مرتين | delete آمن أو expiry |
| Ranking model memory cache | hash داخل Map | 30 ثانية افتراضيا | منع تشغيل Python لنفس input بسرعة | expiry أو max entries |

## 19. Cache read flow: لما الكاش يصيب Hit

مثال unread notification count:

1. UI يطلب unread count.
2. service يبني key: `goalix:notifications:{userId}:unread-count:v1`.
3. service يعمل Redis GET.
4. لو وجد قيمة، يرجعها مباشرة.
5. لا يضرب PostgreSQL في هذه المرة.

الفائدة: لو الbadge موجود في header وكل صفحة تقرأه، بدل مئات queries على DB، Redis يرد بسرعة.

## 20. Cache miss flow: لما الكاش فاضي

نفس المثال:

1. service يبني key.
2. Redis GET يرجع null.
3. service يسأل repository.
4. repository يعمل SELECT/COUNT في PostgreSQL.
5. service يضع النتيجة في Redis مع TTL.
6. response يرجع للواجهة.

القاعدة هنا: cache miss لا يعني فشل. يعني نقرأ من المصدر الحقيقي ثم نملأ الكاش.

## 21. Cache invalidation: إزاي نمنع البيانات القديمة؟

أصعب سؤال في caching هو: متى نمسح الكاش؟

Goalix يستخدم طريقتين:

| الطريقة | الفكرة | المثال |
| --- | --- | --- |
| Delete keys | امسح key القديم مباشرة | unread count وchat conversations |
| Version bump | زود رقم version، فيتغير key القادم | attendance overview وbranches |

Delete keys مناسب لما تعرف بالضبط users المتأثرين. مثلا رسالة chat تؤثر على قائمة المحادثات للمشاركين فقط. إذن نمسح keys لهم.

Version bump مناسب لما عندك filters كثيرة. Attendance overview ممكن يتفلتر بbranch/group/date. بدل ما تبحث عن كل keys المحتملة وتمسحها، تزود version للأكاديمية. أي read جديد سيبني key فيه version جديد، فيتجاهل كل النتائج القديمة تلقائيا حتى تنتهي TTL.

## 22. هل كل شاشة محتاجة caching؟

لا. الكاش له تكلفة ذهنية وخطر stale data. نستخدمه عندما يكون العائد واضحا.

شاشات أو قراءات مناسبة للكاش:

- unread notification count، لأنه badge يتكرر جدا.
- chat conversations، لأنها تظهر كثيرا وتتغير مع الرسائل.
- attendance overview، لأنها aggregation وقد تكون ثقيلة.
- branches list، لأنها metadata شبه ثابتة.
- current user وpermissions، لأنها تتحقق كثيرا.
- rate limit counters، لأنها يجب أن تكون مشتركة بين instances.
- public academy profile ممكن يستفيد من caching لاحقا، لكنه حاليا fetch no-store من HeroSection.

شاشات لا يجب تكاشها بسهولة:

- operations حساسة تحتاج freshness بعد mutation مباشرة.
- قرارات صلاحية نهائية لو الكاش قد يفتح access بالخطأ.
- payment status realtime أو security-sensitive state إلا بتصميم invalidation واضح.
- نتائج search كثيرة التغير بدون TTL قصير وkey مضبوط.

## 23. RTK Query cache: كاش الواجهة

RTK Query لا يستخدم Redis. هو يعمل cache داخل browser memory. في `adminApi` و`coachApi` و`calendarApi` و`dashboardApi` يوجد `keepUnusedDataFor` غالبا 300 ثانية. هذا يعني لو component اختفى ثم ظهر، RTK Query قد يعيد استخدام البيانات بدل request جديد مباشرة.

لكن عندما mutation تغير data، تستخدم APIs `invalidatesTags`. مثال:

| Mutation | Invalidates |
| --- | --- |
| create/update/delete player | `Players` |
| create/update/delete branch | `Branches` و`Groups` أحيانا |
| send/read notification | `Notifications` |
| training/match mutations | `CalendarEvents` و`Matches` |
| parent links | `ParentLinks` و`ParentPortal` |

هذا يحسن الأداء لأن الصفحة لا تعيد تحميل كل شيء طول الوقت، لكنه يحافظ على الاتساق بعد التعديل.

## 24. Queue: يعني إيه Job؟

Job في هذا النظام هو أمر شغل صغير محفوظ في queue. ليس اللاعب. ليس التمرين. ليس notification نفسها. هو ورقة تعليمات تقول للworker: نفذ العملية دي بالبيانات دي.

مثال audit job:

- job name: `log`
- queue: `goalix-audit`
- payload: user_id، action، table_name، record_id، ip_address، user_agent، session_jti، metadata
- worker: audit.worker.js
- التنفيذ: insert في جدول `audit_logs`

تخيل المستخدم عمل POST لتعديل coach. الطلب الأساسي ينجح ويرجع response. بعده audit middleware يجهز job. worker لاحقا يكتب audit log. كده المستخدم مايضطرش ينتظر كل تفاصيل logging لو Redis شغال.

## 25. Queue بتخزن إيه بالضبط؟

BullMQ يستخدم Redis لتخزين job metadata. عمليا أنت تهتم بهذه الحاجات:

| الشيء | معناه |
| --- | --- |
| queue name | مثلا `goalix-audit` أو `goalix-ai` |
| job id | رقم/معرف job داخل queue |
| job name | نوع المهمة: `log`، `generate-invoice`، `calculate-performance` |
| payload | البيانات اللازمة للتنفيذ |
| attempts | عدد المحاولات المسموح بها |
| attemptsMade | كم محاولة تمت |
| backoff | انتظار قبل إعادة المحاولة |
| timestamps | متى أضيفت ومتى اشتغلت |
| status | waiting، active، completed، failed، delayed حسب BullMQ |
| result أو failure reason | ماذا رجع worker أو سبب الفشل |

الqueue لا تخزن business tables كبديل للDB. هي تخزن تعليمات مؤقتة وحالة تنفيذها.

## 26. إعدادات queue في Goalix

في `golx-backend/src/infrastructure/queue.js`:

| الإعداد | القيمة |
| --- | --- |
| queue prefix | `BULLMQ_PREFIX` وافتراضيا `goalix` |
| removeOnComplete | يحتفظ بآخر 1000 job مكتملة |
| removeOnFail | يحتفظ بآخر 5000 job فاشلة |
| attempts | 3 |
| backoff | exponential delay يبدأ من 2000ms |
| queues | rankings، notifications، payments، ai، audit |

لو Redis غير متاح:

- createQueue يرجع null activeQueue.
- add يرجع object فيه `skipped: true` بدل ما يكسر في بيئات skip.
- في production، env validation يطلب `QUEUE_REDIS_FAILURE_MODE=throw` و`REDIS_REQUIRED=true`، حتى لا يتم تجاهل jobs المهمة بصمت.
- audit له fallback خاص: لو فشل queue add، يحاول insert مباشرة في PostgreSQL.

## 27. Workers: مين بينفذ jobs؟

Workers موجودة في `golx-backend/src/workers`:

| Worker | Queue | Concurrency | الحالة الحالية |
| --- | --- | --- | --- |
| audit.worker.js | `goalix-audit` | 5 | فعلي: يكتب في audit_logs |
| ranking.worker.js | `goalix-rankings` | 2 | placeholder: يرجع skipped |
| notification.worker.js | `goalix-notifications` | 5 | placeholder للexternal delivery |
| payment.worker.js | `goalix-payments` | 3 | TODOs للفواتير/refund/subscription checks |
| ai.worker.js | `goalix-ai` | 2 | placeholder لأن provider غير configured |

Concurrency يعني worker ممكن يشتغل على أكثر من job بالتوازي. audit concurrency 5 لأن insert logs سريع نسبيا. AI concurrency 2 لأن المتوقع أنه أثقل.

## 28. كل Job موجود في النظام حاليا

| النوع | متى يتضاف | Payload | التنفيذ الحالي |
| --- | --- | --- | --- |
| audit log | بعد mutations حساسة مثل admin/auth/players/coaches/payments/academy/chat | user_id, action, table_name, record_id, ip, user_agent, session_jti, metadata | يكتب في audit_logs |
| ranking recalculation | عند requestRecalculate | groupId, periodType | worker يرجع skipped لأن execution غير موصل |
| bulk notification external delivery | عند sendNotification إذا channel ليس in_app | notificationIds, channel, academyId, targetRole | worker يرجع delivery_provider_not_configured |
| generate invoice | بعد createSubscription | subscriptionId | TODO داخل worker |
| check expiring subscriptions | job مدعوم في worker لو أضيف مستقبلا | غالبا filters/time | TODO |
| process refund | job مدعوم في worker لو أضيف مستقبلا | paymentId, amount | TODO |
| calculate performance | عند AiService.calculatePerformanceScore | playerId | provider_not_configured |
| assess injury risk | عند AiService.assessInjuryRisk | playerId | provider_not_configured |
| generate nutrition plan | عند AiService.generateNutritionPlan | playerId plus options | provider_not_configured |
| AI chat | عند AiService.chat | userId, prompt, context | provider_not_configured |

نقطة دقيقة: rankings service يرسل payload فيه `periodType`، بينما ranking worker يقرأ `type`. لأن worker أصلا لا ينفذ الحساب حاليا ويرجع skipped، هذا لا يظهر كأثر وظيفي، لكنه يوضح أن ranking queue جاهزة شكليا وليست wiring مكتمل.

## 29. Jobs غير BullMQ لكنها background automations

في `background-automations.js` يوجد شغل بالوقت. هذا ليس BullMQ job، لكنه background task:

| Automation | ماذا يفعل | حماية التكرار |
| --- | --- | --- |
| reminder scans | match day، attendance QR، monthly measurement reminders | Redis lock |
| weekly injury risk | يشغل weekly injury risk automation | Redis lock |
| notification cleanup | archive/remove expired notifications | Redis lock |
| data lifecycle | يحرك data من hot إلى archive | Redis lock |
| backup automation | scheduled database backup | Redis lock |

لماذا lock؟ لو عندك أكثر من worker process، لا تريد كلهم ينفذوا cleanup في نفس اللحظة. Redis `SET NX PX` يعني: ضع المفتاح فقط لو غير موجود، واجعله ينتهي بعد مدة. الذي يحصل على lock ينفذ. الآخرون يتخطون.

## 30. متى نحتاج Queue؟

نحتاج queue عندما:

- العملية طويلة والمستخدم لا يحتاج ينتظر نتيجتها النهائية.
- العملية تتصل بخدمة خارجية قد تفشل: email، SMS، WhatsApp، payment gateway.
- العملية تحتاج retry.
- العملية CPU-heavy مثل AI أو ranking model.
- العملية fanout لعدد كبير من المستخدمين.
- نريد فصل الحمل عن API.

لا نحتاج queue عندما:

- القراءة سريعة والمستخدم ينتظر النتيجة الآن.
- التحقق الأمني يجب يحدث قبل response.
- العملية لازم تنجح أو تفشل مع request نفسه.
- البيانات يجب تظهر مباشرة ولا يجوز تأجيلها.

## 31. Workflow كامل: Audit queue

1. المستخدم يعمل mutation على endpoint حساس.
2. Express يسمح للrequest يمر ويصل للcontroller.
3. response ينتهي.
4. audit middleware يجهز logData.
5. لو Redis موجود وBullMQ enabled، يستدعي `auditQueue.add("log", logData)`.
6. BullMQ يخزن job في Redis.
7. audit worker يلتقط job.
8. worker يعمل insert في `audit_logs`.
9. لو insert نجح، job completed.
10. لو فشل، BullMQ يعيد المحاولة حسب attempts/backoff.
11. لو queue add فشل، app.js يحاول write مباشر في PostgreSQL.

أثره على performance: logging لا يزيد زمن response الأساسي بنفس القدر، والAPI لا يبقى مشغولا بعمليات جانبية. وفي نفس الوقت audit لا يضيع بسهولة بسبب fallback.

## 32. Workflow كامل: Notification

الإشعارات في Goalix لها جزئين:

1. in-app notification: سجل داخل PostgreSQL يراه المستخدم في dashboard.
2. external delivery: إرسال خارج النظام عبر قناة مثل email أو WhatsApp، وهذا غير موصل حاليا.

Flow:

1. service أو admin يطلب sendNotification.
2. NotificationsService يحل recipients.
3. ينشئ rows في notification_inbox وربما logs.
4. يمسح unread count cache للمستلمين.
5. لو channel ليس `in_app`، يضيف job `bulk-notification`.
6. worker حاليا يرجع skipped لأن delivery provider غير configured.
7. eventBus ينشر notification event.
8. Socket.IO قد يرسل notification:new للمستخدمين.

معنى هذا: in-app موجود. external provider ليس مكتمل. لو حد سألك: هل notifications شغالة؟ الإجابة الدقيقة: إشعارات داخل النظام شغالة، الإرسال الخارجي عبر queue جاهز كهيكل لكن provider غير موصل.

## 33. Workflow كامل: Chat message

الشات مثال مهم لأنه يجمع DB وcache وrealtime وaccess control.

1. المستخدم يفتح conversation.
2. frontend يطلب conversation/messages.
3. backend يتأكد أن المستخدم participant أو له صلاحية access.
4. عند إرسال message، service يتحقق من conversation status ومن coach-player access الحالي.
5. لو فيه صورة، يتم فحص mimetype/signature والحجم ثم storage.
6. repository insert message غالبا داخل transaction ويستخدم clientMessageId لمنع duplicate.
7. لو الرسالة ليست idempotent duplicate، يتم invalidate chat conversations cache للمشاركين.
8. response يرجع message.
9. realtime layer يرسل chat:message وchat:conversation.
10. لو Socket event ضاع، العميل يستطيع refetch messages من REST.

أثر performance: chat conversations cache يقلل قراءة القائمة. Socket يقلل polling. clientMessageId يقلل duplicates عند retry. DB-first يضمن consistency.

## 34. Workflow كامل: Attendance overview

Attendance overview قابل أن يكون ثقيل لأنه قد يجمع بيانات حسب academy/branch/group/date.

Flow:

1. request يصل إلى AttendanceService.getAttendanceOverview.
2. service يقرأ cache version للأكاديمية.
3. يبني key يحتوي academyId، version، branchId، groupId، dateFrom، dateTo.
4. لو Redis فيه value، يرجعها.
5. لو لا، repository يعمل query على PostgreSQL.
6. service يخزن النتيجة 30 ثانية.
7. أي تغيير attendance/calendar مهم يستدعي invalidateAttendanceCache، وهذا يزود version.

لماذا version أفضل هنا؟ لأن نفس overview له filters كثيرة. حذف كل keys صعب. version يجعل المفاتيح القديمة غير مستخدمة بدون بحث.

## 35. Workflow كامل: Training to Ranking

هذا flow منطقي في النظام:

1. coach/admin ينشئ training أو match.
2. اللاعبين يحضرون أو يتم تقييمهم.
3. calendar/ranking logic ينتج ranking inputs أو snapshots حسب المسار.
4. weekly/monthly rankings تقرأ من snapshots أو fallback.
5. admin/coach/player/parent يعرضون نفس المصدر حتى لا تختلف النتائج بين الأدوار.

لكن مهم: ranking worker في BullMQ حاليا لا يحسب فعليا. يوجد ranking logic في services/repositories وPython model helpers، لكن worker نفسه placeholder. لذلك لو حد قال "queue بتاعة rankings بتحسب؟" الإجابة: requestRecalculate يضيف job، لكن worker الحالي لا ينفذ الحساب الحقيقي.

## 36. Workflow كامل: File upload/download

Upload:

1. route يستخدم multer memory storage في بعض modules.
2. file validation يتحقق من الحجم والنوع والsignature.
3. storage adapter يحفظ local أو S3-compatible حسب config.
4. metadata تسجل في media_files عندما ينطبق.
5. URL يرجع غالبا تحت `/uploads/...`.

Download:

1. المستخدم يطلب `/uploads/path`.
2. Next proxy يعيد rewrite للbackend.
3. Express route `/uploads/*` يتطلب authMiddleware.
4. لو path يبدأ بchat، ChatService يتحقق أن المستخدم يملك access للattachment.
5. لو ليس chat، storage metadata وupload-access policy تتحقق.
6. لو مرفوض، الرد 404 آمن، وقد يسجل audit denied.
7. لو مسموح، headers أمنية تضاف، وcache-control يكون `private, max-age=604800`.
8. الملف يرسل stream أو sendFile.

ليه protected uploads مهمة؟ لأن الملفات قد تكون صور chat أو assignment أو بيانات لاعب. لا يصح جعلها static public.

## 37. Performance: معنى الأداء هنا

الأداء ليس زر واحد. الأداء هو تقليل:

- زمن response للمستخدم.
- عدد queries غير الضرورية.
- حجم payload.
- عدد connections.
- الضغط على database.
- الشغل الثقيل داخل API process.
- polling الزائد.
- تكرار الحسابات.

وهو أيضا زيادة:

- القدرة على التوسع الأفقي.
- قدرة النظام على الاستمرار لو Redis تعطل جزئيا.
- قابلية التشخيص عبر logs وload tests.

## 38. Performance fix 1: Database indexes

المشروع أضاف عدة migrations للفهرسة:

| Migration | ماذا تستهدف |
| --- | --- |
| `072_performance_indexes.js` | notifications، players/coaches active lists، branches/groups، attendance sessions، calendar events، matches |
| `074_training_attendance_indexes.js` | training calendar، event_attendance، training_sessions، group assignments |
| `080_chat_auth_performance_indexes.js` | auth sessions، IAM roles، chat conversations/messages، match tactics/squads |
| `086_media_files_hardening_and_performance_indexes.js` | media files، ranking snapshots، AI inputs، evaluations، match stats، assignment files |
| `094_long_term_database_optimization.js` | حذف indexes متكررة، إضافة reverse lookups، expression indexes للإشعارات، autovacuum/fillfactor |

يعني إيه index؟ تخيل كتابا كبيرا. بدون index، تبحث صفحة صفحة. مع index، تذهب للفهرس وتعرف مكان الصفحات. في database، index يساعد query مثل: هات notifications لمستخدم معين مرتبة بالأحدث. لذلك index `(user_id, created_at DESC)` مهم.

لكن index ليس مجانا. كل insert/update/delete يحتاج تحديث index. لذلك migration 094 حذف indexes متكررة أو مغطاة. هذا يحسن الكتابة والتخزين.

## 39. Performance fix 2: Partial and expression indexes

Partial index يعني نفهرس جزءا فقط من الجدول. مثال:

- unread notifications فقط حيث `is_read = false`.
- active records فقط حيث `deleted_at IS NULL`.

الفائدة: index أصغر وأسرع لأننا لا نفهرس data لا نحتاجها في query.

Expression index يعني نفهرس ناتج تعبير، مثل value داخل JSON:

- `(data->>'source')`
- `(data->>'matchId')`
- `(data->>'weekStart')`

هذا مهم لأن notification dedupe قد يبحث داخل JSON data. بدون expression index، PostgreSQL قد يقرأ عددا أكبر من الصفوف.

## 40. Performance fix 3: Autovacuum وfillfactor

جداول كثيرة التحديث مثل:

- `auth_refresh_tokens`
- `notification_inbox`
- `realtime_outbox`
- `chat_conversations`

تتعرض لتحديثات متكررة. PostgreSQL عند update لا يغير الصف في مكانه دائما؛ يخلق نسخة جديدة ويترك القديمة لتُنظف لاحقا بواسطة vacuum. لو التنظيف تأخر، يحصل bloat.

Migration 094 يضبط:

- `fillfactor = 90`
- autovacuum thresholds أصغر
- analyze thresholds أصغر

الفائدة: يقلل bloat ويجعل planner عنده statistics أحدث، فيختار query plan أفضل.

## 41. Performance fix 4: Connection pool وtimeouts

في `database.js` يوجد Knex pool:

- min من env، production compose يضع `DB_POOL_MIN=0`.
- max افتراضيا 10 في production compose.
- acquire timeout 10 ثواني.
- statement_timeout افتراضيا 30000ms.
- idle_in_transaction timeout افتراضيا 10000ms.
- lock_timeout افتراضيا 5000ms.

ليه ده مهم؟ لو عندك 10 API instances وكل واحد pool max 40، ممكن تعمل 400 DB connections وتخنق PostgreSQL. تقليل pool إلى 10 مع توصية PgBouncer يمنع الانفجار.

timeouts مهمة لأن query معلقة أو lock طويل لا يجب أن يأكل resources إلى الأبد.

## 42. Performance fix 5: Pagination وlimit clamp

في `shared/pagination.js`:

1. page الأقل من 1 يتحول إلى 1.
2. limit الأقل من 1 يتحول إلى 1.
3. limit الأعلى من `MAX_PAGE_LIMIT` يتقص إلى max.
4. default limit من `DEFAULT_PAGE_LIMIT`.

ليه ده يحسن الأداء؟ لأنه يمنع request مثل `?limit=100000` من تحميل آلاف الصفوف والرد الضخم. حتى لو المستخدم أو attacker طلب limit كبير، backend يقصه.

## 43. Performance fix 6: Queue/Worker separation

في production compose:

- api service: `BULLMQ_WORKERS_ENABLED=false`
- worker service: `node src/workers/run.js`

هذا يعني API process لا ينفذ jobs الثقيلة. لو AI worker أو notification delivery بطئ، لا يمنع Express من الرد على dashboards.

لو أردت scale، تستطيع زيادة عدد workers بدون زيادة API instances، أو العكس. هذه مرونة مهمة.

## 44. Performance fix 7: Redis short caches

الكاش القصير يقلل ضربات DB على hot reads:

- unread count كل 30 ثانية.
- chat conversations كل 15 ثانية.
- attendance overview كل 30 ثانية.
- branches كل 120 ثانية.
- auth user 120 ثانية.
- permissions 30 ثانية.

لماذا TTL قصير؟ لأن النظام operational. لا نريد بيانات قديمة لفترة طويلة. TTL قصير يعطي speed بدون التضحية الكبيرة بالfreshness.

## 45. Performance fix 8: Frontend RTK Query

بدل ما كل component يعمل fetch من الصفر، RTK Query يحتفظ بالنتيجة. في صفحات كثيرة يوجد `useMemo` لحساب derived data مثل filtered rows وchart data وcalendar items. هذا يمنع إعادة حساب مكلفة في كل render.

polling أيضا مضبوط. notification hooks غالبا polling كل 120 ثانية مع refetch on reconnect/focus. match-day live polling 15 ثانية لأنه live فعلا. الفرق مهم: لا نعمل polling سريع لكل الصفحات.

## 46. Performance fix 9: HTTP keepAlive في Next proxy وNginx

Next API proxy ينشئ agents:

- keepAlive true.
- max sockets configurable.
- max free sockets configurable.
- timeout upstream.

Nginx upstream عنده:

- `keepalive 32`
- worker_connections 4096.
- proxy_read_timeout وproxy_send_timeout.
- Socket.IO location يدعم Upgrade headers.

هذا يقلل overhead connections ويجعل reverse proxy مناسب للطلبات المتكررة.

## 47. Performance fix 10: Compression وpayload limits

Express يستخدم compression. هذا يقلل حجم responses النصية. أيضا body parser limit 512kb يمنع payloads ضخمة غير مقصودة في API JSON. uploads لها route ومحددات مختلفة.

تقليل bytes يعني سرعة أعلى، خصوصا على شبكات ضعيفة. limit يحمي memory والCPU من requests كبيرة.

## 48. Observability: إزاي نعرف الأداء فعلا؟

النظام لا يعتمد على الإحساس. فيه:

- slow HTTP request logging في app.js.
- slow PostgreSQL query logging في database.js.
- frontend dev API timing logs في baseQueryWithReauth.
- load test scripts في `golx-backend/load-tests`.
- health endpoint.
- ready endpoint يفحص PostgreSQL وRedis.

load tests تدعم profiles:

- smoke: 100، 500، 1000 active users.
- 10k-baseline.
- 16k-stress.
- 20k-target.
- 30min soak.
- socket-focused.

الأهداف المقترحة: error rate أقل من 0.5%، read p95 أقل من 800ms، write p95 أقل من 1500ms، p99 أقل من 3000ms، socket connect success أكثر من 99%.

مهم: لا يصح نقول النظام يضمن 20k users من قراءة الكود فقط. هذا يحتاج staging قريب من production وبيانات حقيقية أو synthetic قريبة.

## 49. Nginx وDocker topology

في production compose:

1. المستخدم يدخل على Nginx.
2. Nginx يوجه `/api/v1` إلى api.
3. Nginx يوجه `/socket.io` إلى api مع upgrade headers.
4. Nginx يوجه `/uploads` إلى api لأن الملفات protected.
5. باقي routes تذهب إلى frontend.
6. api يتصل بPostgreSQL وRedis.
7. worker يتصل بPostgreSQL وRedis.
8. migrate service يعمل migrations قبل api/worker.

الشكل الحالي ليس horizontal load balancing كامل لأن upstream فيه server واحد لكل من api/frontend. لكنه جاهز مفهوميا لإضافة replicas أو managed load balancer لاحقا.

## 50. Realtime: ليه Socket.IO؟

الشات والنوتيفيكيشن لا يناسبهما polling سريع فقط. Socket.IO يسمح للخادم يرسل event للعميل عندما يحدث شيء.

لكن النظام لا يعتمد على socket كمصدر حقيقة. الflow الصحيح:

1. احفظ في PostgreSQL.
2. invalidate caches.
3. أرسل socket event.
4. العميل يحدث UI.
5. عند reconnect أو event ضائع، العميل يعمل REST refresh.

لو عندك أكثر من API instance، Socket.IO Redis adapter يجعل event من instance يصل لمستخدم متصل على instance أخرى. لو Redis adapter غير متاح، realtime يصبح محليا للinstance فقط.

## 51. AI في architecture

AI module فيه نوعان من الأشياء:

1. API/service layer للوصول إلى scores وinjury risk والنظام يحميها بنفس access policy.
2. Python model helpers مثل ranking-model وinjury-risk-model.

`ranking-model.js` يشغل Python process ويحتوي in-memory cache لمدة 30 ثانية وmax entries 100. هذا الكاش داخل process واحد، وليس Redis. لو عندك workerين، كل worker له cache الخاص به.

ai.worker.js حاليا لا يشغل provider حقيقي؛ يرجع provider_not_configured. لذلك AI queue كarchitecture موجودة، لكن worker integration غير مكتمل.

## 52. Payments في architecture

Payments module موجود: plans، subscriptions، payments، payment overview. عند createSubscription، service يضيف job `generate-invoice`.

لكن payment.worker.js فيه TODOs:

- generate PDF invoice.
- store in storage.
- notify user.
- check expiring subscriptions.
- process refund with gateway.

إذن payments API موجودة جزئيا، لكن تكامل الدفع والفواتير الخلفية غير مكتمل كproduction-grade payment system.

## 53. Data lifecycle وbackups

مع نمو النظام، الجداول الساخنة مثل notifications/chat/audit لا يجب أن تكبر بلا حدود. Data lifecycle ينقل القديم إلى archive حسب policy. هذا يحسن الأداء لأن hot tables تبقى أصغر.

BackupService وسكربتات backup/restore موجودة. Production compose يخصص volume للbackups ويشغل backup automation حسب env.

لكن backup ليس مجرد إنشاء ملف. لازم restore drill. أي backup لم تختبر استرجاعه ليس backup موثوقا بالكامل.

## 54. Security وتأثيرها على الأداء

الأمان أحيانا يزيد خطوات، لكنه يمنع مشاكل أخطر:

- HttpOnly cookies تمنع JS من سرقة tokens بسهولة.
- CSRF يمنع mutations من مواقع أخرى.
- MFA للأدوار الإدارية.
- rate limits تمنع abuse.
- hpp وbody size limits يقللان requests المؤذية.
- protected uploads تمنع تسريب الملفات.
- audit logs تعطي trace.

الأداء الحقيقي لا يعني حذف الأمان. يعني تصميم الأمان بكفاءة: session cache، rate limit Redis store، protected upload headers، audit queue.

## 55. ما الذي يعتمد على Redis فعليا؟

| الاستخدام | هل هو cache فقط؟ | لو Redis وقع |
| --- | --- | --- |
| Auth session cache | نعم، optimization | يرجع لفحص DB session |
| Auth user/permissions cache | نعم | يرجع DB أو IAM calculation |
| Attendance/branches/chat/unread caches | نعم | cache miss ثم DB |
| Rate limits | لا، runtime counter | fallback memory، أقل دقة مع عدة instances |
| BullMQ queues | لا، queue storage | jobs لا تعمل أو skipped/throw حسب env |
| Socket.IO adapter | لا، pub/sub | realtime محلي فقط |
| Automation locks | لا، coordination | في production بعض automations skip لحماية التكرار |
| MFA challenge | temporary state | fallback PostgreSQL |

الخلاصة: Redis مهم جدا للتشغيل الكامل، لكنه ليس قاعدة البيانات الأساسية.

## 56. ما الذي يعتبر Job في السيستم؟

لو بنتكلم عن BullMQ job بالمعنى التقني، فالjobs الحالية هي التي تدخل queues الخمس: audit، rankings، notifications، payments، AI.

لو بنتكلم بمعنى أوسع عن background work، نضيف automations: reminders، cleanup، lifecycle، backups، weekly injury risk.

لكن هذه ليست jobs:

- فتح صفحة dashboard.
- قراءة players list.
- إنشاء player نفسه.
- حفظ message في DB.
- التحقق من صلاحية user.
- قراءة unread count من DB.

هذه operations عادية. قد ينتج عنها job جانبي، لكنها ليست job بذاتها.

## 57. أمثلة سؤال وجواب عشان تبقى جاهز

س: Queue بتخزن اللاعبين؟

ج: لا. اللاعبين في PostgreSQL. Queue تخزن job مؤقت، مثل "اكتب audit log" أو "ولد invoice" أو "احسب AI score".

س: Job يعني إيه؟

ج: أمر تنفيذ محفوظ: اسم المهمة، بياناتها، محاولاتها، حالتها. worker يقرأه وينفذه.

س: ليه ماننفذش كل حاجة مباشرة؟

ج: لأن بعض الشغل بطيء أو قابل للفشل أو غير لازم ينتظره المستخدم. queue تجعل المستخدم يأخذ response أسرع وتسمح بretry.

س: هل كل queues مكتملة؟

ج: لا. audit فعالة. notifications الخارجية وAI وpayments وranking workers فيها placeholders/TODOs. البنية جاهزة لكن التكاملات ليست كلها مكتملة.

س: Redis لو وقع البيانات تضيع؟

ج: بيانات business لا، لأنها في PostgreSQL. لكن jobs والكاش والrate limits الموزعة وSocket adapter تتأثر. audit عنده fallback مباشر.

س: Caching شغال إزاي؟

ج: service يبني key، يجرب Redis، لو hit يرجع. لو miss يسأل DB ويخزن النتيجة TTL. عند mutation يمسح key أو يزود version.

س: إيه الفرق بين Redis cache وRTK Query cache؟

ج: Redis على السيرفر ومشترك بين processes. RTK Query داخل المتصفح لكل user/session/tab تقريبا. الاتنين يسرعوا، لكن في طبقات مختلفة.

س: performance اتحسن بإيه؟

ج: indexes، حذف indexes متكررة، autovacuum tuning، DB pool/timeouts، Redis short caches، queue/worker separation، keepAlive، RTK Query، polling محدود، pagination clamps، slow logs، load-test tooling.

س: هل النظام جاهز ل20k active users؟

ج: architecture تسمح بالتحضير، لكن الإثبات يحتاج staging load test. لا نثبت 20k من الكود فقط.

## 58. حدود صريحة لازم تتقال

- API وworker منفصلان في production compose، وهذا جيد.
- Redis مطلوب production لأن queues/realtime/locks/rate limits تعتمد عليه.
- PostgreSQL source of truth، وليس Redis.
- Audit queue فعالة، لكن عدة workers أخرى placeholders.
- Nginx الحالي reverse proxy مع upstream واحد، وليس load balancer أفقي كامل.
- local storage مسموح في compose بإعداد خاص، لكن production الحقيقي الأفضل S3-compatible shared object storage.
- ranking queue لا تحسب فعليا في worker الحالي.
- يوجد duplicate function definition في `golx-backend/src/workers/index.js` ل`buildRedisConnection`. هذا لا يغير السلوك النهائي لأن الثانية تغطي الأولى، لكنه يستحق تنظيفا.
- إثبات الأداء يحتاج قياسات، لا افتراضات.

## 59. لو هتشرح النظام لحد في دقيقة واحدة

Goalix frontend مبني بNext.js وRTK Query. المستخدم يفتح صفحات حسب role. الطلبات تذهب إلى Next proxy ثم Express API. Express يطبق security وauth وCSRF وrate limits، ثم controller يستدعي service، وservice يستدعي repository، وrepository يقرأ أو يكتب PostgreSQL. PostgreSQL هو الحقيقة. Redis يساعد في cache وqueues وrealtime adapter وlocks. Jobs الخلفية تذهب إلى BullMQ queues في Redis، وworker process منفصل ينفذها. الأداء اتحسن عبر indexes، caching، pagination، keepAlive، workers منفصلة، timeouts، slow logs، وload-test tooling. لكن بعض integrations الخلفية مثل AI/payment/ranking workers ليست مكتملة بعد.

هذا القسم الوحيد القريب من الملخص. باقي الملف هو التفاصيل التي تخليك تفهم لماذا هذه الجملة صحيحة.

## 60. الملفات الأساسية التي بني عليها التقرير

- `package.json`
- `golx-backend/package.json`
- [[code:app/api/v1/[...path]/route.ts]]
- `proxy.ts`
- `lib/store/api/baseQuery.ts`
- `lib/api/csrf.ts`
- `lib/store/api/adminApi.ts`
- `lib/store/api/coachApi.ts`
- `lib/store/api/calendarApi.ts`
- `golx-backend/src/app.js`
- `golx-backend/src/server.js`
- `golx-backend/src/bootstrap/service-factory.js`
- `golx-backend/src/bootstrap/route-registry.js`
- `golx-backend/src/bootstrap/background-automations.js`
- `golx-backend/src/infrastructure/database.js`
- `golx-backend/src/infrastructure/redis.js`
- `golx-backend/src/infrastructure/queue.js`
- `golx-backend/src/workers/*.js`
- `golx-backend/src/shared/auth-session-cache.js`
- `golx-backend/src/shared/redis-json-cache.js`
- `golx-backend/src/shared/attendance-cache.js`
- `golx-backend/src/middleware/auth.middleware.js`
- `golx-backend/src/middleware/rateLimit.middleware.js`
- `golx-backend/src/middleware/csrf.middleware.js`
- `golx-backend/src/modules/notifications/notifications.service.js`
- `golx-backend/src/modules/chat/chat.service.js`
- `golx-backend/src/modules/attendance/attendance.service.js`
- `golx-backend/src/modules/academy/academy.service.js`
- `golx-backend/src/modules/ai/*.js`
- `golx-backend/migrations/072_performance_indexes.js`
- `golx-backend/migrations/074_training_attendance_indexes.js`
- `golx-backend/migrations/080_chat_auth_performance_indexes.js`
- `golx-backend/migrations/086_media_files_hardening_and_performance_indexes.js`
- `golx-backend/migrations/094_long_term_database_optimization.js`
- `docker-compose.prod.yml`
- `ops/nginx/nginx.prod.conf`
- `golx-backend/load-tests/README.md`
