# Frontend Birth Years Update

## Changes Made

The frontend has been updated to work with the new Birth Years & Groups refactor.

### Updated Files:

#### 1. `lib/store/api/adminApi.ts`
**Old Interface:**
```typescript
export interface BirthYear {
    id: string;
    branch_id: string;
    year: number;
    label: string | null;
    created_at: string;
}
```

**New Interfaces:**
```typescript
export interface BirthYearRange {
    id: string;
    fromYear: number;
    toYear: number;
}

export interface BirthYearGroup {
    label: string;
    normalizedLabel: string;
    birthYears: BirthYearRange[];
}
```

**API Changes:**
- `getBirthYears` now returns `BirthYearGroup[]` instead of `BirthYear[]`
- `createBirthYear` now accepts `{ branchId, fromYear, toYear, label? }` instead of `{ branchId, year, label? }`

---

#### 2. `app/admin/academy/birth-years/page.tsx`
**Changes:**
- Updated to display birth years grouped by label
- Changed from DataTable to Card-based layout
- Form now has `fromYear` and `toYear` fields instead of single `year` field
- Shows multiple ranges per label in a grouped view

**New UI:**
```
┌─────────────────────────┐
│ 📅 Juniors              │
│ 2 ranges                │
├─────────────────────────┤
│ 2010 - 2011            │
│ 2012 - 2013            │
└─────────────────────────┘
```

---

#### 3. `lib/types.ts`
**Updated:**
- Removed old `BirthYear` interface
- Added `BirthYearRange` and `BirthYearGroup` interfaces
- Removed `birthYearId` from `Group` interface (groups now use labels)

---

## API Response Format

### GET /api/v1/academy/birth-years?branchId={uuid}

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "label": "Juniors",
      "normalizedLabel": "juniors",
      "birthYears": [
        {
          "id": "uuid-1",
          "fromYear": 2010,
          "toYear": 2011
        },
        {
          "id": "uuid-2",
          "fromYear": 2012,
          "toYear": 2013
        }
      ]
    },
    {
      "label": "U12",
      "normalizedLabel": "u12",
      "birthYears": [
        {
          "id": "uuid-3",
          "fromYear": 2012,
          "toYear": 2013
        }
      ]
    }
  ]
}
```

---

## Create Birth Year Form

**Old Form:**
```
Year: [2012]
Label: [Juniors]
```

**New Form:**
```
Label: [Juniors] (optional)
From Year: [2010]
To Year: [2011]
```

**Features:**
- Label is now optional (auto-generated if not provided)
- Supports year ranges (e.g., 2010-2011)
- Can create multiple ranges with the same label

---

## User Experience

### Before:
- One birth year = one entry
- Rigid structure
- Hard to manage multiple years

### After:
- Birth years grouped by label
- Visual card-based layout
- Easy to see all ranges for a label
- Flexible year ranges

---

## Testing

To test the updated frontend:

1. Start the backend: `cd golx-backend && npm run dev`
2. Start the frontend: `npm run dev`
3. Navigate to: `http://localhost:3000/admin/academy/birth-years`
4. Select a branch
5. Click "Add Birth Year Range"
6. Fill in the form:
   - Label: "Juniors" (optional)
   - From Year: 2010
   - To Year: 2011
7. Submit
8. Add another range with the same label:
   - Label: "Juniors"
   - From Year: 2012
   - To Year: 2013
9. Verify both ranges appear under the "Juniors" card

---

## Migration Notes

- ✅ No breaking changes for existing data
- ✅ Old birth years automatically migrated to new format
- ✅ Frontend now displays grouped view
- ✅ All TypeScript types updated
- ✅ No diagnostics or errors

---

## Related Documentation

- Backend refactor: `golx-backend/BIRTH_YEARS_GROUPS_REFACTOR_SUMMARY.md`
- Quick reference: `golx-backend/BIRTH_YEARS_GROUPS_QUICK_REFERENCE.md`
- Schema diagram: `golx-backend/SCHEMA_DIAGRAM.md`
