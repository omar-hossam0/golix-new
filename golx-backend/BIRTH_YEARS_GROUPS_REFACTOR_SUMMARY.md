# Birth Years & Groups Refactor - Implementation Summary

## Overview
This document summarizes the complete refactoring of the Birth Years and Groups system in the GOLX Academy platform. The refactor transforms the rigid one-to-one relationship between groups and birth years into a flexible, label-based system that supports multiple year ranges per label.

---

## Database Schema Changes

### 1. Birth Years Table (`academy_birth_years`)

#### **Before:**
```sql
id              UUID PRIMARY KEY
branch_id       UUID NOT NULL REFERENCES academy_branches
year            SMALLINT NOT NULL
label           VARCHAR(100)
created_at      TIMESTAMP
updated_at      TIMESTAMP
UNIQUE(branch_id, year)
```

#### **After:**
```sql
id                  UUID PRIMARY KEY
branch_id           UUID NOT NULL REFERENCES academy_branches
label               VARCHAR(100)
normalized_label    VARCHAR(120) NOT NULL
from_year           SMALLINT NOT NULL
to_year             SMALLINT NOT NULL
created_at          TIMESTAMP
updated_at          TIMESTAMP
deleted_at          TIMESTAMP (soft delete support)

INDEXES:
- normalized_label
- (branch_id, normalized_label)
- (branch_id, from_year)
```

#### **Key Changes:**
- ✅ Replaced single `year` with `from_year` and `to_year` range
- ✅ Added `normalized_label` for case-insensitive grouping
- ✅ Added `deleted_at` for soft delete support
- ✅ Removed unique constraint on `(branch_id, year)`
- ✅ Added indexes for efficient querying

---

### 2. Groups Table (`academy_groups`)

#### **Before:**
```sql
id              UUID PRIMARY KEY
birth_year_id   UUID NOT NULL REFERENCES academy_birth_years
name            VARCHAR(255) NOT NULL
max_players     SMALLINT DEFAULT 25
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP
```

#### **After:**
```sql
id              UUID PRIMARY KEY
branch_id       UUID NOT NULL REFERENCES academy_branches
name            VARCHAR(255) NOT NULL
max_players     SMALLINT DEFAULT 25
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP

INDEXES:
- branch_id
```

#### **Key Changes:**
- ✅ Removed direct `birth_year_id` foreign key
- ✅ Added `branch_id` for direct branch association
- ✅ Groups now relate to birth years through labels (many-to-many)

---

### 3. New Table: `group_labels`

```sql
id                  UUID PRIMARY KEY
group_id            UUID NOT NULL REFERENCES academy_groups ON DELETE CASCADE
normalized_label    VARCHAR(120) NOT NULL
created_at          TIMESTAMP NOT NULL

UNIQUE(group_id, normalized_label)
INDEXES:
- group_id
- normalized_label
```

#### **Purpose:**
- Junction table enabling many-to-many relationship between groups and birth year labels
- A group can be associated with multiple labels (e.g., "Juniors", "U12")
- Multiple birth year ranges can share the same label

---

## Label Normalization

### Normalization Rules:
```javascript
normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
```

### Examples:
| Input | Normalized |
|-------|------------|
| `"Juniors"` | `"juniors"` |
| `"JUNIORS"` | `"juniors"` |
| `"  Juniors  "` | `"juniors"` |
| `"U-12"` | `"u-12"` |

---

## Data Migration

### Migration Process:
1. ✅ Add new columns to `academy_birth_years` (from_year, to_year, normalized_label, deleted_at)
2. ✅ Backfill data: `from_year = year`, `to_year = year`, `normalized_label = LOWER(TRIM(label))`
3. ✅ Set NOT NULL constraints
4. ✅ Drop old unique constraint and `year` column
5. ✅ Add new indexes
6. ✅ Add `branch_id` to `academy_groups`
7. ✅ Populate `branch_id` from existing `birth_year_id` relationships
8. ✅ Create `group_labels` table
9. ✅ Migrate existing group-birth_year relationships to group_labels
10. ✅ Drop old `birth_year_id` column and foreign key

### Data Safety:
- ✅ All operations wrapped in transaction
- ✅ Idempotent migration (safe to re-run)
- ✅ Soft delete support (no data loss)
- ✅ Existing relationships preserved

---

## API Endpoints

### Birth Years

#### `GET /api/academy/birth-years?branchId={uuid}`
Returns birth years grouped by label:
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

#### `POST /api/academy/birth-years`
Create a new birth year range:
```json
{
  "branchId": "uuid",
  "label": "Juniors",
  "fromYear": 2014,
  "toYear": 2015
}
```

**Validation:**
- ✅ `fromYear <= toYear`
- ✅ No overlapping ranges for same label in same branch
- ✅ Label auto-derived if not provided: `"2014"` or `"2014-2015"`

#### `PATCH /api/academy/birth-years/:id`
Update birth year range:
```json
{
  "label": "Updated Label",
  "fromYear": 2014,
  "toYear": 2016
}
```

#### `DELETE /api/academy/birth-years/:id`
Soft delete a birth year range.

**Protection:**
- ❌ Cannot delete if associated with active players, sessions, or matches

---

### Groups

#### `GET /api/academy/groups?branchId={uuid}`
Returns groups with their labels:
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
        { "label": "Juniors", "normalizedLabel": "juniors" },
        { "label": "U12", "normalizedLabel": "u12" }
      ]
    }
  ],
  "pagination": { ... }
}
```

#### `POST /api/academy/groups`
Create a new group:
```json
{
  "branchId": "uuid",
  "name": "Group A",
  "labels": ["Juniors", "U12"],
  "maxPlayers": 25
}
```

**Validation:**
- ✅ At least one label required
- ✅ All labels must exist in the branch's birth years
- ✅ Duplicate labels automatically removed

#### `PUT /api/academy/groups/:id`
Update group:
```json
{
  "name": "Updated Name",
  "labels": ["Juniors", "U14"],
  "maxPlayers": 30
}
```

#### `DELETE /api/academy/groups/:id`
Soft delete a group.

**Protection:**
- ❌ Cannot delete if has active players, sessions, or matches

---

## Backend Implementation

### Repository Layer (`academy.repository.js`)

#### Key Methods:

**Birth Years:**
- `findBirthYears(branchId)` - Get all birth years for a branch
- `createBirthYear(data)` - Create new birth year range
- `updateBirthYear(id, data)` - Update birth year range
- `softDeleteBirthYear(id)` - Soft delete birth year
- `findBirthYearOverlap(branchId, normalizedLabel, fromYear, toYear, excludeId)` - Check for overlaps
- `findBirthYearLabels(branchId, normalizedLabels)` - Validate labels exist
- `birthYearHasActiveRelations(branchId, normalizedLabel)` - Check if safe to delete

**Groups:**
- `findGroups(academyId, filters)` - Get all groups with labels
- `findGroupById(id)` - Get single group with labels
- `createGroup(data)` - Create new group
- `updateGroup(id, data)` - Update group
- `softDeleteGroup(id)` - Soft delete group
- `replaceGroupLabels(groupId, normalizedLabels, trx)` - Update group labels
- `clearGroupLabels(groupId)` - Remove all labels from group
- `groupHasActiveRelations(groupId)` - Check if safe to delete

#### Query Optimization:
- ✅ Uses CTEs for label mapping
- ✅ Prevents N+1 queries with proper joins
- ✅ Aggregates labels into JSONB for efficient retrieval
- ✅ Includes player and coach counts in group queries

---

### Service Layer (`academy.service.js`)

#### Key Features:

**Label Normalization:**
```javascript
normalizeLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
```

**Label Derivation:**
```javascript
deriveLabel(label, fromYear, toYear) {
  if (label && String(label).trim()) return String(label).trim();
  if (fromYear === toYear) return String(fromYear);
  return `${fromYear}-${toYear}`;
}
```

**Validation:**
- ✅ Overlap detection for birth year ranges
- ✅ Label existence validation for groups
- ✅ Active relationship checks before deletion
- ✅ Academy/branch ownership verification
- ✅ Coach access scope enforcement

---

### Validation Schema (`academy.schema.js`)

#### Birth Year Schema:
```javascript
createBirthYearSchema = z.object({
  branchId: z.string().uuid(),
  label: z.string().trim().min(1).max(100).optional(),
  fromYear: z.number().int().min(2000).max(2030),
  toYear: z.number().int().min(2000).max(2030),
}).refine((data) => data.fromYear <= data.toYear, {
  message: 'fromYear must be less than or equal to toYear',
  path: ['toYear'],
});
```

#### Group Schema:
```javascript
createGroupSchema = z.object({
  branchId: z.string().uuid(),
  labels: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  name: z.string().min(1).max(50),
  maxPlayers: z.number().int().positive().max(100).default(25),
});
```

---

## Use Cases & Examples

### Use Case 1: Multiple Year Ranges per Label

**Scenario:** Academy wants "Juniors" to include both 2010-2011 and 2012-2013 birth years.

**Implementation:**
```javascript
// Create first range
POST /api/academy/birth-years
{
  "branchId": "branch-uuid",
  "label": "Juniors",
  "fromYear": 2010,
  "toYear": 2011
}

// Create second range with same label
POST /api/academy/birth-years
{
  "branchId": "branch-uuid",
  "label": "Juniors",
  "fromYear": 2012,
  "toYear": 2013
}

// Create group for all Juniors
POST /api/academy/groups
{
  "branchId": "branch-uuid",
  "name": "Juniors Group A",
  "labels": ["Juniors"]
}
```

**Result:** Group automatically includes players from both 2010-2011 and 2012-2013.

---

### Use Case 2: Multiple Labels per Group

**Scenario:** A group serves both "Juniors" and "U12" categories.

**Implementation:**
```javascript
POST /api/academy/groups
{
  "branchId": "branch-uuid",
  "name": "Mixed Group",
  "labels": ["Juniors", "U12"]
}
```

**Result:** Group includes players from all birth year ranges labeled "Juniors" OR "U12".

---

### Use Case 3: Updating Group Labels

**Scenario:** Group needs to change from "Juniors" to "Seniors".

**Implementation:**
```javascript
PUT /api/academy/groups/{group-id}
{
  "labels": ["Seniors"]
}
```

**Result:** 
- Old labels removed from `group_labels`
- New labels added
- Group now includes different birth year ranges

---

## Query Performance

### Indexes Created:
1. `academy_birth_years.normalized_label` - Fast label lookups
2. `academy_birth_years(branch_id, normalized_label)` - Composite for branch-scoped queries
3. `academy_birth_years(branch_id, from_year)` - Range queries
4. `academy_groups.branch_id` - Group-branch joins
5. `group_labels.group_id` - Group label lookups
6. `group_labels.normalized_label` - Label-based filtering
7. `group_labels(group_id, normalized_label)` - Unique constraint + fast lookups

### Query Optimization Techniques:
- ✅ CTE for label mapping to avoid repeated subqueries
- ✅ JSONB aggregation for labels (single query instead of N+1)
- ✅ LEFT JOIN with FILTER for conditional aggregations
- ✅ DISTINCT ON for deduplication
- ✅ Proper use of indexes in WHERE and JOIN clauses

---

## Security & Access Control

### Admin Access:
- ✅ Full CRUD on birth years
- ✅ Full CRUD on groups
- ✅ Can access all branches in their academy

### Coach Access:
- ✅ Read-only access to birth years in assigned branches
- ✅ Read-only access to groups in assigned branches
- ✅ Scoped queries automatically filter by coach assignments

### Validation:
- ✅ Academy ownership verified on all operations
- ✅ Branch ownership verified before exposing data
- ✅ Coach scope enforced through repository layer

---

## Error Handling

### Common Errors:

#### 1. Overlapping Birth Year Ranges
```json
{
  "error": "ConflictError",
  "message": "Birth year range overlaps an existing range for the same label"
}
```

#### 2. Invalid Labels for Group
```json
{
  "error": "NotFoundError",
  "message": "One or more labels do not exist for this branch"
}
```

#### 3. Cannot Delete with Active Relations
```json
{
  "error": "BadRequestError",
  "message": "Cannot delete a group with active players, sessions, or matches"
}
```

#### 4. Invalid Year Range
```json
{
  "error": "ValidationError",
  "message": "fromYear must be less than or equal to toYear"
}
```

---

## Testing Checklist

### Migration Testing:
- ✅ Migration runs successfully on fresh database
- ✅ Migration is idempotent (can re-run safely)
- ✅ Existing data preserved and migrated correctly
- ✅ Rollback works correctly

### API Testing:

**Birth Years:**
- ✅ Create birth year with valid data
- ✅ Create birth year with overlapping range (should fail)
- ✅ Update birth year range
- ✅ Delete birth year without relations
- ✅ Delete birth year with relations (should fail)
- ✅ Get birth years grouped by label

**Groups:**
- ✅ Create group with valid labels
- ✅ Create group with invalid labels (should fail)
- ✅ Update group labels
- ✅ Delete group without relations
- ✅ Delete group with relations (should fail)
- ✅ Get groups with labels and counts

### Edge Cases:
- ✅ Empty label handling
- ✅ Case-insensitive label matching
- ✅ Whitespace normalization
- ✅ Duplicate label removal
- ✅ Coach access scoping

---

## Migration File

**Location:** `golx-backend/migrations/031_birth_years_groups_refactor.js`

**Status:** ✅ Applied (Batch 14)

**Features:**
- Idempotent (safe to re-run)
- Transactional (all-or-nothing)
- Backward compatible rollback
- Data preservation

---

## Future Enhancements

### Potential Improvements:
1. **Bulk Operations:** Add endpoints for bulk birth year creation
2. **Label Templates:** Pre-defined label templates (U8, U10, U12, etc.)
3. **Auto-Assignment:** Automatically assign players to groups based on birth year
4. **Label History:** Track label changes over time
5. **Advanced Filtering:** Filter groups by multiple labels with AND/OR logic
6. **Label Analytics:** Report on label usage and distribution

---

## Conclusion

The Birth Years & Groups refactor successfully transforms the system from a rigid one-to-one relationship to a flexible, label-based architecture. This enables:

- ✅ Multiple year ranges per label
- ✅ Multiple labels per group
- ✅ Flexible grouping strategies
- ✅ Better data organization
- ✅ Improved query performance
- ✅ Soft delete support
- ✅ Backward compatibility

All existing data has been preserved and migrated successfully. The system is now production-ready with comprehensive validation, error handling, and access control.

---

**Migration Applied:** ✅ Success (Batch 14)  
**Backend Updated:** ✅ Complete  
**APIs Tested:** ✅ Ready  
**Documentation:** ✅ Complete  

---

*Last Updated: 2026-05-16*
