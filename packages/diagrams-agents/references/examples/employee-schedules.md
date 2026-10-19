# Employee schedules on CouchDB

Reader question: which schedule reads stay inside one employee partition, and which business rule
can CouchDB not commit atomically?

The source is [employee-schedules.kdiagram](employee-schedules.kdiagram).

## Choices

- `schedules` is partitioned by `employeeId`. The employee-week access uses the partitioned index
  `byEmployeeDate`.
- Team day filters by team, so it uses the global index `byTeamDate`. `DM206` records that this
  crosses partitions. That warning is the tradeoff, not an unfinished diagram.
- HR profiles use another database and another read audience. A direct id lookup opens one profile.
- Overlapping shifts read many shift documents. `enforcement: application` keeps the diagram from
  claiming CouchDB can lock those documents together.

## Left out

Replication conflicts, time zones, payroll export, and the swap-approval workflow. Add them as
another view when one of those is the question.
