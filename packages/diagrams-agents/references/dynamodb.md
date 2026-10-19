# DynamoDB profile

Read [document-data.md](document-data.md) first. Use this when `profile: dynamodb`.

## Model these DynamoDB facts

- Every table has a partition key. Set `partition` to that attribute. A sort key uses the `sort`
  role. The partition key is an attribute, so it does not have to appear in `idPattern`.
- `scope: partition` is a Query on that partition key. `scope: direct` is a GetItem.
- A Query on the base table cannot cross partition keys. Model that read as its own access path:
  a global secondary index (`index` with `scope: global`) or a Scan. A global secondary index has
  its own partition key, is eventually consistent by default, and has its own throughput.
- A local secondary index stays on the table partition key. Give it `scope: partitioned`.
- `TransactWriteItems` commits up to 100 items and can cross partition keys. Use
  `enforcement: transaction` for that, or `enforcement: application` when the rule is larger.
- IAM authorizes the table and index. One table may serve more than one read audience.

Leave `partitioned` unset. `partitioned: false` disagrees with DynamoDB.

## Diagnostics this profile adds

| Code    | What it found                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------ |
| `DM201` | Document has no partition key, or the database is marked `partitioned: false`.                         |
| `DM204` | Invariant reads many items and is not a transaction or application rule.                               |
| `DM206` | Access path crosses partition keys. The hint distinguishes a missing global index from a declared one. |
