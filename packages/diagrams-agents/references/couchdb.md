# CouchDB profile

Read [document-data.md](document-data.md) first. Use this when `profile: couchdb`.

## Model these CouchDB facts

- The `database` is the security and replication container. Members who can read the database can
  read every document in it. `validate_doc_update` can reject writes; it does not hide documents.
- Set `partitioned: true` only for a partitioned database. Store ids as `partition:documentId`. Put
  the partition field in `idPattern`, for example `{employeeId}:{shiftId}`.
- A partitioned query reads one partition. A global index reads across partitions. Say which one an
  access path uses.
- One document update is the atomic commit. `_bulk_docs` does not make several documents succeed or
  fail together. `enforcement` is `document` or `application`.
- Replication can create revision conflicts. Same-node concurrent updates return `409`. Name the
  winner or the review queue when offline edits are part of the question.

## Diagnostics this profile adds

| Code    | What it found                                                                                |
| ------- | -------------------------------------------------------------------------------------------- |
| `DM201` | Partitioned document is missing a partition, an id pattern, or the partition inside that id. |
| `DM204` | Invariant reads many documents. CouchDB can commit one document.                             |
| `DM205` | One database declares more than one read audience.                                           |
| `DM206` | Access path crosses partitions.                                                              |

`DM206` can remain on a global query that is an intentional tradeoff. Say that in the assumptions.

## Scheduling check

For employee schedules, test at least these paths: employee week, team or location day, direct HR
profile, and the overlap rule. The employee path and the team path want different partitions. The
overlap rule wants either one document per employee period or application enforcement. HR data with
a narrower audience belongs in another database.
