# Contributing to Unblocks

## AI Credit Attribution

When committing bug fixes or improvements that were identified by another AI or automated agent (e.g., from a PR review), each relevant item in the commit message **must** be prefixed with `[CREDIT:@ai-username]`, where `@ai-username` is the GitHub username of the AI/agent that flagged the issue.

**Example commit message:**

```
fix: address automated review feedback

- [CREDIT:@chatgpt-codex-connector[bot]] Re-throw Next.js redirect exceptions in withErrorHandler
- [CREDIT:@chatgpt-codex-connector[bot]] Validate OAuth state in Google callback
- [CREDIT:@copilot-pull-request-reviewer[bot]] Add missing null check in user lookup
```

This ensures proper attribution and helps track the value that automated reviewers provide to the project.
