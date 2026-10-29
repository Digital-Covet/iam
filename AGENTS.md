# Research first

Your training data is outdated. Treat your memory of any library, framework, SDK, CLI,
config format or external API as possibly stale.

Before WRITING or CHANGING code that uses a third-party library/framework/SDK/CLI:
1. Check the installed version first (package.json + lockfile, requirements.txt /
   pyproject.toml, go.mod, Cargo.toml, etc.).
2. Look up the docs for THAT version with Context7 (resolve-library-id, then query docs
   for the specific API you're about to use). If Context7 has nothing, use web search.
3. Use only APIs confirmed in those docs. Never use deprecated or removed APIs; if the
   existing code uses one, point it out and suggest the current replacement.
4. When adding a new dependency, check its current version and install command with web
   search instead of guessing.

Before ANSWERING: anything that can change (versions, releases, pricing, best practices,
security advisories, model IDs, news) or any URL the user pastes → search the web first
(Exa if available, otherwise the agent's built-in web search/fetch).

Skip lookups only for pure language basics or when the relevant docs are already in the chat.
Say briefly which source you checked. If a lookup fails, say so — do not silently fall
back to memory.
