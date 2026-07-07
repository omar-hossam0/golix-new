# Birth Years & Groups - Quick Reference Guide

## 🎯 Quick Overview

The system now uses **labels** to group birth years, allowing:
- Multiple year ranges per label (e.g., "Juniors" = 2010-2011 + 2012-2013)
- Multiple labels per group (e.g., Group A = "Juniors" + "U12")
- Flexible, scalable grouping

---

## 📊 Database Schema

### Birth Years
```
academy_birth_years
├── id (UUID)
├── branch_id (UUID) → academy_branches
├── label (VARCHAR)
├── normalized_label (VARCHAR) - lowercase, trimmed
├── from_year (SMALLINT)
├── to_year (SMALLINT)
├── deleted_at (TIMESTAMP) - soft delete
└── timestamps
```

### Groups
```
academy_groups
├── id (UUID)
├── branch_id (UUID) → academy_branches
├── name (VARCHAR)
├── max_players (SMALLINT)
├── deleted_at (TIMESTAMP)
└── timestamps
```

### Group Labels (Junction Table)
```
group_labels
├── id (UUID)
├── group_id (UUID) → academy_groups
├── normalized_label (VARCHAR)
└── created_at (TIMESTAMP)
```

---

## 🔌 API Endpoints

### Birth Years

#### List Birth Years (Grouped by Label)
```http
GET /api/academy/birth-years?branchId={uuid}
```

**Response:**
```json
[
  {
    "label": "Juniors",
    "normalizedLabel": "juniors",
    "birthYears": [
      { "id": "uuid-1", "fromYear": 2010, "toYear": 2011 },
      { "id": "uuid-2", "fromYear": 2012, "toYear": 2013 }
    ]
  }
]
```

#### Create Birth Year
```http
POST /api/academy/birth-years
Content-Type: application/json

{
  "branchId": "uuid",
  "label": "Juniors",      // Optional - auto-generated if omitted
  "fromYear": 2014,
  "toYear": 2015
}
```

#### Update Birth Year
```http
PATCH /api/academy/birth-years/:id
Content-Type: application/json

{
  "label": "Updated Label",  // Optional
  "fromYear": 2014,          // Optional
  "toYear": 2016             // Optional
}
```

#### Delete Birth Year
```http
DELETE /api/academy/birth-years/:id
```

**Note:** Fails if birth year has active players, sessions, or matches.

---

### Groups

#### List Groups
```http
GET /api/academy/groups?branchId={uuid}&page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Group A",
      "branchId": "uuid",
      "branchName": "Main Branch",
      "maxPlayers": 25,
      "playerCount": 15,
      "coachCount": 2,
      "labels": [
        { "label": "Juniors", "normalizedLabel": "juniors" }
      ]
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "totalPages": 3
  }
}
```

#### Create Group
```http
POST /api/academy/groups
Content-Type: application/json

{
  "branchId": "uuid",
  "name": "Group A",
  "labels": ["Juniors", "U12"],  // At least 1 required
  "maxPlayers": 25               // Optional, default: 25
}
```

#### Update Group
```http
PUT /api/academy/groups/:id
Content-Type: application/json

{
  "name": "Updated Name",        // Optional
  "labels": ["Juniors", "U14"],  // Optional
  "maxPlayers": 30               // Optional
}
```

#### Delete Group
```http
DELETE /api/academy/groups/:id
```

**Note:** Fails if group has active players, sessions, or matches.

---

## 💻 Code Examples

### Creating Birth Year Ranges

```javascript
// Create multiple ranges for same label
const juniors2010 = await academyService.createBirthYear({
  branchId: 'branch-uuid',
  label: 'Juniors',
  fromYear: 2010,
  toYear: 2011
}, academyId);

const juniors2012 = await academyService.createBirthYear({
  branchId: 'branch-uuid',
  label: 'Juniors',
  fromYear: 2012,
  toYear: 2013
}, academyId);
```

### Creating Groups with Multiple Labels

```javascript
const group = await academyService.createGroup(academyId, {
  branchId: 'branch-uuid',
  name: 'Mixed Group',
  labels: ['Juniors', 'U12'],
  maxPlayers: 30
});
```

### Querying Birth Years

```javascript
// Returns grouped by label
const birthYears = await academyService.getBirthYears(
  branchId,
  academyId,
  actor
);

// Result:
// [
//   {
//     label: "Juniors",
//     normalizedLabel: "juniors",
//     birthYears: [
//       { id: "...", fromYear: 2010, toYear: 2011 },
//       { id: "...", fromYear: 2012, toYear: 2013 }
//     ]
//   }
// ]
```

### Updating Group Labels

```javascript
await academyService.updateGroup(groupId, academyId, {
  labels: ['Seniors', 'U16']  // Replaces all existing labels
});
```

---

## 🔍 Label Normalization

Labels are automatically normalized for consistent matching:

```javascript
normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
```

**Examples:**
- `"Juniors"` → `"juniors"`
- `"JUNIORS"` → `"juniors"`
- `"  Juniors  "` → `"juniors"`
- `"U-12"` → `"u-12"`

---

## ⚠️ Validation Rules

### Birth Years
- ✅ `fromYear` must be ≤ `toYear`
- ✅ No overlapping ranges for same label in same branch
- ✅ Label auto-generated if not provided: `"2014"` or `"2014-2015"`
- ✅ Cannot delete if has active relations

### Groups
- ✅ At least 1 label required
- ✅ All labels must exist in branch's birth years
- ✅ Duplicate labels automatically removed
- ✅ Cannot delete if has active players, sessions, or matches

---

## 🛡️ Access Control

### Admin
- Full CRUD on birth years and groups
- Access all branches in their academy

### Coach
- Read-only access to assigned branches
- Queries automatically scoped to their assignments

---

## 🐛 Common Errors

### Overlapping Birth Year Range
```json
{
  "error": "ConflictError",
  "message": "Birth year range overlaps an existing range for the same label"
}
```

**Solution:** Adjust `fromYear` or `toYear` to avoid overlap.

---

### Invalid Labels
```json
{
  "error": "NotFoundError",
  "message": "One or more labels do not exist for this branch"
}
```

**Solution:** Create birth years with those labels first.

---

### Cannot Delete
```json
{
  "error": "BadRequestError",
  "message": "Cannot delete a group with active players, sessions, or matches"
}
```

**Solution:** Remove active relations before deleting.

---

## 📝 Database Queries

### Get All Groups with Labels
```sql
SELECT 
  ag.*,
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'label', aby.label,
        'normalizedLabel', gl.normalized_label
      )
    ) FILTER (WHERE gl.normalized_label IS NOT NULL),
    '[]'
  ) as labels
FROM academy_groups ag
LEFT JOIN group_labels gl ON gl.group_id = ag.id
LEFT JOIN academy_birth_years aby 
  ON aby.branch_id = ag.branch_id 
  AND aby.normalized_label = gl.normalized_label
WHERE ag.deleted_at IS NULL
GROUP BY ag.id;
```

### Check Birth Year Overlap
```sql
SELECT * FROM academy_birth_years
WHERE branch_id = $1
  AND normalized_label = $2
  AND deleted_at IS NULL
  AND from_year <= $4  -- toYear
  AND to_year >= $3    -- fromYear
  AND id != $5;        -- excludeId (optional)
```

---

## 🚀 Migration Status

**File:** `031_birth_years_groups_refactor.js`  
**Status:** ✅ Applied (Batch 14)  
**Idempotent:** Yes (safe to re-run)  
**Transactional:** Yes (all-or-nothing)

---

## 📚 Related Files

- **Migration:** `golx-backend/migrations/031_birth_years_groups_refactor.js`
- **Repository:** `golx-backend/src/modules/academy/academy.repository.js`
- **Service:** `golx-backend/src/modules/academy/academy.service.js`
- **Controller:** `golx-backend/src/modules/academy/academy.controller.js`
- **Routes:** `golx-backend/src/modules/academy/academy.routes.js`
- **Schema:** `golx-backend/src/modules/academy/academy.schema.js`

---

## 🎓 Use Case Examples

### Example 1: Academy with Age Groups
```javascript
// Create birth years
await createBirthYear({ label: "U8", fromYear: 2016, toYear: 2017 });
await createBirthYear({ label: "U10", fromYear: 2014, toYear: 2015 });
await createBirthYear({ label: "U12", fromYear: 2012, toYear: 2013 });

// Create groups
await createGroup({ name: "Beginners", labels: ["U8"] });
await createGroup({ name: "Intermediate", labels: ["U10", "U12"] });
```

### Example 2: Multiple Ranges per Label
```javascript
// Juniors spans multiple years
await createBirthYear({ label: "Juniors", fromYear: 2010, toYear: 2011 });
await createBirthYear({ label: "Juniors", fromYear: 2012, toYear: 2013 });

// One group for all Juniors
await createGroup({ name: "Juniors A", labels: ["Juniors"] });
```

### Example 3: Updating Group Composition
```javascript
// Start with U10
await createGroup({ name: "Group A", labels: ["U10"] });

// Later, expand to include U12
await updateGroup(groupId, { labels: ["U10", "U12"] });

// Later, change to only U14
await updateGroup(groupId, { labels: ["U14"] });
```

---

**Need Help?** Check the full documentation in `BIRTH_YEARS_GROUPS_REFACTOR_SUMMARY.md`
