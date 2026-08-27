# Brief: Expense approval swimlanes

## Reader and question

**Audience:** Employees submitting claims, managers who approve them, and developers implementing the workflow.

**Question:** Who owns each step from submit through policy validation to approval or correction?

**When appropriate:** A true C4-unrelated **swimlane** workflow — horizontal responsibility bands with a shared left-to-right process timeline. Prefer this over owner columns (`refund-request`) when the reader’s question is “who does this step?”

## Facts (established)

- An employee submits an expense claim.
- Automated controls validate policy before a manager sees the claim.
- Invalid claims return to the employee for correction and resubmit.
- The manager either records payment or returns the claim for correction.

## Assumptions

- Policy validation is automated, not a human controls team.
- Correction and reject both land on the employee’s correct step rather than a separate deny sink.
- Thresholds and receipt rules are out of scope.

## Intentional omissions

- BPMN pools, timers, parallel joins.
- Payroll / GL posting internals.
- Nested swimlanes.

## Layout / presentation policy

- Top-level `swimlane` groups; layout infers `groupLayout: swimlane` and `direction: LR`.
- Compact; orthogonal; `groupAccent: false`.
- Semantic styles: `warning` on correction/return, `success` on payment recorded.
- No icons — task/decision shapes already carry the meaning.
- Animations: `Needs correction` and `Approved`.
