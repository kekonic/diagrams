# Firestore profile

Read [document-data.md](document-data.md) first. Use this when `profile: firestore`.

## Model these Firestore facts

- Firestore places documents itself. Omit `partition`, `partitioned`, and `scope: partition`.
- Leave `scope` unset for a collection query. Use `scope: direct` for a document get. Use
  `scope: global` for a collection group query. A collection group query needs a collection group
  index, and security rules apply to each matching document.
- A transaction reads every document before it writes. Use `enforcement: transaction` when the rule
  fits in one transaction, or `enforcement: application` when it does not.
- Security rules are per document. One database may hold more than one read audience.

## Diagnostics this profile adds

| Code    | What it found                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------- |
| `DM201` | Database is marked `partitioned`, or a document sets `partition`.                                  |
| `DM204` | Invariant reads many documents and is not a transaction or application rule.                       |
| `DM206` | Access path uses `scope: partition`, or `scope: global` and is therefore a collection group query. |

A collection query with `scope` left unset does not raise `DM206`.
