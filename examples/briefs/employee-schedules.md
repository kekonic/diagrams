# Brief: Employee schedules

## Reader and question

**Audience:** Developers choosing a CouchDB document model for HR scheduling.

**Question:** Which reads stay inside one employee partition, and which business rules CouchDB cannot enforce atomically?

**When appropriate:** Document model for schedule access paths, not a relational ERD.

## Facts

- Schedule documents and HR profiles have different read audiences, so they live in different CouchDB databases.
- A partitioned database uses `_id` values shaped as `{partition}:{documentId}`.
- An employee reading their own week is a partition query on `employeeId` plus `startsAt`.
- A manager reading one team and day crosses employee partitions and uses a global index.
- Opening an HR profile is a direct document lookup.
- "No overlapping shifts" reads many shift documents. CouchDB commits one document at a time, so the application enforces it.

## Assumptions

- CouchDB 3 partitioned databases and Mango JSON indexes.
- One organization is already implied by the database boundary.
- Team-day results may be served by a global index rather than a duplicated team projection.

## Intentional omissions

- Replication, revision conflicts, and offline edits.
- Time zones and pay-period exports.
- Swap requests and approval workflow.

## Layout / presentation policy

- Access paths are a left-hand stack. Schedules and HR databases follow in a row.
- The shift document sits beside its indexes. Compact density, orthogonal routes, kind subtitles on.
