# AGENTS.md — Startline

## GitHub

The `@modelcontextprotocol/server-github` MCP tool fails for `StartlineAU/startline` (private org repo). It returns "Not Found" despite the token having correct `repo` scope and the API being accessible via raw curl.

Workaround: use `gh` CLI commands instead.
```bash
gh issue list --repo StartlineAU/startline
gh pr list --repo StartlineAU/startline
```
