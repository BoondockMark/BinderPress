# Your handbook content

This folder is independent of the BinderPress application. Keep it in its own
repository to manage your Markdown handouts, images, configuration, review
records, and generated PDFs.

With BinderPress installed, run `binderpress editor --content .` to edit and
`binderpress build --content .` to generate print artifacts. All example content
is fictional and remains draft until reviewed.

Edit `binderpress.config.json` to set your organization, binder title, output
filename, and sections. Section codes contain three uppercase letters; section
titles are limited to 22 characters by the printed edge tabs. The current US
Letter layout supports up to eight sections. Keep existing codes and section
ordering stable once documents have been published.

For images, use `assets/handouts/<CODE>/` and its asset manifest; the editor can
create these for you. Builds write working files to `build/` and publication
artifacts to `docs/pdfs/`, `docs/previews/`, `docs/moodle-index.html`, and
`BINDER_INDEX.md`. The HTML index contains approved public handouts only and
uses `PDF_URL` as the upload destination placeholder.

Private material belongs in a separate checkout. Set `BINDER_PRIVATE_DIR` or use
`privateSibling` in the configuration and run `binderpress setup:private`.
Use `--public` to explicitly build placeholders. Private builds and diagnostics
stay in the private checkout. Never commit `.binder-local.json`.
