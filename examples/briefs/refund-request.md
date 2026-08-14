# Brief: Customer refund request

## Reader and question

**Audience:** Support and finance operators, plus developers implementing the workflow.

**Question:** How does a refund request move through eligibility, inspection, approval, and payout?

**When appropriate:** Business workflow with decisions and clear owner columns.

## Facts

- Customer submits; Support checks return window and condition; Finance applies auto-approve threshold, payout, and close.
- Deny paths converge on case close.

## Assumptions

- Support and Finance are labeled owner columns; the customer submit step sits upstream without an empty lane box.
- Policy thresholds are illustrative.

## Intentional omissions

- Return logistics detail.
- Partial refunds and chargebacks.

## Layout / presentation policy

- LR compound Support | Finance columns (not TD swimlanes — those produced a poster-tall canvas).
- Compact; orthogonal; `groupAccent: false`.
- One deny animation; success styles only on approve/close outcomes.
