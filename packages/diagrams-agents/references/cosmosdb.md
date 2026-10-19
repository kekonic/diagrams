# Cosmos DB profile

Read [document-data.md](document-data.md) first. Use this when `profile: cosmosdb`.

## Model these Cosmos DB facts

- Every container has a partition key. Set `partition` to that path's field. The key is a field, so
  it does not have to appear in `idPattern`.
- A query that includes the partition key stays in one logical partition. A query that omits it
  crosses partitions, which is allowed and billed in request units. Mark the cross-partition read
  `scope: global`.
- A transactional batch commits documents that share one partition key. Use `enforcement: partition`
  for that rule. A rule that crosses partition keys is `enforcement: application`.
- Authorization sits below the database. One database may hold more than one read audience.

Leave `partitioned` unset. `partitioned: false` disagrees with Cosmos DB.

## Diagnostics this profile adds

| Code    | What it found                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- |
| `DM201` | Document has no partition key, or the database is marked `partitioned: false`.                |
| `DM204` | Invariant reads many documents and claims a single document or a multi-partition transaction. |
| `DM206` | Access path crosses partitions. Keep it when the request-unit cost is an accepted tradeoff.   |
