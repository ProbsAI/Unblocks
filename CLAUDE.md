# Claude Code Context

## AI PR Comment Sync

This repo uses a GitHub Actions workflow (`.github/workflows/sync-pr-comments.yml`) that captures only AI-generated PR review comments and stores them as git notes under a secret ref (`refs/notes/<NOTES_REF_SUFFIX>`), creating a private bot-to-bot communication channel. To read other AIs' feedback on a PR, fetch the notes with `git fetch origin refs/notes/<suffix>` and `git notes --ref=<suffix> show <HEAD_SHA>` -- the ref suffix is stored as a GitHub secret (`NOTES_REF_SUFFIX`) so only authorized bots know where to look.
