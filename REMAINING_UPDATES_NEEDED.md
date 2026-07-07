# Remaining Updates Needed for Birth Years & Groups Refactor

## ⚠️ Status: Additional Updates Required

While the core refactor is complete, there are several files that still reference the old `birth_year_id` column that was removed. These need to be updated to work with the new label-based system.

---

## 🔴 Critical Backend Files (Must Fix)

### 1. Attendance Module
**File:** `golx-backend/src/modules/attendance/attendance.repository.js`

**Issue:** Joins on `ag.birth_year_id` which no longer exists

**Lines affected:**
- Line 11: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`
- Line 44: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`
- Line 114: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`

**Solution:** Remove these joins since groups now have `branch_id` directly. Birth year information should come from `group_labels` if needed.

---

### 2. Rankings Module
**File:** `golx-backend/src/modules/rankings/rankings.repository.js`

**Issue:** Joins on `ag.birth_year_id`

**Lines affected:**
- Line 166: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`
- Line 177: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`

**Solution:** Use `ag.branch_id` to join to branches directly.

---

### 3. Players Module
**File:** `golx-backend/src/modules/players/players.repository.js`

**Issue:** Joins on `ag.birth_year_id`

**Lines affected:**
- Line 177: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`

**Solution:** Use `ag.branch_id` instead.

---

### 4. Coaches Module
**Files:**
- `golx-backend/src/modules/coaches/coaches.repository.js`
- `golx-backend/src/modules/coaches/coaches.service.js`
- `golx-backend/src/modules/coaches/coaches.schema.js`

**Issues:**
- Multiple joins on `ag.birth_year_id`
- Service returns `birthYearId` in group data
- Schema expects `birthYearId` for group creation

**Solution:** 
- Update joins to use `ag.branch_id`
- Change group creation to use `labels` array instead of `birthYearId`
- Update service to return `labels` instead of `birthYearId`

---

### 5. Admin Module
**File:** `golx-backend/src/modules/admin/admin.repository.js`

**Issue:** Joins on `ag.birth_year_id`

**Lines affected:**
- Line 68: `.join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')`
- Line 116: `LEFT JOIN academy_birth_years aby ON ag.birth_year_id = aby.id`

**Solution:** Update to use `ag.branch_id`.

---

### 6. Seed Data
**File:** `golx-backend/seeds/01_dashboard_data.js`

**Issue:** Inserts groups with `birth_year_id`

**Solution:** Update seed data to:
1. Insert groups with `branch_id` instead of `birth_year_id`
2. Insert corresponding `group_labels` entries

---

## 🟡 Frontend Files (Should Update)

### 1. Admin API Types
**File:** `lib/store/api/adminApi.ts`

**Issue:** Group interface still has `birth_year_id`

**Lines affected:**
- Line 359: `birth_year_id: string;`
- Line 361: `birth_year?: number;`
- Line 371: `birthYearId: string;`

**Solution:** Update to use `labels` array instead.

---

### 2. Coach API Types
**File:** `lib/store/api/coachApi.ts`

**Issue:** Group interfaces have `birthYearId`

**Solution:** Update to use `labels` array.

---

### 3. Mock Data
**File:** `lib/mock-data/index.ts`

**Issue:** Mock groups have `birthYearId`

**Solution:** Update mock data to use `labels` array.

---

## 📋 Recommended Update Order

1. **Backend Repositories** (Critical - breaks functionality)
   - attendance.repository.js
   - rankings.repository.js
   - players.repository.js
   - coaches.repository.js
   - admin.repository.js

2. **Backend Services & Schemas**
   - coaches.service.js
   - coaches.schema.js

3. **Seed Data**
   - 01_dashboard_data.js

4. **Frontend Types**
   - adminApi.ts (Group interfaces)
   - coachApi.ts
   - mock-data/index.ts

---

## 🔧 Example Fixes

### Before (Old Schema):
```javascript
// ❌ This will fail - birth_year_id doesn't exist
return this.db('academy_groups as ag')
    .join('academy_birth_years as aby', 'ag.birth_year_id', 'aby.id')
    .join('academy_branches as ab', 'aby.branch_id', 'ab.id')
    .where('ag.id', groupId);
```

### After (New Schema):
```javascript
// ✅ Use branch_id directly
return this.db('academy_groups as ag')
    .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
    .leftJoin('group_labels as gl', 'gl.group_id', 'ag.id')
    .where('ag.id', groupId);
```

---

### Group Creation - Before:
```javascript
// ❌ Old way
const createGroupSchema = z.object({
    branchId: z.string().uuid(),
    birthYearId: z.string().uuid(),  // ❌ Removed
    name: z.string(),
});
```

### Group Creation - After:
```javascript
// ✅ New way
const createGroupSchema = z.object({
    branchId: z.string().uuid(),
    labels: z.array(z.string()).min(1),  // ✅ Use labels
    name: z.string(),
});
```

---

## 🧪 Testing After Updates

After making these updates, test:

1. **Attendance Sessions**
   - Create attendance session
   - Mark attendance
   - View attendance history

2. **Rankings**
   - View rankings
   - Create match records

3. **Players**
   - Assign player to group
   - View player groups

4. **Coaches**
   - Assign coach to group
   - View coach groups
   - Create group as coach

5. **Admin Dashboard**
   - View dashboard statistics
   - Check attendance reports

---

## 📝 Notes

- The core academy module (birth years & groups CRUD) is **fully updated and working**
- The issue is with **other modules** that reference groups and still expect `birth_year_id`
- These modules need to be updated to work with the new `branch_id` + `labels` structure
- Most fixes involve:
  1. Changing joins from `birth_year_id` to `branch_id`
  2. Optionally joining `group_labels` if label information is needed
  3. Updating schemas to use `labels` array instead of `birthYearId`

---

## ⚡ Quick Fix Priority

**High Priority (Breaks functionality):**
- ✅ Birth Years page (FIXED)
- 🔴 Attendance repository
- 🔴 Coaches repository
- 🔴 Players repository

**Medium Priority (May cause errors):**
- 🟡 Rankings repository
- 🟡 Admin repository
- 🟡 Seed data

**Low Priority (Frontend only):**
- 🟢 Frontend API types
- 🟢 Mock data

---

**Next Steps:** Update the backend repositories to remove references to `birth_year_id` and use the new `branch_id` + `labels` structure.
