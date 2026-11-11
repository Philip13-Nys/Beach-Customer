## Graphify code context

Use the globally configured `graphify` MCP server for code structure, architecture, call paths, dependencies, change impact, and linked tests when its tools are available. Use workspace `philip-s-workspace` and pass the repository below explicitly so queries do not target another project.

Repository: Philip13-Nys/Beach-Customer

- Use `list_repositories` to confirm index readiness when needed; use `query_graph`, symbol lookup, callers/callees, impact, and test tools as appropriate.
- Treat the graph as an indexed snapshot. Check current local files before making changes, especially uncommitted changes and files newer than the indexed commit. Use local search for literal strings, configuration values, missing results, and unindexed content.
- If the MCP tools are unavailable or the free quota is exhausted, continue with local files and briefly report that Graphify was unavailable. Never claim a Graphify query ran unless it returned a result.
- Use only the existing free Graphify plan. Do not start a trial, upgrade, subscribe, add billing, use paid APIs, or upload additional data to another service. Do not save shared Graphify memories unless explicitly requested.
