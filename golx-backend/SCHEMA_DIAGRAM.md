# Birth Years & Groups Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ACADEMY STRUCTURE                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  academy_academies   │
│──────────────────────│
│ • id (PK)            │
│ • name               │
│ • owner_user_id      │
│ • logo_url           │
│ • settings           │
└──────────┬───────────┘
           │
           │ 1:N
           │
┌──────────▼───────────┐
│  academy_branches    │
│──────────────────────│
│ • id (PK)            │
│ • academy_id (FK)    │◄────────────────┐
│ • name               │                 │
│ • address            │                 │
│ • location           │                 │
└──────────┬───────────┘                 │
           │                             │
           │ 1:N                         │
           │                             │
           ├─────────────────────────────┼─────────────────────────┐
           │                             │                         │
           │                             │                         │
┌──────────▼───────────┐      ┌──────────▼───────────┐  ┌─────────▼──────────┐
│ academy_birth_years  │      │   academy_groups     │  │  player_profiles   │
│──────────────────────│      │──────────────────────│  │────────────────────│
│ • id (PK)            │      │ • id (PK)            │  │ • id (PK)          │
│ • branch_id (FK)     │      │ • branch_id (FK)     │  │ • branch_id (FK)   │
│ • label              │      │ • name               │  │ • birth_year       │
│ • normalized_label   │◄─┐   │ • max_players        │  │ • ...              │
│ • from_year          │  │   │ • is_active          │  └────────────────────┘
│ • to_year            │  │   │ • deleted_at         │
│ • deleted_at         │  │   └──────────┬───────────┘
└──────────────────────┘  │              │
                          │              │ 1:N
                          │              │
                          │   ┌──────────▼───────────┐
                          │   │    group_labels      │
                          │   │──────────────────────│
                          │   │ • id (PK)            │
                          │   │ • group_id (FK)      │
                          └───┤ • normalized_label   │
                              │ • created_at         │
                              └──────────────────────┘
```

---

## Relationship Flow

### Old System (Before Refactor):
```
Branch → Birth Year (2010) → Group A
Branch → Birth Year (2011) → Group B
Branch → Birth Year (2012) → Group C
```
**Problem:** One group per birth year, inflexible

---

### New System (After Refactor):
```
Branch
  ├── Birth Year: "Juniors" (2010-2011)
  ├── Birth Year: "Juniors" (2012-2013)
  ├── Birth Year: "U12" (2012-2013)
  │
  ├── Group A
  │   └── Labels: ["Juniors"]
  │       → Includes: 2010-2011, 2012-2013
  │
  └── Group B
      └── Labels: ["Juniors", "U12"]
          → Includes: 2010-2011, 2012-2013 (from both labels)
```
**Solution:** Flexible label-based grouping

---

## Data Flow Examples

### Example 1: Creating a Multi-Range Label

```
Step 1: Create Birth Year Ranges
┌─────────────────────────────────────┐
│ POST /api/academy/birth-years       │
│ {                                   │
│   "label": "Juniors",               │
│   "fromYear": 2010,                 │
│   "toYear": 2011                    │
│ }                                   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ academy_birth_years                 │
│ ─────────────────────────────────── │
│ id: uuid-1                          │
│ label: "Juniors"                    │
│ normalized_label: "juniors"         │
│ from_year: 2010                     │
│ to_year: 2011                       │
└─────────────────────────────────────┘

Step 2: Add Another Range
┌─────────────────────────────────────┐
│ POST /api/academy/birth-years       │
│ {                                   │
│   "label": "Juniors",               │
│   "fromYear": 2012,                 │
│   "toYear": 2013                    │
│ }                                   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ academy_birth_years                 │
│ ─────────────────────────────────── │
│ id: uuid-2                          │
│ label: "Juniors"                    │
│ normalized_label: "juniors"         │
│ from_year: 2012                     │
│ to_year: 2013                       │
└─────────────────────────────────────┘

Result: "Juniors" now spans 2010-2013
```

---

### Example 2: Creating a Group with Labels

```
Step 1: Create Group
┌─────────────────────────────────────┐
│ POST /api/academy/groups            │
│ {                                   │
│   "name": "Group A",                │
│   "labels": ["Juniors", "U12"]      │
│ }                                   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ academy_groups                      │
│ ─────────────────────────────────── │
│ id: group-uuid                      │
│ name: "Group A"                     │
│ branch_id: branch-uuid              │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ group_labels                        │
│ ─────────────────────────────────── │
│ group_id: group-uuid                │
│ normalized_label: "juniors"         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ group_labels                        │
│ ─────────────────────────────────── │
│ group_id: group-uuid                │
│ normalized_label: "u12"             │
└─────────────────────────────────────┘

Result: Group A includes all birth years 
        labeled "Juniors" OR "U12"
```

---

## Query Patterns

### Pattern 1: Get Birth Years Grouped by Label

```sql
SELECT 
  normalized_label,
  MIN(label) as label,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'fromYear', from_year,
      'toYear', to_year
    ) ORDER BY from_year
  ) as birth_years
FROM academy_birth_years
WHERE branch_id = $1 
  AND deleted_at IS NULL
GROUP BY normalized_label
ORDER BY normalized_label;
```

**Result:**
```json
[
  {
    "label": "Juniors",
    "normalizedLabel": "juniors",
    "birthYears": [
      { "id": "...", "fromYear": 2010, "toYear": 2011 },
      { "id": "...", "fromYear": 2012, "toYear": 2013 }
    ]
  }
]
```

---

### Pattern 2: Get Groups with Labels

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
WHERE ag.branch_id = $1 
  AND ag.deleted_at IS NULL
GROUP BY ag.id;
```

**Result:**
```json
[
  {
    "id": "...",
    "name": "Group A",
    "labels": [
      { "label": "Juniors", "normalizedLabel": "juniors" },
      { "label": "U12", "normalizedLabel": "u12" }
    ]
  }
]
```

---

## Label Normalization Flow

```
Input Label → Normalization → Storage
─────────────────────────────────────
"Juniors"   → "juniors"    → normalized_label
"JUNIORS"   → "juniors"    → normalized_label
"  Juniors" → "juniors"    → normalized_label
"U-12"      → "u-12"       → normalized_label
"U 12"      → "u 12"       → normalized_label
```

**Normalization Rules:**
1. Convert to lowercase
2. Trim whitespace
3. Collapse multiple spaces to single space

---

## Index Strategy

```
academy_birth_years
├── PRIMARY KEY (id)
├── INDEX (branch_id)
├── INDEX (normalized_label)                    ← Fast label lookups
├── INDEX (branch_id, normalized_label)         ← Branch-scoped queries
└── INDEX (branch_id, from_year)                ← Range queries

academy_groups
├── PRIMARY KEY (id)
└── INDEX (branch_id)                           ← Branch-scoped queries

group_labels
├── PRIMARY KEY (id)
├── UNIQUE (group_id, normalized_label)         ← Prevent duplicates
├── INDEX (group_id)                            ← Group lookups
└── INDEX (normalized_label)                    ← Label filtering
```

---

## Validation Rules

### Birth Years:
```
✓ from_year <= to_year
✓ No overlapping ranges for same (branch_id, normalized_label)
✓ Label auto-generated if not provided
✓ Cannot delete if has active relations
```

### Groups:
```
✓ At least 1 label required
✓ All labels must exist in branch's birth years
✓ Duplicate labels automatically removed
✓ Cannot delete if has active players/sessions/matches
```

---

## Migration Path

```
OLD SCHEMA                    NEW SCHEMA
─────────────────────────────────────────────────────

academy_birth_years           academy_birth_years
├── year (SMALLINT)          ├── from_year (SMALLINT)
├── label (VARCHAR)          ├── to_year (SMALLINT)
└── ...                      ├── normalized_label (VARCHAR)
                             ├── deleted_at (TIMESTAMP)
                             └── ...

academy_groups                academy_groups
├── birth_year_id (FK)       ├── branch_id (FK)
└── ...                      └── ...

                             group_labels (NEW)
                             ├── group_id (FK)
                             ├── normalized_label (VARCHAR)
                             └── created_at (TIMESTAMP)
```

**Migration Steps:**
1. Add new columns to birth_years
2. Backfill data (year → from_year, to_year)
3. Drop old year column
4. Add branch_id to groups
5. Create group_labels table
6. Migrate relationships
7. Drop old birth_year_id column

---

## Use Case Scenarios

### Scenario 1: Age-Based Groups
```
Branch: Main Academy
├── Birth Years:
│   ├── "U8" (2016-2017)
│   ├── "U10" (2014-2015)
│   └── "U12" (2012-2013)
└── Groups:
    ├── "Beginners" → ["U8"]
    ├── "Intermediate" → ["U10"]
    └── "Advanced" → ["U12"]
```

### Scenario 2: Mixed Age Groups
```
Branch: Main Academy
├── Birth Years:
│   ├── "Juniors" (2010-2011)
│   ├── "Juniors" (2012-2013)
│   └── "Seniors" (2008-2009)
└── Groups:
    ├── "Mixed A" → ["Juniors", "Seniors"]
    └── "Juniors Only" → ["Juniors"]
```

### Scenario 3: Flexible Reorganization
```
Initial Setup:
Group A → ["U10"]

Later, expand:
Group A → ["U10", "U12"]

Later, change:
Group A → ["U14"]

No data migration needed!
```

---

## Performance Characteristics

### Query Performance:
- ✅ O(1) label lookups (indexed)
- ✅ O(log n) range queries (B-tree index)
- ✅ Single query for groups with labels (JSONB aggregation)
- ✅ No N+1 queries

### Write Performance:
- ✅ Transactional updates
- ✅ Cascade deletes
- ✅ Minimal lock contention

### Storage:
- ✅ Normalized data (no duplication)
- ✅ Efficient JSONB storage
- ✅ Soft deletes (audit trail)

---

**For complete documentation, see:**
- `BIRTH_YEARS_GROUPS_REFACTOR_SUMMARY.md`
- `BIRTH_YEARS_GROUPS_QUICK_REFERENCE.md`
