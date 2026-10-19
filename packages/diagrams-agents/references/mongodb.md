# MongoDB profile

Read [document-data.md](document-data.md) first. Use this when `profile: mongodb`.

## Model these MongoDB facts

- Set `partitioned: true` on a sharded database. `partition` is the shard key field. Leave it out of
  `idPattern` unless the shard key really is part of `_id`.
- A query that includes the shard key is targeted. A query that misses it scatters across shards.
  Mark that access `scope: global`.
- One document is the default commit. A multi-document transaction is bounded. Name it with
  `enforcement: transaction` when the rule depends on one, or `enforcement: application` when the
  application coordinates it.
- Authorization is by database and collection role. One database may hold more than one read
  audience. `DM205` stays quiet.

## Diagnostics this profile adds

| Code    | What it found                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- |
| `DM201` | Sharded document has no shard key. An `_id` that omits the shard key is fine.                 |
| `DM204` | Invariant reads many documents and is not a transaction or application rule.                  |
| `DM206` | Sharded access path misses the shard key and scatters. Unsharded databases do not raise this. |

An unsharded database leaves `partitioned` unset. A global index on that database is an ordinary
secondary index.
