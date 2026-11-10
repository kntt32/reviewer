# Reviewer

- Commit as `codex` (`codex@users.noreply.github.com`).
- Preserve existing Japanese UI, flashcards, quizzes, import/export, and learning history.
- Keep localStorage key `kntt.reviewer.v2` and compatibility with existing local sets.
- Edit `src/reviewer.html`; run `npm test` and `npm run build` before committing.
- `dist/reviewer.html` must be a standalone HTML with scripts, CSS, icon and manifest embedded. Do not add runtime CDN dependencies.
- Treat downloaded JSON as untrusted. Validate all sets before replacing cached data; escape content before inserting HTML.
- Remote sync must preserve progress for stable set/card identities, retain cached content on failure, and never overwrite local sets.
- Remote content is read-only; users can copy it locally for editing.
- Publish only `tools/reviewer.html` to kntt32/kntt-pages-dev through `.github/workflows/publish.yml`. Do not overwrite unrelated files.
- Never commit credentials. The workflow uses the `PAGES_DEPLOY_KEY` repository secret with a fine-grained personal access token scoped to the destination repository and Contents read/write permission. Pass it as `token`, not `ssh-key`, to actions/checkout.
