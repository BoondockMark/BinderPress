# Extracting an existing binder

1. Commit or back up the content repository and confirm its current public build
   passes before migration.
2. Add `binderpress.config.json`, preserving the existing organization, title,
   section order, section titles, prefixes, folder names, and complete-binder
   filename. Set `indexClass` if existing HTML integration depends on its name.
3. Install the extracted application as a dependency and replace npm script
   commands with `binderpress build`, `binderpress check`, `binderpress editor`,
   `binderpress lint:layout`, `binderpress preview`, and `binderpress setup:private`.
4. Run `binderpress check --public`. This compares regenerated PDFs and indexes
   with the existing committed artifacts without replacing them. With system
   fonts, run this check in the Linux release environment. For local migration
   verification, compare fresh builds from upstream and the extracted application
   on the same machine. Inspect preview
   differences separately before adopting a changed application design.
5. Remove application scripts, editor files, templates, shared print styles,
   and application tests from the content repository. Keep handouts,
   authored graphics, content integration tests, review records, contributor
   policies, generated proofs, and publishing instructions. The `FIX-00` visual
   fixture and its assets belong to the application.
6. Keep private repositories outside public checkouts. Their paths and public
   placeholders do not need to change. Explicitly verify public-only and private
   workflows before publication; never move private material into the app repo.
7. Review and commit the migration. Pin the application to a tested release or
   full Git SHA before independent CI or distribution.

## Emergency-Preparedness migration

The reusable source is published at
https://github.com/BoondockMark/BinderPress. The binder migration pins a tested
full Git commit of that application and retains its independent content, asset,
review, and publication history. New installations need only the content checkout
and `npm ci`; the dependency supplies the editor and renderer.

The application begins from the destination repository's existing license and
README seed. The GPL license and origin attribution are preserved. No handout
collection, private checkout, credentials, generated local links, or original
source repository Git history is copied.

For an application upgrade, review the new application commit, update the full
SHA in the content package manifest, regenerate its lockfile, and run content
tests and `npm run check -- --public`. If expected design changes alter PDFs,
review the proofs before regenerating and committing artifacts. Application
changes are tested in the BinderPress repository; content CI checks the pinned
application against the binder's sources and publication artifacts.

For local development, sibling repositories can temporarily use
`file:../binderpress` after installing dependencies in the application checkout.
Restore the immutable Git or package dependency before distribution.
