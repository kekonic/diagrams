# Document data models

Use this when the diagram explains how application data is stored and read in a document database.
Start from access paths and invariants. Add fields that those paths and rules require.

## Finish when

Every important read or write names its document, scope, and supporting index or direct id lookup.
Every invariant says whether it reads one document or many, and where it is enforced. Facts,
database guarantees, and assumptions are separate.

## Steps

1. Name the physical container as a `database` group. Set `profile` to `couchdb`, `mongodb`,
   `dynamodb`, `cosmosdb`, or `firestore`, then read that profile reference before choosing
   partition keys.
   - [couchdb.md](couchdb.md)
   - [mongodb.md](mongodb.md)
   - [dynamodb.md](dynamodb.md)
   - [cosmosdb.md](cosmosdb.md)
   - [firestore.md](firestore.md)
2. List the access paths before choosing fields. For each path record the actor, filters, sort,
   result size, frequency when it is known, consistency, and read audience. Leave frequency blank
   when nobody supplied it.
3. Write each business rule as an `invariant`. Record `reads: one` or `reads: many` and
   `enforcement`: `document`, `partition`, `transaction`, or `application`. Use a value the profile
   reference says that database can commit.
4. Propose two storage shapes when a partition that serves one path makes another path cross
   partitions. Keep the path each shape serves visible.
5. Declare `document` fields only for identity, the access path, and the invariant. Nest objects
   and arrays in `fields`. Mark `required`, `partition`, `sort`, `ref`, and `copy` explicitly.
6. Point each `access` at its document with `on` and the scope that profile uses:
   - `direct` for an id or key lookup
   - `partition` for one partition
   - `global` for a read that leaves that partition
7. Point `using` at an `index` whose `keys` cover that path. Set the index `scope` to `partitioned`
   or `global` when the profile distinguishes them.
8. When the profile says one read grant covers the whole database, put different read audiences in
   different `database` groups. Otherwise one database may declare more than one audience.
9. Validate with `kdiagrams check`. Read `DM201`–`DM210` and repair the model before tuning layout.
   Split the picture when one view is trying to show schema, every query, replication, and security
   together.

## Checks

These run for every database, including one with no profile:

| Code    | What it found                                                             |
| ------- | ------------------------------------------------------------------------- |
| `DM203` | Access path is not a direct lookup and has no index on the same document. |
| `DM207` | `partition` does not name a field marked `partition`.                     |
| `DM208` | Index key is not a field on the target document.                          |
| `DM209` | Access scope and index scope disagree.                                    |
| `DM210` | Access, index, or invariant names a missing node.                         |

`DM202` warns when `profile` is set and is not one of the five names above.

The profile reference owns `DM201` (partition key), `DM204` (atomic commit), `DM205` (read
audience), and `DM206` (a read that leaves one partition). `DM206` can remain when the cross-partition
read is an intentional tradeoff. Say that in the assumptions.

## Source shape

```kdiagram
database schedules "schedules" {
  profile: couchdb
  partitioned: true
  audience: "schedule readers"

  shift: document "Shift assignment" {
    idPattern: "{employeeId}:{shiftId}"
    partition: employeeId
    fields {
      employeeId: string required partition
      startsAt: datetime required
    }
  }

  byEmployeeDate: index "By employee and start" {
    on: shift
    scope: partitioned
    keys: [employeeId, startsAt]
  }
}

employeeWeek: access "Employee week" {
  on: shift
  scope: partition
  using: byEmployeeDate
}
```

The compiler draws the access and index links. A `document` without `fields` stays the flowchart
document shape.

## Worked example

[employee-schedules.md](examples/employee-schedules.md) shows an employee partition, a global team
query, a separate HR database, and an overlap rule the application enforces. The source is
[employee-schedules.kdiagram](examples/employee-schedules.kdiagram).
