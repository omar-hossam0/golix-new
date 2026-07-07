"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  HelpCircle,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type Role = "admin" | "coach" | "player" | "parent";
type HelpIcon = typeof HelpCircle;

type HelpSection = {
  title: string;
  icon: HelpIcon;
  items: string[];
};

type HelpWorkflow = {
  title: string;
  icon: HelpIcon;
  steps: string[];
};

type RoleHelpContent = {
  title: string;
  description: string;
  badge: string;
  heroTitle: string;
  heroText: string;
  importantCount: string;
  workflowLabel: string;
  sections: HelpSection[];
  workflows: HelpWorkflow[];
  safetyTitle: string;
  safetyRules: string[];
};

const roleHome: Record<Role, string> = {
  admin: "/admin/dashboard",
  coach: "/coach/home",
  player: "/player/home",
  parent: "/parent/home",
};

const roleCopy = {
  en: {
    dashboard: "Dashboard",
    help: "Help",
    dailyRules: "Daily rules",
    content: {
      admin: {
        title: "Admin Help",
        description: "Academy setup, permissions, reports, payments, and operational controls.",
        badge: "Admin workspace",
        heroTitle: "Run the academy from one controlled operating center.",
        heroText:
          "This guide focuses only on admin tasks: maintaining academy structure, managing users, controlling permissions, reviewing payments, and keeping reports reliable.",
        importantCount: "admin points",
        workflowLabel: "Admin workflow",
        sections: [
          {
            title: "Academy Structure",
            icon: Users,
            items: [
              "Create branches, birth years, and groups before adding players or assigning coaches.",
              "Keep player profiles complete so attendance, reports, ranking, and payments can read clean data.",
              "Use the Parents module for parent accounts and parent-player links.",
              "Use Coaches for coach profiles and assignments; do not manage coach scope from unrelated pages.",
            ],
          },
          {
            title: "Permissions",
            icon: ShieldCheck,
            items: [
              "Roles and permissions are for admin and coach access control.",
              "Grant sensitive permissions only to trusted staff.",
              "Review role changes before saving because they affect navigation and data access immediately.",
              "Avoid using one broad custom role for everyone; keep roles close to real responsibilities.",
            ],
          },
          {
            title: "Finance And Reports",
            icon: CreditCard,
            items: [
              "Use Payments to review subscriptions, invoices, overdue balances, and payment history.",
              "Use reports to audit attendance, player progress, coach activity, and revenue.",
              "If a report looks empty, check whether the source records were created from their correct modules.",
              "Treat payment, medical, and child data as sensitive academy information.",
            ],
          },
        ],
        workflows: [
          {
            title: "Add a player correctly",
            icon: Users,
            steps: [
              "Create or confirm the branch and group.",
              "Create the player from Players.",
              "Complete profile, sports, physical, and guardian details.",
              "Link parents from Parents if family access is needed.",
              "Confirm the player appears in attendance, schedule, and reports.",
            ],
          },
          {
            title: "Prepare access for staff",
            icon: ShieldCheck,
            steps: [
              "Create the coach account from Coaches.",
              "Assign the coach to the correct groups or birth years.",
              "Attach the right role or permissions.",
              "Ask the coach to sign in and confirm the visible player scope.",
            ],
          },
        ],
        safetyTitle: "Admin Safety",
        safetyRules: [
          "Do not share admin credentials.",
          "Keep role management limited.",
          "Review deleted or archived records before relying on reports.",
          "Use search and filters before making bulk decisions.",
        ],
      },
      coach: {
        title: "Coach Help",
        description: "Training, matches, attendance, evaluations, players, parents, and coach communication.",
        badge: "Coach workspace",
        heroTitle: "Manage your assigned players without leaving your coaching scope.",
        heroText:
          "This guide focuses only on coach work: assigned players, session planning, match preparation, attendance, evaluations, assignments, and communication.",
        importantCount: "coach points",
        workflowLabel: "Coach workflow",
        sections: [
          {
            title: "Assigned Players",
            icon: Users,
            items: [
              "Your player list depends on the groups, birth years, and permissions assigned to you.",
              "Use player profiles to review sports data, measurements, attendance, progress, and QR details.",
              "If a player is missing, check your assigned scope with an academy admin.",
              "Create parent links only from the Parents area when that permission is available.",
            ],
          },
          {
            title: "Training And Matches",
            icon: Dumbbell,
            items: [
              "Create and manage training sessions from Training or Calendar areas available to you.",
              "Record attendance from the session page; QR scanning is best for larger groups.",
              "Prepare matches from Matches and complete squad, tactics, attendance, and evaluations there.",
              "Finished matches and completed sessions feed player progress and rankings.",
            ],
          },
          {
            title: "Communication",
            icon: MessageSquare,
            items: [
              "Use Chats for direct communication with available academy contacts.",
              "Parent contacts appear only when linked to players inside your allowed scope.",
              "Notifications point you to the relevant training, match, assignment, or chat area.",
              "Do not share private player evaluation notes outside the system.",
            ],
          },
        ],
        workflows: [
          {
            title: "Run a training session",
            icon: CalendarDays,
            steps: [
              "Open the training session.",
              "Review time, group, location, and session plan.",
              "Mark attendance manually or by QR scan.",
              "Add evaluations when the session is complete.",
              "Confirm the status so reports update correctly.",
            ],
          },
          {
            title: "Prepare match day",
            icon: Trophy,
            steps: [
              "Open the match and check opponent, time, and location.",
              "Save squad and tactics.",
              "Record match attendance.",
              "Update live status and match events when needed.",
              "Finish the match before publishing final player evaluations.",
            ],
          },
        ],
        safetyTitle: "Coach Safety",
        safetyRules: [
          "Only edit records for players in your scope.",
          "Keep attendance accurate; it affects progress and reports.",
          "Do not publish evaluations until you have reviewed them.",
          "Sign in again if chat or realtime updates stop responding.",
        ],
      },
      player: {
        title: "Player Help",
        description: "Your schedule, training, matches, attendance, assignments, progress, and QR code.",
        badge: "Player workspace",
        heroTitle: "Follow your own football activity and stay ready for training and match days.",
        heroText:
          "This guide focuses only on the player experience: what you can see, what you can submit, where your QR is used, and how to follow your progress.",
        importantCount: "player points",
        workflowLabel: "Player workflow",
        sections: [
          {
            title: "Schedule And Training",
            icon: CalendarDays,
            items: [
              "Use Calendar or Training to see your visible sessions.",
              "Open a training session to review time, location, focus, equipment, and coach notes.",
              "Completed sessions may show attendance and coach evaluation details when published.",
              "If a session is missing, ask your coach to confirm it is assigned to your group.",
            ],
          },
          {
            title: "Matches And Progress",
            icon: Trophy,
            items: [
              "Use Matches to see match dates, opponent, location, and squad details when available.",
              "Progress pages show your own performance data only.",
              "Rankings and stats depend on completed attendance, evaluations, and match records.",
              "You cannot edit coach evaluations or attendance records.",
            ],
          },
          {
            title: "Assignments And QR",
            icon: QrCode,
            items: [
              "Use Assignments to view tasks and upload accepted files.",
              "Show your QR code to a coach when it is needed for attendance or linking.",
              "Keep QR brightness clear and avoid screenshots that are blurred or cropped.",
              "Use Chat to contact available coaches from your account.",
            ],
          },
        ],
        workflows: [
          {
            title: "Before training",
            icon: Dumbbell,
            steps: [
              "Check your next session time and location.",
              "Read any equipment or coach notes.",
              "Bring your QR-ready phone if QR attendance is used.",
              "After training, review attendance and feedback when published.",
            ],
          },
          {
            title: "Submit an assignment",
            icon: CheckCircle2,
            steps: [
              "Open Assignments.",
              "Read the instructions and due date.",
              "Upload the requested file type.",
              "Submit and check that the status updates.",
            ],
          },
        ],
        safetyTitle: "Player Safety",
        safetyRules: [
          "Do not share your login with anyone.",
          "Only upload files requested by your coach.",
          "Tell your coach if your schedule or attendance looks wrong.",
          "Use your own account; never use another player's account.",
        ],
      },
      parent: {
        title: "Parent Help",
        description: "Linked children, schedule, attendance, performance, matches, payments, and coach chat.",
        badge: "Parent workspace",
        heroTitle: "Track your linked children without seeing academy data that is not yours.",
        heroText:
          "This guide focuses only on parent access: switching children, checking schedule and matches, following attendance and performance, reviewing payments, and contacting coaches.",
        importantCount: "parent points",
        workflowLabel: "Parent workflow",
        sections: [
          {
            title: "Linked Children",
            icon: Users,
            items: [
              "Your dashboard only shows children linked to your parent account.",
              "Use the child switcher when more than one child is linked.",
              "If a child is missing, ask the academy to review the parent-player link.",
              "You cannot edit core player profile data from the parent workspace.",
            ],
          },
          {
            title: "Schedule And Progress",
            icon: CalendarDays,
            items: [
              "Use Schedule to see training sessions and matches in one place.",
              "Use child performance, attendance, and measurements to follow development.",
              "Match stats and evaluations appear only when the academy has recorded and published them.",
              "Notifications help you catch new schedule, match, payment, or chat updates.",
            ],
          },
          {
            title: "Payments And Chat",
            icon: CreditCard,
            items: [
              "Use Payments to review status, history, and outstanding invoices for linked children.",
              "Use Chat to contact available coaches when coach chat is enabled.",
              "Payment access can be limited per child by the academy.",
              "Keep payment and child data private.",
            ],
          },
        ],
        workflows: [
          {
            title: "Check a child's week",
            icon: CalendarDays,
            steps: [
              "Select the child from the switcher.",
              "Open Schedule.",
              "Review upcoming training and matches on the calendar.",
              "Open attendance or performance for more detail.",
            ],
          },
          {
            title: "Review payment status",
            icon: CreditCard,
            steps: [
              "Select the child.",
              "Open Payments.",
              "Review due invoices and payment history.",
              "Contact the academy if a payment record looks wrong.",
            ],
          },
        ],
        safetyTitle: "Parent Safety",
        safetyRules: [
          "Do not share your parent login.",
          "Use only your linked child data.",
          "Contact the academy if another child appears by mistake.",
          "Keep coach chat focused on academy communication.",
        ],
      },
    } satisfies Record<Role, RoleHelpContent>,
  },
  ar: {
    dashboard: "الرئيسية",
    help: "المساعدة",
    dailyRules: "قواعد يومية",
    content: {
      admin: {
        title: "مساعدة الأدمن",
        description: "إعداد الأكاديمية، الصلاحيات، التقارير، المدفوعات، والتحكم التشغيلي.",
        badge: "واجهة الأدمن",
        heroTitle: "أدر الأكاديمية من مركز تشغيل واضح ومتحكم فيه.",
        heroText:
          "هذا الدليل مخصص لمهام الأدمن فقط: هيكل الأكاديمية، المستخدمين، الصلاحيات، المدفوعات، والتقارير.",
        importantCount: "نقاط للأدمن",
        workflowLabel: "خطوات الأدمن",
        sections: [
          {
            title: "هيكل الأكاديمية",
            icon: Users,
            items: [
              "أنشئ الفروع وسنوات الميلاد والمجموعات قبل إضافة اللاعبين أو ربط المدربين.",
              "أكمل ملفات اللاعبين حتى تعمل الحضور والتقارير والترتيب والمدفوعات بشكل صحيح.",
              "استخدم Parents لإنشاء حسابات أولياء الأمور وربطهم باللاعبين.",
              "استخدم Coaches لإدارة المدربين ونطاق عمل كل مدرب.",
            ],
          },
          {
            title: "الصلاحيات",
            icon: ShieldCheck,
            items: [
              "الأدوار والصلاحيات مخصصة للتحكم في وصول الأدمن والمدربين.",
              "امنح الصلاحيات الحساسة للمسؤولين الموثوقين فقط.",
              "راجع أي تعديل في الدور قبل الحفظ لأنه يؤثر على الوصول مباشرة.",
              "اجعل كل دور مناسبًا لمسؤولية واضحة بدل دور واسع للجميع.",
            ],
          },
          {
            title: "المدفوعات والتقارير",
            icon: CreditCard,
            items: [
              "راجع الاشتراكات والفواتير والمتأخرات وسجل الدفع من Payments.",
              "استخدم التقارير لمراجعة الحضور وتقدم اللاعبين وأداء المدربين والإيرادات.",
              "إذا كان التقرير فارغًا، راجع مصدر البيانات في الموديول الصحيح.",
              "تعامل مع بيانات الدفع والبيانات الطبية وبيانات الأطفال كبيانات حساسة.",
            ],
          },
        ],
        workflows: [
          {
            title: "إضافة لاعب بشكل صحيح",
            icon: Users,
            steps: [
              "أنشئ أو راجع الفرع والمجموعة.",
              "أضف اللاعب من Players.",
              "أكمل بيانات الملف الرياضي والبدني وبيانات ولي الأمر.",
              "اربط ولي الأمر من Parents عند الحاجة.",
              "تأكد أن اللاعب يظهر في الحضور والجدول والتقارير.",
            ],
          },
          {
            title: "تجهيز وصول المدرب",
            icon: ShieldCheck,
            steps: [
              "أنشئ حساب المدرب من Coaches.",
              "اربط المدرب بالمجموعات أو سنوات الميلاد المناسبة.",
              "اختر الدور أو الصلاحيات المناسبة.",
              "اطلب من المدرب تسجيل الدخول ومراجعة نطاق اللاعبين الظاهر له.",
            ],
          },
        ],
        safetyTitle: "أمان الأدمن",
        safetyRules: [
          "لا تشارك بيانات دخول الأدمن.",
          "اجعل إدارة الأدوار محدودة.",
          "راجع السجلات المحذوفة أو المؤرشفة قبل الاعتماد على التقارير.",
          "استخدم البحث والفلاتر قبل أي قرارات كبيرة.",
        ],
      },
      coach: {
        title: "مساعدة المدرب",
        description: "التدريب، المباريات، الحضور، التقييمات، اللاعبين، أولياء الأمور، والتواصل.",
        badge: "واجهة المدرب",
        heroTitle: "أدر لاعبيك داخل نطاقك التدريبي فقط.",
        heroText:
          "هذا الدليل مخصص للمدرب فقط: اللاعبين المسموحين، التخطيط للحصص، المباريات، الحضور، التقييمات، الواجبات، والتواصل.",
        importantCount: "نقاط للمدرب",
        workflowLabel: "خطوات المدرب",
        sections: [
          {
            title: "اللاعبون في نطاقك",
            icon: Users,
            items: [
              "قائمة اللاعبين تعتمد على المجموعات وسنوات الميلاد والصلاحيات الممنوحة لك.",
              "استخدم ملف اللاعب لمراجعة البيانات الرياضية والقياسات والحضور والتقدم وQR.",
              "إذا لم يظهر لاعب، راجع نطاقك مع إدارة الأكاديمية.",
              "اربط أولياء الأمور من Parents فقط إذا كانت الصلاحية متاحة لك.",
            ],
          },
          {
            title: "التدريب والمباريات",
            icon: Dumbbell,
            items: [
              "أنشئ وأدر الحصص من Training أو Calendar حسب المتاح لك.",
              "سجل الحضور من صفحة الحصة، واستخدم QR عند وجود عدد كبير.",
              "جهز المباراة من Matches ثم أكمل القائمة والخطة والحضور والتقييمات.",
              "الحصص المكتملة والمباريات المنتهية تغذي تقدم اللاعب والترتيب.",
            ],
          },
          {
            title: "التواصل",
            icon: MessageSquare,
            items: [
              "استخدم Chats للتواصل مع جهات الاتصال المتاحة.",
              "أولياء الأمور يظهرون عند ربطهم بلاعبين داخل نطاقك.",
              "الإشعارات توجهك للحصة أو المباراة أو الواجب أو المحادثة المناسبة.",
              "لا تشارك ملاحظات تقييم اللاعبين خارج النظام.",
            ],
          },
        ],
        workflows: [
          {
            title: "إدارة حصة تدريبية",
            icon: CalendarDays,
            steps: [
              "افتح الحصة التدريبية.",
              "راجع الوقت والمجموعة والمكان والخطة.",
              "سجل الحضور يدويًا أو باستخدام QR.",
              "أضف التقييمات بعد اكتمال الحصة.",
              "أكد الحالة حتى تتحدث التقارير.",
            ],
          },
          {
            title: "تجهيز يوم المباراة",
            icon: Trophy,
            steps: [
              "افتح المباراة وراجع المنافس والوقت والمكان.",
              "احفظ القائمة والخطة.",
              "سجل حضور المباراة.",
              "حدث حالة المباراة والأحداث عند الحاجة.",
              "أنهِ المباراة قبل نشر تقييمات اللاعبين النهائية.",
            ],
          },
        ],
        safetyTitle: "أمان المدرب",
        safetyRules: [
          "عدّل سجلات اللاعبين داخل نطاقك فقط.",
          "اجعل الحضور دقيقًا لأنه يؤثر على التقارير.",
          "لا تنشر التقييمات قبل مراجعتها.",
          "سجل الدخول مرة أخرى إذا توقفت المحادثة أو التحديثات الحية.",
        ],
      },
      player: {
        title: "مساعدة اللاعب",
        description: "جدولك، التمرين، المباريات، الحضور، الواجبات، التقدم، وQR.",
        badge: "واجهة اللاعب",
        heroTitle: "تابع نشاطك الرياضي واستعد للحصص والمباريات.",
        heroText:
          "هذا الدليل مخصص لتجربة اللاعب فقط: ما يمكنك رؤيته، ما يمكنك تسليمه، أين يستخدم QR، وكيف تتابع تقدمك.",
        importantCount: "نقاط للاعب",
        workflowLabel: "خطوات اللاعب",
        sections: [
          {
            title: "الجدول والتدريب",
            icon: CalendarDays,
            items: [
              "استخدم Calendar أو Training لرؤية الحصص الظاهرة لك.",
              "افتح الحصة لمراجعة الوقت والمكان والتركيز والمعدات وملاحظات المدرب.",
              "الحصص المكتملة قد تعرض الحضور والتقييم عند نشرهم.",
              "إذا لم تظهر حصة، اسأل المدرب هل هي مرتبطة بمجموعتك.",
            ],
          },
          {
            title: "المباريات والتقدم",
            icon: Trophy,
            items: [
              "استخدم Matches لرؤية التاريخ والمنافس والمكان والقائمة عند توفرها.",
              "صفحات التقدم تعرض بياناتك أنت فقط.",
              "الترتيب والإحصائيات تعتمد على الحضور والتقييمات والمباريات المكتملة.",
              "لا يمكنك تعديل تقييمات المدرب أو سجلات الحضور.",
            ],
          },
          {
            title: "الواجبات وQR",
            icon: QrCode,
            items: [
              "استخدم Assignments لرؤية المهام ورفع الملفات المسموحة.",
              "اعرض QR للمدرب عند الحاجة للحضور أو الربط.",
              "حافظ على وضوح QR وتجنب الصور المهزوزة أو المقصوصة.",
              "استخدم Chat للتواصل مع المدربين المتاحين.",
            ],
          },
        ],
        workflows: [
          {
            title: "قبل التمرين",
            icon: Dumbbell,
            steps: [
              "راجع موعد ومكان الحصة القادمة.",
              "اقرأ أي معدات أو ملاحظات مطلوبة.",
              "جهز QR إذا كان الحضور بالمسح.",
              "بعد الحصة راجع الحضور والتقييم عند نشرهم.",
            ],
          },
          {
            title: "تسليم واجب",
            icon: CheckCircle2,
            steps: [
              "افتح Assignments.",
              "اقرأ التعليمات وموعد التسليم.",
              "ارفع الملف المطلوب.",
              "اضغط Submit وتأكد من تغير الحالة.",
            ],
          },
        ],
        safetyTitle: "أمان اللاعب",
        safetyRules: [
          "لا تشارك حسابك مع أي شخص.",
          "ارفع الملفات المطلوبة من المدرب فقط.",
          "أخبر المدرب إذا كان جدولك أو حضورك غير صحيح.",
          "استخدم حسابك أنت فقط.",
        ],
      },
      parent: {
        title: "مساعدة ولي الأمر",
        description: "الأبناء المرتبطون، الجدول، الحضور، الأداء، المباريات، المدفوعات، ومحادثة المدرب.",
        badge: "واجهة ولي الأمر",
        heroTitle: "تابع أبناءك المرتبطين فقط بدون رؤية بيانات لا تخصك.",
        heroText:
          "هذا الدليل مخصص لولي الأمر فقط: تبديل الأبناء، مراجعة الجدول والمباريات، متابعة الحضور والأداء، المدفوعات، والتواصل مع المدربين.",
        importantCount: "نقاط لولي الأمر",
        workflowLabel: "خطوات ولي الأمر",
        sections: [
          {
            title: "الأبناء المرتبطون",
            icon: Users,
            items: [
              "لوحتك تعرض الأبناء المرتبطين بحسابك فقط.",
              "استخدم مبدل الأبناء إذا كان لديك أكثر من لاعب.",
              "إذا لم يظهر ابنك، اطلب من الأكاديمية مراجعة الربط.",
              "لا يمكنك تعديل بيانات اللاعب الأساسية من واجهة ولي الأمر.",
            ],
          },
          {
            title: "الجدول والتقدم",
            icon: CalendarDays,
            items: [
              "استخدم Schedule لرؤية التمرينات والمباريات في مكان واحد.",
              "استخدم الأداء والحضور والقياسات لمتابعة تطور اللاعب.",
              "إحصائيات المباراة والتقييمات تظهر عند تسجيلها ونشرها من الأكاديمية.",
              "الإشعارات تساعدك في متابعة الجدول والمباريات والمدفوعات والمحادثات.",
            ],
          },
          {
            title: "المدفوعات والمحادثة",
            icon: CreditCard,
            items: [
              "استخدم Payments لمراجعة الحالة والسجل والفواتير المستحقة.",
              "استخدم Chat للتواصل مع المدربين عند تفعيل الصلاحية.",
              "إمكانية رؤية المدفوعات قد تختلف من لاعب لآخر حسب إعداد الأكاديمية.",
              "حافظ على خصوصية بيانات الدفع وبيانات الأبناء.",
            ],
          },
        ],
        workflows: [
          {
            title: "مراجعة أسبوع اللاعب",
            icon: CalendarDays,
            steps: [
              "اختر اللاعب من المبدل.",
              "افتح Schedule.",
              "راجع التمرينات والمباريات القادمة في التقويم.",
              "افتح الحضور أو الأداء لمزيد من التفاصيل.",
            ],
          },
          {
            title: "مراجعة الدفع",
            icon: CreditCard,
            steps: [
              "اختر اللاعب.",
              "افتح Payments.",
              "راجع الفواتير المستحقة وسجل الدفع.",
              "تواصل مع الأكاديمية إذا وجدت بيانات دفع غير صحيحة.",
            ],
          },
        ],
        safetyTitle: "أمان ولي الأمر",
        safetyRules: [
          "لا تشارك بيانات دخولك.",
          "استخدم بيانات الأبناء المرتبطين بك فقط.",
          "تواصل مع الأكاديمية إذا ظهر لاعب لا يخصك.",
          "اجعل محادثة المدرب خاصة بالتواصل الأكاديمي.",
        ],
      },
    } satisfies Record<Role, RoleHelpContent>,
  },
} as const;

function InfoCard({
  title,
  icon: Icon,
  label,
  children,
}: {
  title: string;
  icon: HelpIcon;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50 bg-card/90 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          {label && <Badge variant="outline">{label}</Badge>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SystemHelpPage({ role }: { role: Role }) {
  const language = useDashboardLanguage();
  const t = roleCopy[language];
  const content = t.content[role];
  const isArabic = language === "ar";

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <PageHeader
        title={content.title}
        description={content.description}
        breadcrumbs={[
          { label: t.dashboard, href: roleHome[role] },
          { label: t.help },
        ]}
      />

      <section className="rounded-lg border border-border/50 bg-card/90 p-6 shadow-none lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-4xl">
            <Badge variant="info">{content.badge}</Badge>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-foreground lg:text-5xl">
              {content.heroTitle}
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-8 text-muted-foreground lg:text-base">
              {content.heroText}
            </p>
          </div>
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary lg:h-32 lg:w-32">
            <ShieldCheck className="h-12 w-12 lg:h-16 lg:w-16" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {content.sections.map((section) => (
          <InfoCard
            key={section.title}
            title={section.title}
            icon={section.icon}
            label={`${section.items.length} ${content.importantCount}`}
          >
            <ul className="space-y-3 text-sm font-semibold leading-7 text-muted-foreground">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {content.workflows.map((workflow) => (
          <InfoCard
            key={workflow.title}
            title={workflow.title}
            icon={workflow.icon}
            label={content.workflowLabel}
          >
            <ol className="space-y-3 text-sm font-semibold leading-7 text-muted-foreground">
              {workflow.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-black text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </InfoCard>
        ))}
      </div>

      <InfoCard title={content.safetyTitle} icon={AlertTriangle} label={t.dailyRules}>
        <ul className="grid gap-3 md:grid-cols-2">
          {content.safetyRules.map((rule) => (
            <li
              key={rule}
              className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm font-semibold leading-7 text-muted-foreground"
            >
              {rule}
            </li>
          ))}
        </ul>
      </InfoCard>
    </div>
  );
}
