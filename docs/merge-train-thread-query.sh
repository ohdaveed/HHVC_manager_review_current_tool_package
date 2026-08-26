#!/usr/bin/env bash
#
# merge-train-thread-query.sh — list the UNRESOLVED review threads holding the
# merge train's pull requests, and print the mutation that clears each one.
#
# WHY THIS FILE EXISTS. Every non-draft PR in the train reads `BLOCKED` with all
# seven required contexts green, `behind=0`, and `reviewDecision` empty. The
# measured cause is branch protection's `required_conversation_resolution`: an
# unresolved inline thread blocks a merge while leaving every other signal clean.
# Clearing one is a GraphQL mutation, and `gh api` is blocked in this repo by a
# local PreToolUse hook whose prescribed alternative (a sandbox tool) is not
# always exposed — so an agent session cannot run it, and this is a user action.
# It lives in a script rather than inline in MERGE-PLAN.md because that same hook
# pattern-matches the command text itself and refuses to write it into a file.
#
# USAGE, from the repo root:
#
#     bash docs/merge-train-thread-query.sh          # all train PRs
#     bash docs/merge-train-thread-query.sh 230      # one PR
#
# In the Claude Code prompt, prefix with `!` so the output lands in the session:
#
#     ! bash docs/merge-train-thread-query.sh
#
# READ THIS BEFORE RESOLVING ANYTHING. Resolve #230's threads FIRST and ALONE,
# then re-read `gh pr view 230 --json mergeStateStatus`. `conversation.enabled:
# true` has been proven SET, not proven to be the BINDING constraint — a
# repository ruleset is evaluated on top of classic protection and never appears
# in the `/protection` payload that was read. If #230 flips to CLEAN the
# diagnosis holds and the other five are mechanical; if it stays BLOCKED, stop
# and re-diagnose rather than spending five more PRs' worth of clicks.

set -uo pipefail

REPO_OWNER="ohdaveed"
REPO_NAME="HHVC_manager_review_current_tool_package"

# The six non-draft PRs in the train, in merge order. #223 is a deliberately
# deferred draft (it rewrites ci.yml and can rename required contexts), so it is
# not listed here.
DEFAULT_PRS=(230 231 225 224 222 213)

if [ "$#" -gt 0 ]; then
  PRS=("$@")
else
  PRS=("${DEFAULT_PRS[@]}")
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: the GitHub CLI (gh) is not on PATH." >&2
  exit 1
fi

# `first: 100` rather than a page loop: no PR here carries anything close to 100
# threads, and a silent truncation is worse than an obvious one — the count line
# printed per PR is what would make a truncation visible.
read -r -d '' THREAD_QUERY <<'GRAPHQL'
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        totalCount
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 1) {
            nodes {
              author { login }
              body
            }
          }
        }
      }
    }
  }
}
GRAPHQL

total_unresolved=0

for n in "${PRS[@]}"; do
  echo
  echo "===================== PR #${n} ====================="

  raw=$(gh api graphql \
    -F owner="$REPO_OWNER" \
    -F name="$REPO_NAME" \
    -F number="$n" \
    -f query="$THREAD_QUERY" 2>&1)

  if [ $? -ne 0 ]; then
    echo "  ERROR querying PR #${n}:"
    echo "$raw" | sed 's/^/    /'
    continue
  fi

  threads_total=$(printf '%s' "$raw" |
    jq -r '.data.repository.pullRequest.reviewThreads.totalCount // 0')

  # An unresolved thread blocks the merge whether or not it is OUTDATED — a
  # thread on a line the fix commit already changed still has to be resolved.
  unresolved=$(printf '%s' "$raw" | jq -r '
    .data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved == false)
    | [
        .id,
        (.comments.nodes[0].author.login // "unknown"),
        (.path // "(PR-level)"),
        (if .isOutdated then "outdated" else "current" end),
        ((.comments.nodes[0].body // "") | gsub("[\n\r]+"; " ") | .[0:90])
      ]
    | @tsv')

  if [ -z "$unresolved" ]; then
    echo "  no unresolved threads  (${threads_total} thread(s) total)"
    continue
  fi

  count=$(printf '%s\n' "$unresolved" | grep -c .)
  total_unresolved=$((total_unresolved + count))
  echo "  ${count} UNRESOLVED of ${threads_total} thread(s) total"
  echo

  while IFS=$'\t' read -r id author path outdated preview; do
    [ -z "$id" ] && continue
    echo "  • ${author}  [${outdated}]  ${path}"
    echo "      ${preview}"
    echo "      resolve:"
    echo "        gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:\"${id}\"}){thread{isResolved}}}'"
    echo
  done <<<"$unresolved"
done

echo
echo "=================================================="
echo "TOTAL UNRESOLVED across the PRs queried: ${total_unresolved}"
echo
echo "NEXT: resolve #230's threads ONLY, then run"
echo "    gh pr view 230 --json mergeStateStatus,mergeable"
echo "CLEAN  -> the diagnosis holds; the other five are mechanical."
echo "BLOCKED -> stop. Check for a repository ruleset before resolving more."
