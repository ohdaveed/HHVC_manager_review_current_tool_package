# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## What exists on the repo today

Measured with `gh label list` on 2026-08-22. **Only `wontfix` exists**, as one of
GitHub's stock labels ("This will not be worked on") — the name matches this
table exactly, so nothing needs remapping.

The other four — `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human` — **do not exist yet**. `gh issue edit --add-label` fails on a
label the repo does not have rather than creating it, so create them once before
the first `/triage` run:

```bash
gh label create needs-triage    --description "Maintainer needs to evaluate this issue"  --color d93f0b
gh label create needs-info      --description "Waiting on reporter for more information" --color fbca04
gh label create ready-for-agent --description "Fully specified, ready for an AFK agent"  --color 0e8a16
gh label create ready-for-human --description "Requires human implementation"            --color 1d76db
```

Re-derive rather than trusting this paragraph — run `gh label list` if the four
above may already have been created.

## Why the defaults were kept rather than mapped onto existing labels

This repo carries GitHub's stock set (`bug`, `enhancement`, `question`,
`help wanted`, …), and several are near-misses for a triage role — `question`
for `needs-info`, `help wanted` for `ready-for-human`. They were deliberately
NOT reused. Those labels already carry their own meaning for human readers, and
overloading one makes a triage state and a topic tag indistinguishable after the
fact: a `question` issue would no longer say whether it is waiting on a reporter
or simply asking something. Distinct triage labels stay orthogonal to the
descriptive ones, so an issue can be both `bug` and `ready-for-agent` without
either label losing its sense.
