# Reviewer

- Commit using the acting agent's name (for example, `codex`) and a corresponding author identity.
- Preserve existing Japanese UI, flashcards, quizzes, import/export, and learning history.
- Keep localStorage key `kntt.reviewer.v2` and compatibility with existing local sets.
- Edit `src/reviewer.html`; run `npm test` and `npm run build` before committing.
- `dist/reviewer.html` must be a standalone HTML with scripts, CSS, icon and manifest embedded. Do not add runtime CDN dependencies.
- Treat downloaded JSON as untrusted. Validate all sets before replacing cached data; escape content before inserting HTML.
- Remote sync must preserve progress for stable set/card identities, retain cached content on failure, and never overwrite local sets.
- Remote content is read-only; users can copy it locally for editing.
- Publish only `tools/reviewer.html` to kntt32/kntt-pages-dev through `.github/workflows/publish.yml`. Do not overwrite unrelated files.
- Never commit credentials. The workflow uses the `PAGES_DEPLOY_KEY` repository secret with a fine-grained personal access token scoped to the destination repository and Contents read/write permission. Pass it as `token`, not `ssh-key`, to actions/checkout.

- Use HTML dialogs or inline messages instead of native alert/confirm/prompt APIs. Keep dialog actions outside the scrolling body and visible on small screens.
- Keep card explanation/edit/delete actions as accessible icons on the right; explanations open a dedicated dialog.
- Use small anchored HTML popovers for the section sort icon and per-set ellipsis menu. Keep edit forms and confirmations as dialogs.
- Per-set sidebar menus may rename a remote set's local display label or dismiss that set on this device; preserve these choices across synchronization without modifying the source JSON or allowing remote card editing.

- Keep UI copy to essential labels and actions. Do not add unsolicited explanatory captions, filler, or display-limit/count summaries.
