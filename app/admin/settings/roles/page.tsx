"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminRole,
  type AdminAccessUser,
  useAssignAdminRoleToUserMutation,
  useCreateAdminAccessUserMutation,
  useCreateAdminRoleMutation,
  useDeleteAdminRoleMutation,
  useGetAdminAccessControlQuery,
  useGetCurrentUserQuery,
  useRevokeAdminRoleFromUserMutation,
  useUpdateAdminRoleMutation,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type RoleDraft = {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

type RoleEdit = Partial<RoleDraft> & { permissionIds?: string[] };

type NewAccessUserDraft = {
  fullName: string;
  accountRole: "admin";
  email: string;
  phone: string;
  username: string;
  password: string;
  address: string;
  jobTitle: string;
  department: string;
  notes: string;
};

const emptyAccessUserDraft: NewAccessUserDraft = {
  fullName: "",
  accountRole: "admin",
  email: "",
  phone: "",
  username: "",
  password: "",
  address: "",
  jobTitle: "",
  department: "",
  notes: "",
};

const roleEditLockStorageKey = "goalix-admin-role-edit-locks";

const readStoredEditLocks = () => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(roleEditLockStorageKey);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set<string>(
      Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
    );
  } catch {
    return new Set<string>();
  }
};

const hiddenPortalRoleCodes = new Set([
  "coach",
  "head_coach",
  "assistant_coach",
  "player",
  "parent",
  "parent_guardian",
]);

const protectedRoleCodes = new Set([
  "super_admin",
  "academy_owner",
  ...hiddenPortalRoleCodes,
]);

const adminPortalPermissionCodes = new Set([
  "access_admin_dashboard",
  "admin.dashboard.access",
  "manage_users",
  "admin.user.create",
  "admin.user.update",
  "manage_teams",
  "admin.group.manage",
  "manage_coaches",
  "coach.read.branch",
  "coach.read.academy",
  "coach.create",
  "coach.update",
  "manage_players",
  "player.read.branch",
  "player.read.academy",
  "player.create",
  "player.update",
  "manage_schedules",
  "calendar.manage.academy",
  "manage_attendance",
  "attendance.view.branch",
  "attendance.view.academy",
  "attendance.export",
  "ranking.read.branch",
  "ranking.read.academy",
  "view_financial_reports",
  "payment.read.academy",
  "payment.export",
  "manage_subscriptions",
  "manage_payments",
  "manage_academy_settings",
  "admin.settings.update",
  "manage_roles",
  "manage_permissions",
  "admin.role.manage",
]);

const rolePermissionIds = (role: AdminRole | undefined) =>
  new Set(
    (role?.permissionAssignments ?? [])
      .filter((assignment) => !assignment.denied)
      .map((assignment) => assignment.permissionId),
  );

const toRoleCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]+/, "");

const editableCopyCode = (role: AdminRole) => {
  const suffix = Math.random().toString(36).slice(2, 7);
  return toRoleCode(`${role.code}_custom_${suffix}`).slice(0, 60);
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (
    typeof err === "object" &&
    err &&
    "data" in err &&
    typeof err.data === "object" &&
    err.data &&
    "error" in err.data &&
    typeof err.data.error === "object" &&
    err.data.error &&
    "message" in err.data.error
  ) {
    const message = String(err.data.error.message);
    const details =
      "details" in err.data.error && Array.isArray(err.data.error.details)
        ? err.data.error.details
        : [];
    const detailMessages = details
      .map((detail) => {
        if (
          typeof detail === "object" &&
          detail &&
          "message" in detail
        ) {
          const field =
            "field" in detail && detail.field
              ? `${String(detail.field)}: `
              : "";
          return `${field}${String(detail.message)}`;
        }
        return "";
      })
      .filter(Boolean);

    return detailMessages.length
      ? `${message}: ${detailMessages.join(" • ")}`
      : message;
  }

  return fallback;
};

const rolesCopy = {
  en: {
    passwordMin: "Password must be at least 8 characters.",
    passwordUppercase: "Password must contain at least one uppercase letter.",
    passwordDigit: "Password must contain at least one digit.",
    passwordSpecial: "Password must contain at least one special character.",
    usernameMin: "Username must be at least 3 characters.",
    usernameMax: "Username must be 60 characters or less.",
    usernamePattern: "Username may only contain letters, numbers, dots, underscores, and hyphens.",
    accountRoleHelp: "Roles settings is for admin/staff access only. Coaches are assigned from /admin/coaches/assign, parents from /admin/parents, and players from /admin/players.",
    roleEditingEnabled: "Role editing enabled.",
    roleEditingDisabled: "Role editing disabled.",
    roleNameCodeRequired: "Role name and code are required.",
    roleCreated: "Role created.",
    createRoleError: "Could not create role.",
    editableCopyName: "Custom",
    editableCopyDescription: "Editable copy of {role}.",
    editableCopyCreated: "Editable custom role created. You can now change permissions and save.",
    editableCopyError: "Could not create editable copy.",
    selectRoleError: "Select a role before adding a user.",
    protectedRoleError: "This is a protected system role and cannot be assigned from this screen.",
    roleAssignError: "This role cannot be assigned from this screen.",
    requiredUserFields: "Name, phone, username, and password are required.",
    userCreated: "User created. Login from {path} using username \"{username}\".",
    createUserError: "Could not create user.",
    validRoleRequired: "Role name and valid code are required.",
    roleSaved: "Role saved.",
    saveRoleError: "Could not save role.",
    roleDeleted: "Role deleted.",
    deleteRoleError: "Could not delete role.",
    incompatibleUserRole: "{user} uses {role} login, but {help}",
    roleRemoved: "Role removed from user.",
    roleAssigned: "Role assigned to user.",
    updateUserRoleError: "Could not update user role.",
    loadError: "Access control data could not load.",
    pageTitle: "Roles & Permissions",
    pageDescription: "Manage academy roles and permission grants.",
    dashboard: "Dashboard",
    settings: "Settings",
    newCustomRole: "New Custom Role",
    operationsManager: "Operations Manager",
    code: "Code",
    operationsManagerCode: "operations_manager",
    addRole: "Add Role",
    roles: "Roles",
    system: "System",
    custom: "Custom",
    users: "users",
    permissions: "permissions",
    noRoles: "No roles found.",
    selectRole: "Select Role",
    active: "Active",
    inactive: "Inactive",
    editingOff: "Editing Off",
    editingOn: "Editing On",
    name: "Name",
    description: "Description",
    roleActive: "Role Active",
    editLockedHelp: "Editing is currently disabled for this custom role. Enable editing to change permissions.",
    systemRoleHelp: "System roles are read-only. Create an editable custom copy to add or remove permissions.",
    enableEditing: "Enable Editing",
    makeEditableCopy: "Make Editable Copy",
    editableHelp: "This custom role is editable. Disable editing when you want to protect it from accidental changes.",
    disableEditing: "Disable Editing",
    noDashboardAccess: "This role does not include admin dashboard access. Users can still hold it, but admin pages will remain hidden until this role grants dashboard access.",
    addUserTitle: "Add User to This Role",
    addUserDescription: "Create an admin/staff account and assign only {role}. Coaches, parents, and players are managed from their dedicated pages.",
    login: "Login",
    protectedRoleAssignHelp: "This protected system role cannot be assigned here. Create a custom role or use a lower-privilege system role.",
    loginTypeAdjusted: "Login type was adjusted automatically.",
    loginType: "Login Type",
    staffAdminLogin: "Staff / Admin Login",
    emailOptional: "Email (optional)",
    emailPlaceholder: "optional@example.com",
    phone: "Phone",
    phonePlaceholder: "+201000000000",
    username: "Username",
    usernamePlaceholder: "ahmed.hassan",
    password: "Password",
    passwordPlaceholder: "At least 8 chars, uppercase, number, symbol",
    passwordHelp: "Required: 8+ chars, uppercase letter, number, and symbol.",
    address: "Address",
    addressPlaceholder: "City, street, area",
    jobTitle: "Job Title",
    department: "Department",
    departmentPlaceholder: "Administration",
    notes: "Notes",
    notesPlaceholder: "Internal notes for this user",
    addUserAssign: "Add User & Assign Role",
    assignedUsers: "Assigned Users",
    assignedUsersDescription: "Grant or revoke this role for admin/staff users only. Coach, player, and parent access is managed from their dedicated pages.",
    assigned: "assigned",
    searchUsersPlaceholder: "Search users by name, email, username, or role",
    noLoginLabel: "No login label",
    selfProtected: "self protected",
    needsAdminLogin: "needs admin login",
    assignedStatus: "Assigned",
    notAssignedStatus: "Not assigned",
    noUsersMatch: "No users match this search.",
    editable: "Editable",
    editingDisabled: "Editing disabled",
    readOnlySystemRole: "Read-only system role",
    permissionGrantTitle: "Click to grant or remove this permission",
    editFirstTitle: "Editing is disabled for this custom role. Enable editing first.",
    makeCopyFirstTitle: "System role permissions are read-only. Make an editable copy first.",
    noPermissions: "No permissions found.",
    saveDeleteEditOff: "Save/Delete are disabled because editing is off for this custom role.",
    saveDeleteSystem: "Save/Delete are disabled because this is a system role.",
    saveRole: "Save Role",
    deleteRole: "Delete Role",
  },
  ar: {
    passwordMin: "كلمة المرور يجب ألا تقل عن 8 أحرف.",
    passwordUppercase: "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل.",
    passwordDigit: "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.",
    passwordSpecial: "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل.",
    usernameMin: "اسم المستخدم يجب ألا يقل عن 3 أحرف.",
    usernameMax: "اسم المستخدم يجب ألا يزيد عن 60 حرفًا.",
    usernamePattern: "اسم المستخدم يمكن أن يحتوي على حروف وأرقام ونقاط وشرطات سفلية وشرطات فقط.",
    accountRoleHelp: "إعدادات الصلاحيات مخصصة لحسابات الإدارة والموظفين فقط. يتم تعيين المدربين من /admin/coaches/assign، والأولياء من /admin/parents، واللاعبين من /admin/players.",
    roleEditingEnabled: "تم تفعيل تعديل الدور.",
    roleEditingDisabled: "تم تعطيل تعديل الدور.",
    roleNameCodeRequired: "اسم الدور والكود مطلوبان.",
    roleCreated: "تم إنشاء الدور.",
    createRoleError: "تعذر إنشاء الدور.",
    editableCopyName: "نسخة مخصصة",
    editableCopyDescription: "نسخة قابلة للتعديل من {role}.",
    editableCopyCreated: "تم إنشاء دور مخصص قابل للتعديل. يمكنك الآن تعديل الصلاحيات والحفظ.",
    editableCopyError: "تعذر إنشاء نسخة قابلة للتعديل.",
    selectRoleError: "اختر دورًا قبل إضافة مستخدم.",
    protectedRoleError: "هذا دور نظام محمي ولا يمكن تعيينه من هذه الشاشة.",
    roleAssignError: "لا يمكن تعيين هذا الدور من هذه الشاشة.",
    requiredUserFields: "الاسم والهاتف واسم المستخدم وكلمة المرور مطلوبة.",
    userCreated: "تم إنشاء المستخدم. سجّل الدخول من {path} باسم المستخدم \"{username}\".",
    createUserError: "تعذر إنشاء المستخدم.",
    validRoleRequired: "اسم الدور وكود صحيح مطلوبان.",
    roleSaved: "تم حفظ الدور.",
    saveRoleError: "تعذر حفظ الدور.",
    roleDeleted: "تم حذف الدور.",
    deleteRoleError: "تعذر حذف الدور.",
    incompatibleUserRole: "{user} يستخدم تسجيل دخول {role}، لكن {help}",
    roleRemoved: "تمت إزالة الدور من المستخدم.",
    roleAssigned: "تم تعيين الدور للمستخدم.",
    updateUserRoleError: "تعذر تحديث دور المستخدم.",
    loadError: "تعذر تحميل بيانات التحكم في الوصول.",
    pageTitle: "الأدوار والصلاحيات",
    pageDescription: "إدارة أدوار الأكاديمية ومنح الصلاحيات.",
    dashboard: "لوحة التحكم",
    settings: "الإعدادات",
    newCustomRole: "دور مخصص جديد",
    operationsManager: "مدير العمليات",
    code: "الكود",
    operationsManagerCode: "operations_manager",
    addRole: "إضافة دور",
    roles: "الأدوار",
    system: "نظام",
    custom: "مخصص",
    users: "مستخدمين",
    permissions: "صلاحيات",
    noRoles: "لا توجد أدوار.",
    selectRole: "اختر دورًا",
    active: "نشط",
    inactive: "غير نشط",
    editingOff: "التعديل متوقف",
    editingOn: "التعديل مفعل",
    name: "الاسم",
    description: "الوصف",
    roleActive: "الدور نشط",
    editLockedHelp: "التعديل معطل حاليًا لهذا الدور المخصص. فعّل التعديل لتغيير الصلاحيات.",
    systemRoleHelp: "أدوار النظام للقراءة فقط. أنشئ نسخة مخصصة قابلة للتعديل لإضافة أو إزالة الصلاحيات.",
    enableEditing: "تفعيل التعديل",
    makeEditableCopy: "إنشاء نسخة قابلة للتعديل",
    editableHelp: "هذا الدور المخصص قابل للتعديل. عطّل التعديل عندما تريد حمايته من التغييرات غير المقصودة.",
    disableEditing: "تعطيل التعديل",
    noDashboardAccess: "هذا الدور لا يتضمن صلاحية دخول لوحة الإدارة. يمكن للمستخدمين الاحتفاظ به، لكن صفحات الإدارة ستظل مخفية حتى يمنح الدور صلاحية الدخول.",
    addUserTitle: "إضافة مستخدم لهذا الدور",
    addUserDescription: "أنشئ حساب إدارة/موظف وعيّنه فقط على {role}. تتم إدارة المدربين والأولياء واللاعبين من صفحاتهم المخصصة.",
    login: "تسجيل الدخول",
    protectedRoleAssignHelp: "لا يمكن تعيين هذا الدور النظامي المحمي هنا. أنشئ دورًا مخصصًا أو استخدم دور نظام بصلاحيات أقل.",
    loginTypeAdjusted: "تم ضبط نوع تسجيل الدخول تلقائيًا.",
    loginType: "نوع تسجيل الدخول",
    staffAdminLogin: "تسجيل دخول موظف / إدارة",
    emailOptional: "البريد الإلكتروني (اختياري)",
    emailPlaceholder: "optional@example.com",
    phone: "الهاتف",
    phonePlaceholder: "+201000000000",
    username: "اسم المستخدم",
    usernamePlaceholder: "ahmed.hassan",
    password: "كلمة المرور",
    passwordPlaceholder: "8 أحرف على الأقل، حرف كبير، رقم، رمز",
    passwordHelp: "المطلوب: 8+ أحرف، حرف كبير، رقم، ورمز.",
    address: "العنوان",
    addressPlaceholder: "المدينة، الشارع، المنطقة",
    jobTitle: "المسمى الوظيفي",
    department: "القسم",
    departmentPlaceholder: "الإدارة",
    notes: "ملاحظات",
    notesPlaceholder: "ملاحظات داخلية لهذا المستخدم",
    addUserAssign: "إضافة مستخدم وتعيين الدور",
    assignedUsers: "المستخدمون المعينون",
    assignedUsersDescription: "امنح أو اسحب هذا الدور لمستخدمي الإدارة/الموظفين فقط. تتم إدارة صلاحيات المدربين واللاعبين والأولياء من صفحاتهم المخصصة.",
    assigned: "معين",
    searchUsersPlaceholder: "ابحث بالاسم أو البريد أو اسم المستخدم أو الدور",
    noLoginLabel: "لا يوجد تعريف دخول",
    selfProtected: "محمي لأنه حسابك",
    needsAdminLogin: "يحتاج تسجيل دخول إداري",
    assignedStatus: "معين",
    notAssignedStatus: "غير معين",
    noUsersMatch: "لا يوجد مستخدمون مطابقون للبحث.",
    editable: "قابل للتعديل",
    editingDisabled: "التعديل معطل",
    readOnlySystemRole: "دور نظام للقراءة فقط",
    permissionGrantTitle: "اضغط لمنح أو إزالة هذه الصلاحية",
    editFirstTitle: "التعديل معطل لهذا الدور المخصص. فعّل التعديل أولًا.",
    makeCopyFirstTitle: "صلاحيات دور النظام للقراءة فقط. أنشئ نسخة قابلة للتعديل أولًا.",
    noPermissions: "لا توجد صلاحيات.",
    saveDeleteEditOff: "الحفظ/الحذف معطلان لأن التعديل متوقف لهذا الدور المخصص.",
    saveDeleteSystem: "الحفظ/الحذف معطلان لأن هذا دور نظام.",
    saveRole: "حفظ الدور",
    deleteRole: "حذف الدور",
  },
} as const;

type RolesCopy = (typeof rolesCopy)[keyof typeof rolesCopy];

const validatePassword = (password: string, t: RolesCopy) => {
  if (password.length < 8) return t.passwordMin;
  if (!/[A-Z]/.test(password)) return t.passwordUppercase;
  if (!/[0-9]/.test(password)) return t.passwordDigit;
  if (!/[^A-Za-z0-9]/.test(password)) return t.passwordSpecial;
  return "";
};

const validateUsername = (username: string, t: RolesCopy) => {
  const value = username.trim();
  if (value.length < 3) return t.usernameMin;
  if (value.length > 60) return t.usernameMax;
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    return t.usernamePattern;
  }
  return "";
};

const displayUserName = (user: AdminAccessUser) =>
  user.fullName || user.email || user.username || user.phone || user.role;

export default function RolesPage() {
  const language = useDashboardLanguage();
  const t = rolesCopy[language];
  const { data, isLoading, isError } = useGetAdminAccessControlQuery();
  const { data: currentUser } = useGetCurrentUserQuery();
  const [createRole, { isLoading: creating }] = useCreateAdminRoleMutation();
  const [createAccessUser, { isLoading: creatingUser }] =
    useCreateAdminAccessUserMutation();
  const [updateRole, { isLoading: saving }] = useUpdateAdminRoleMutation();
  const [deleteRole, { isLoading: deleting }] = useDeleteAdminRoleMutation();
  const [assignRole, { isLoading: assigning }] = useAssignAdminRoleToUserMutation();
  const [revokeRole, { isLoading: revoking }] = useRevokeAdminRoleFromUserMutation();

  const roles = useMemo(
    () =>
      (data?.roles ?? []).filter((role) => !hiddenPortalRoleCodes.has(role.code)),
    [data?.roles],
  );
  const users = useMemo(
    () => (data?.users ?? []).filter((user) => user.role === "admin"),
    [data?.users],
  );
  const permissionGroups = useMemo(
    () => data?.permissionGroups ?? [],
    [data?.permissionGroups],
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [newUser, setNewUser] =
    useState<NewAccessUserDraft>(emptyAccessUserDraft);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const [editLockedRoleIds, setEditLockedRoleIds] = useState<Set<string>>(
    readStoredEditLocks,
  );
  const selectedRoleEditLocked = Boolean(
    selectedRole && editLockedRoleIds.has(selectedRole.id),
  );
  const roleIsCustom = Boolean(selectedRole && !selectedRole.isSystem);
  const editable = Boolean(roleIsCustom && !selectedRoleEditLocked);
  const [roleEdits, setRoleEdits] = useState<Record<string, RoleEdit>>({});
  const [newRole, setNewRole] = useState({ name: "", code: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEdit = selectedRole ? roleEdits[selectedRole.id] : undefined;
  const draft: RoleDraft = selectedRole
    ? {
        name: selectedEdit?.name ?? selectedRole.name,
        code: selectedEdit?.code ?? selectedRole.code,
        description: selectedEdit?.description ?? selectedRole.description ?? "",
        isActive: selectedEdit?.isActive ?? selectedRole.isActive,
      }
    : { name: "", code: "", description: "", isActive: true };
  const selectedPermissionIds = useMemo(() => {
    if (!selectedRole) return new Set<string>();
    return new Set(
      selectedEdit?.permissionIds ?? Array.from(rolePermissionIds(selectedRole)),
    );
  }, [selectedEdit?.permissionIds, selectedRole]);

  const selectedPermissionCount = selectedPermissionIds.size;
  const selectedPermissionCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const permission of permissionGroups.flatMap((group) => group.permissions)) {
      if (selectedPermissionIds.has(permission.id)) codes.add(permission.code);
    }
    return codes;
  }, [permissionGroups, selectedPermissionIds]);
  const hasAdminPortalPermissions = useMemo(
    () =>
      Array.from(selectedPermissionCodes).some((code) =>
        adminPortalPermissionCodes.has(code),
      ),
    [selectedPermissionCodes],
  );
  const canAccessAdminDashboard = hasAdminPortalPermissions;
  const recommendedAccountRole: NewAccessUserDraft["accountRole"] = "admin";
  const accountRoleHelp = t.accountRoleHelp;
  const isAccountRoleAllowed = useCallback((accountRole: NewAccessUserDraft["accountRole"]) => {
    return accountRole === "admin";
  }, []);
  const selectedRoleProtected = selectedRole
    ? protectedRoleCodes.has(selectedRole.code)
    : false;
  const selectedRoleCanAssignUsers = Boolean(selectedRole && !selectedRoleProtected);
  const selectedAccountRole = isAccountRoleAllowed(newUser.accountRole)
    ? newUser.accountRole
    : recommendedAccountRole;
  const newUserLoginPath = "/admin-login";

  const persistEditLocks = (ids: Set<string>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(roleEditLockStorageKey, JSON.stringify(Array.from(ids)));
  };

  const totalPermissionCount = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups],
  );
  const selectedRoleUserIds = useMemo(() => {
    if (!selectedRole) return new Set<string>();
    return new Set(
      users
        .filter((user) =>
          user.roleAssignments.some((assignment) => assignment.roleId === selectedRole.id),
        )
        .map((user) => user.id),
    );
  }, [selectedRole, users]);
  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => {
      const assignedDiff =
        Number(selectedRoleUserIds.has(b.id)) - Number(selectedRoleUserIds.has(a.id));
      if (assignedDiff) return assignedDiff;
      return displayUserName(a).localeCompare(displayUserName(b));
    });
    if (!needle) return sorted;
    return sorted.filter((user) =>
      [
        user.fullName,
        user.email,
        user.username,
        user.phone,
        user.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [selectedRoleUserIds, userSearch, users]);

  const setDraftValue = <K extends keyof RoleDraft>(key: K, value: RoleDraft[K]) => {
    if (!selectedRole) return;
    setRoleEdits((current) => ({
      ...current,
      [selectedRole.id]: {
        ...(current[selectedRole.id] ?? {}),
        [key]: value,
      },
    }));
  };

  const togglePermission = (permissionId: string) => {
    if (!editable || !selectedRole) return;
    const next = new Set(selectedPermissionIds);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    setRoleEdits((current) => ({
      ...current,
      [selectedRole.id]: {
        ...(current[selectedRole.id] ?? {}),
        permissionIds: Array.from(next),
      },
    }));
  };

  const handleToggleSelectedRoleEditLock = () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setMessage("");
    setError("");

    setEditLockedRoleIds((current) => {
      const next = new Set(current);
      if (next.has(selectedRole.id)) {
        next.delete(selectedRole.id);
        setMessage(t.roleEditingEnabled);
      } else {
        next.add(selectedRole.id);
        setRoleEdits((edits) => {
          const clean = { ...edits };
          delete clean[selectedRole.id];
          return clean;
        });
        setMessage(t.roleEditingDisabled);
      }
      persistEditLocks(next);
      return next;
    });
  };

  const handleCreateRole = async () => {
    setMessage("");
    setError("");
    const code = toRoleCode(newRole.code || newRole.name);
    if (!newRole.name.trim() || !code) {
      setError(t.roleNameCodeRequired);
      return;
    }

    try {
      const created = await createRole({
        name: newRole.name.trim(),
        code,
        description: "",
        isActive: true,
        permissionIds: [],
      }).unwrap();
      setNewRole({ name: "", code: "" });
      setSelectedRoleId(created.id);
      setMessage(t.roleCreated);
    } catch (err) {
      setError(getApiErrorMessage(err, t.createRoleError));
    }
  };

  const handleCreateEditableCopy = async () => {
    if (!selectedRole) return;
    setMessage("");
    setError("");

    try {
      const created = await createRole({
        name: `${selectedRole.name} ${t.editableCopyName}`,
        code: editableCopyCode(selectedRole),
        description:
          selectedRole.description ||
          t.editableCopyDescription.replace("{role}", selectedRole.name),
        isActive: true,
        permissionIds: Array.from(rolePermissionIds(selectedRole)),
      }).unwrap();
      setSelectedRoleId(created.id);
      setMessage(t.editableCopyCreated);
    } catch (err) {
      setError(getApiErrorMessage(err, t.editableCopyError));
    }
  };

  const handleCreateAccessUser = async () => {
    setMessage("");
    setError("");

    if (!selectedRole) {
      setError(t.selectRoleError);
      return;
    }
    if (!selectedRoleCanAssignUsers) {
      setError(
        selectedRoleProtected
          ? t.protectedRoleError
          : t.roleAssignError,
      );
      return;
    }
    if (!isAccountRoleAllowed(selectedAccountRole)) {
      setError(accountRoleHelp);
      return;
    }
    if (
      !newUser.fullName.trim() ||
      !newUser.phone.trim() ||
      !newUser.username.trim() ||
      !newUser.password
    ) {
      setError(t.requiredUserFields);
      return;
    }
    const usernameError = validateUsername(newUser.username, t);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    const passwordError = validatePassword(newUser.password, t);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      const created = await createAccessUser({
        fullName: newUser.fullName.trim(),
        accountRole: selectedAccountRole,
        email: newUser.email.trim() || null,
        phone: newUser.phone.trim(),
        username: newUser.username.trim().toLowerCase(),
        password: newUser.password,
        address: newUser.address.trim() || null,
        jobTitle: newUser.jobTitle.trim() || null,
        department: newUser.department.trim() || null,
        notes: newUser.notes.trim() || null,
        roleId: selectedRole.id,
      }).unwrap();
      const createdUsername = created.user.username || newUser.username.trim().toLowerCase();
      const createdLoginPath = "/admin-login";
      setNewUser(emptyAccessUserDraft);
      setMessage(
        t.userCreated
          .replace("{path}", createdLoginPath)
          .replace("{username}", createdUsername),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, t.createUserError));
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole || !editable) return;
    setMessage("");
    setError("");
    const code = toRoleCode(draft.code);
    if (!draft.name.trim() || !code) {
      setError(t.validRoleRequired);
      return;
    }

    try {
      await updateRole({
        id: selectedRole.id,
        body: {
          name: draft.name.trim(),
          code,
          description: draft.description || null,
          isActive: draft.isActive,
          permissionIds: Array.from(selectedPermissionIds),
        },
      }).unwrap();
      setRoleEdits((current) => {
        const next = { ...current };
        delete next[selectedRole.id];
        return next;
      });
      setMessage(t.roleSaved);
    } catch (err) {
      setError(getApiErrorMessage(err, t.saveRoleError));
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || !editable) return;
    setMessage("");
    setError("");

    try {
      await deleteRole(selectedRole.id).unwrap();
      const nextRole = roles.find((role) => role.id !== selectedRole.id);
      setSelectedRoleId(nextRole?.id ?? "");
      setRoleEdits((current) => {
        const next = { ...current };
        delete next[selectedRole.id];
        return next;
      });
      setMessage(t.roleDeleted);
    } catch (err) {
      setError(getApiErrorMessage(err, t.deleteRoleError));
    }
  };

  const handleToggleUserRole = async (user: AdminAccessUser) => {
    if (!selectedRole || user.id === currentUser?.id) return;
    setMessage("");
    setError("");
    if (!selectedRoleCanAssignUsers) {
      setError(
        selectedRoleProtected
          ? t.protectedRoleError
          : t.roleAssignError,
      );
      return;
    }
    const assigned = selectedRoleUserIds.has(user.id);
    const compatibleAccountRole =
      user.role !== "player" &&
      user.role !== "parent" &&
      isAccountRoleAllowed(user.role as NewAccessUserDraft["accountRole"]);
    if (!assigned && !compatibleAccountRole) {
      setError(
        t.incompatibleUserRole
          .replace("{user}", displayUserName(user))
          .replace("{role}", user.role)
          .replace("{help}", accountRoleHelp),
      );
      return;
    }

    try {
      if (assigned) {
        await revokeRole({ roleId: selectedRole.id, userId: user.id }).unwrap();
        setMessage(t.roleRemoved);
      } else {
        await assignRole({ roleId: selectedRole.id, userId: user.id }).unwrap();
        setMessage(t.roleAssigned);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t.updateUserRoleError));
    }
  };

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/10">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {t.loadError}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.settings },
          { label: t.pageTitle },
        ]}
      />

      <Card className="border-border/50 bg-card">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
          <div className="space-y-2">
            <Label>{t.newCustomRole}</Label>
            <Input
              value={newRole.name}
              onChange={(event) =>
                setNewRole((current) => ({
                  ...current,
                  name: event.target.value,
                  code: current.code || toRoleCode(event.target.value),
                }))
              }
              placeholder={t.operationsManager}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.code}</Label>
            <Input
              value={newRole.code}
              onChange={(event) =>
                setNewRole((current) => ({
                  ...current,
                  code: toRoleCode(event.target.value),
                }))
              }
              placeholder={t.operationsManagerCode}
            />
          </div>
          <Button
            type="button"
            className="self-end gap-1.5"
            onClick={handleCreateRole}
            disabled={creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.addRole}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.roles}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedRoleId(role.id);
                  setMessage("");
                  setError("");
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedRole?.id === role.id
                    ? "border-lime-300/60 bg-lime-300/10"
                    : "border-border/60 bg-muted/10 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{role.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{role.code}</p>
                  </div>
                  <Badge variant={role.isSystem ? "secondary" : "info"}>
                    {role.isSystem ? t.system : t.custom}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{role.userCount} {t.users}</span>
                  <span>{role.permissionAssignments.length} {t.permissions}</span>
                </div>
              </button>
            ))}
            {!roles.length && (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                {t.noRoles}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-lime-300" />
                  {selectedRole?.name ?? t.selectRole}
                </CardTitle>
              </div>
              {selectedRole && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant={selectedRole.isActive ? "success" : "secondary"}>
                    {selectedRole.isActive ? t.active : t.inactive}
                  </Badge>
                  {roleIsCustom && (
                    <Badge variant={selectedRoleEditLocked ? "secondary" : "success"}>
                      {selectedRoleEditLocked ? t.editingOff : t.editingOn}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {selectedPermissionCount}/{totalPermissionCount}
                  </Badge>
                </div>
              )}
            </CardHeader>
            {selectedRole && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.name}</Label>
                    <Input
                      value={draft.name}
                      disabled={!editable}
                      onChange={(event) => setDraftValue("name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.code}</Label>
                    <Input
                      value={draft.code}
                      disabled={!editable}
                      onChange={(event) => setDraftValue("code", toRoleCode(event.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.description}</Label>
                  <Textarea
                    value={draft.description}
                    disabled={!editable}
                    onChange={(event) => setDraftValue("description", event.target.value)}
                  />
                </div>
                <label className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
                  <span>{t.roleActive}</span>
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={draft.isActive}
                    onChange={(event) => setDraftValue("isActive", event.target.checked)}
                  />
                </label>
                {!editable && (
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {selectedRoleEditLocked
                        ? t.editLockedHelp
                        : t.systemRoleHelp}
                    </span>
                    {selectedRoleEditLocked ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleToggleSelectedRoleEditLock}
                        className="shrink-0 gap-1.5"
                      >
                        {t.enableEditing}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateEditableCopy}
                        disabled={creating}
                        className="shrink-0 gap-1.5"
                      >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {t.makeEditableCopy}
                      </Button>
                    )}
                  </div>
                )}
                {editable && (
                  <div className="flex flex-col gap-3 rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-200 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {t.editableHelp}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleToggleSelectedRoleEditLock}
                      className="shrink-0"
                    >
                      {t.disableEditing}
                    </Button>
                  </div>
                )}
                {!canAccessAdminDashboard && (
                  <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-200">
                    {t.noDashboardAccess}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {selectedRole && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-4 w-4 text-lime-300" />
                    {t.addUserTitle}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.addUserDescription.split("{role}")[0]}
                    <span className="font-medium text-foreground">{selectedRole.name}</span>
                    {t.addUserDescription.split("{role}")[1]}
                  </p>
                </div>
                <Badge variant="secondary">
                  {t.login}: {newUserLoginPath}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedRoleCanAssignUsers && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
                    {selectedRoleProtected
                      ? t.protectedRoleAssignHelp
                      : t.roleAssignError}
                  </div>
                )}
                {!isAccountRoleAllowed(newUser.accountRole) && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
                    {t.loginTypeAdjusted} {accountRoleHelp}
                  </div>
                )}
                {message && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">
                    <CheckCircle className="h-4 w-4 shrink-0" /> {message}
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.name}</Label>
                    <Input
                      value={newUser.fullName}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      placeholder={language === "ar" ? "أحمد حسن" : "Ahmed Hassan"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.loginType}</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/20 px-3 text-sm">
                      {t.staffAdminLogin}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {accountRoleHelp}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.emailOptional}</Label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder={t.emailPlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.phone}</Label>
                    <Input
                      value={newUser.phone}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder={t.phonePlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.username}</Label>
                    <Input
                      value={newUser.username}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      placeholder={t.usernamePlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.password}</Label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      placeholder={t.passwordPlaceholder}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.passwordHelp}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.address}</Label>
                    <Input
                      value={newUser.address}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder={t.addressPlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.jobTitle}</Label>
                    <Input
                      value={newUser.jobTitle}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          jobTitle: event.target.value,
                        }))
                      }
                      placeholder={t.operationsManager}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.department}</Label>
                    <Input
                      value={newUser.department}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          department: event.target.value,
                        }))
                      }
                      placeholder={t.departmentPlaceholder}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.notes}</Label>
                    <Textarea
                      value={newUser.notes}
                      onChange={(event) =>
                        setNewUser((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder={t.notesPlaceholder}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={handleCreateAccessUser}
                  disabled={creatingUser || !selectedRoleCanAssignUsers}
                >
                  {creatingUser ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {t.addUserAssign}
                </Button>
              </CardContent>
            </Card>
          )}

          {selectedRole && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-lime-300" />
                    {t.assignedUsers}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.assignedUsersDescription}
                  </p>
                </div>
                <Badge variant="outline">{selectedRoleUserIds.size} {t.assigned}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder={t.searchUsersPlaceholder}
                    className="pl-9"
                  />
                  <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {filteredUsers.map((user) => {
                    const assigned = selectedRoleUserIds.has(user.id);
                    const isSelf = user.id === currentUser?.id;
                    const compatibleAccountRole =
                      user.role === "admin" &&
                      isAccountRoleAllowed(user.role as NewAccessUserDraft["accountRole"]);
                    const disabled =
                      isSelf ||
                      assigning ||
                      revoking ||
                      !selectedRoleCanAssignUsers ||
                      (!assigned && !compatibleAccountRole);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleToggleUserRole(user)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                          assigned
                            ? "border-lime-300/50 bg-lime-300/10"
                            : "border-border/50 bg-muted/10 hover:bg-muted/30"
                        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {displayUserName(user)}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{user.email || user.username || user.phone || t.noLoginLabel}</span>
                            <Badge variant="secondary" className="rounded-md text-[10px]">
                              {user.role}
                            </Badge>
                            {isSelf && <span>{t.selfProtected}</span>}
                            {!assigned && !compatibleAccountRole && (
                              <span>
                                {recommendedAccountRole === "admin" ? t.needsAdminLogin : `${t.needsAdminLogin}: ${recommendedAccountRole}`}
                              </span>
                            )}
                          </span>
                        </span>
                        <Badge variant={assigned ? "success" : "outline"}>
                          {assigned ? t.assignedStatus : t.notAssignedStatus}
                        </Badge>
                      </button>
                    );
                  })}
                  {!filteredUsers.length && (
                    <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                      {t.noUsersMatch}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">{t.permissions}</CardTitle>
                {editable ? (
                  <Badge variant="success">{t.editable}</Badge>
                ) : (
                  <Badge variant="secondary">
                    {selectedRoleEditLocked ? t.editingDisabled : t.readOnlySystemRole}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {permissionGroups.map((group) => (
                <div key={group.code} className="rounded-xl border border-border/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.code}</p>
                    </div>
                    <Badge variant="outline">{group.permissions.length}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label
                        key={permission.id}
                        className={`flex min-h-[70px] items-start gap-3 rounded-lg border p-3 text-sm ${
                          selectedPermissionIds.has(permission.id)
                            ? "border-lime-300/50 bg-lime-300/10"
                            : "border-border/50 bg-muted/10"
                        } ${editable ? "cursor-pointer hover:border-lime-300/70 hover:bg-lime-300/15" : "cursor-not-allowed opacity-70"}`}
                        title={
                          editable
                            ? t.permissionGrantTitle
                            : selectedRoleEditLocked
                              ? t.editFirstTitle
                              : t.makeCopyFirstTitle
                        }
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          disabled={!editable}
                          checked={selectedPermissionIds.has(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{permission.code}</span>
                          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                            {permission.description || `${permission.resource}.${permission.action}`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {!permissionGroups.length && (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  {t.noPermissions}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            {!editable && selectedRole && (
              <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
                {selectedRoleEditLocked
                  ? t.saveDeleteEditOff
                  : t.saveDeleteSystem}
              </span>
            )}
            <Button
              type="button"
              className="gap-1.5"
              onClick={handleSaveRole}
              disabled={!editable || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t.saveRole}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              onClick={handleDeleteRole}
              disabled={!editable || deleting || Boolean(selectedRole?.userCount)}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t.deleteRole}
            </Button>
            {message && (
              <span className="flex items-center gap-1 text-sm text-emerald-400">
                <CheckCircle className="h-4 w-4" /> {message}
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" /> {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
