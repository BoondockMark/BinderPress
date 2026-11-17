# BinderPress

A local editor and publishing toolkit for reviewed, print-ready handbooks and
binders. Write Markdown with YAML metadata, edit visually, review changes, and
produce US Letter PDFs, browser proofs, a table of contents, and a complete binder.

See the [editor guide](docs/EDITOR.md), [metadata reference](docs/METADATA.md),
and [graphics guide](docs/ASSETS.md) for authoring details.

BinderPress was extracted from the La Habra Heights Fire Watch preparedness
binder. Organization content and private records belong in separate repositories.
This repository includes only application code, design/test fixtures, and a
fictional starter handbook.

## Try it

Requires Node.js 22.12 or newer and npm. Installation downloads the Chrome for
Testing revision selected by the exact Puppeteer dependency and lockfile.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4174. The editor binds only to the local computer. From the
application root, the example handbook is selected automatically. Build it with:

```sh
node bin/binderpress.mjs build --public
```

The bundled starter defaults to public mode, ignoring private-library environment
settings and saved links from other projects. Use `--private` explicitly to test
a private library with the starter. Independent content folders retain their
normal linked-private-library behavior.

If an older clone reports a missing private path while opening the sample, run
`npm start -- --public`. Relative `BINDER_PRIVATE_DIR` values are resolved from
the selected content folder, not from the application folder. In Windows Command
Prompt, `set BINDER_PRIVATE_DIR=` clears that variable for the current terminal.

The sample is a draft and contains no approved advice. Inspect the generated
PDFs in `examples/starter/docs/pdfs/` and PNG proofs in `docs/previews/` beneath
that same content directory.

## Create your own content repository

```sh
node bin/binderpress.mjs init ../my-handbook
node bin/binderpress.mjs editor --content ../my-handbook
node bin/binderpress.mjs build --content ../my-handbook --public
```

Initialization refuses an existing destination. Only the configuration,
handouts, and starter instructions are copied; application files stay here.
Paths containing spaces are supported; quote them in your shell.

The CLI also supports `check`, `lint:layout`, `preview <CODE>`, and
`setup:private`. Run `node bin/binderpress.mjs --help` for details. Once installed
as a dependency, use `binderpress` in npm scripts. The content directory defaults
to the current working directory or `BINDERPRESS_CONTENT_DIR`. Configuration is
loaded once per process; restart the editor after changing it.

## Configure a binder

Put `binderpress.config.json` in the content root:

```json
{
  "title": "Volunteer Handbook",
  "organization": "Example Club",
  "outputName": "VOLUNTEER_HANDBOOK",
  "privateSibling": "club-handbook-private",
  "sections": [
    { "title": "Getting Started", "code": "GET", "folder": "getting-started" },
    { "title": "Reference", "code": "REF", "folder": "reference" }
  ]
}
```

Sections are ordered, with unique three-letter codes, unique folder names, and
titles of at most 22 characters. The current US Letter design supports 1–8
sections. Keep section ordering and published codes stable. `outputName` is an
uppercase filename stem, defaulting to `BINDER`; it cannot be `TABLE_OF_CONTENTS`.
Optional `indexClass` sets the generated HTML index's CSS class. Branding is
escaped when rendered; print geometry still validates whether it fits.

## Content and output

```text
binderpress.config.json        Binder identity and sections
handouts/<section>/*.md        Markdown and YAML metadata
assets/handouts/<CODE>/        Images and asset manifests
docs/publishing/proofs/        Physical proof records for approved documents
docs/pdfs/                    Generated PDFs, contents, and complete binder
docs/previews/                Generated PNG page proofs
docs/moodle-index.html        Approved-public-document upload index
BINDER_INDEX.md               Generated document and review inventory
build/                        Temporary browser files and diagnostics
```

The application owns its print styles, templates, visual baseline, and
editor. Content directories do not supply executable application resources.

The publishing workflow retains draft, under-review, and approved states.
Approval requires distinct editorial and subject-matter reviewers, complete
sources, resolved verification markers, and the existing physical-proof checks.
Passing layout checks does not approve a document. The HTML index uses `PDF_URL`
placeholders for your upload destination; publishing remains a manual handoff.

## Private libraries

Keep private handouts in a separate checkout with matching public placeholder
paths and codes. Set `BINDER_PRIVATE_DIR` or set `privateSibling` and run
`binderpress setup:private` from the content directory. There is no automatic
private-repository discovery unless a sibling name is configured.

The local `.binder-local.json` link must be ignored by Git. Builds include a
linked private library by default. `--public` explicitly builds placeholders;
`--private` requires a private checkout. Private PDFs, diagnostics, and temporary
files remain in the private checkout. Existing editor draft-storage and GitHub
repository-visibility protections are retained.

Save & PR additionally requires Git, the GitHub CLI authenticated with repository
write access, and a content repository whose `origin` points to GitHub. It creates
draft pull requests for selected handouts and assets.

## Development and release

```sh
npm test
npm run build:public
npm pack --dry-run
```

Tests include browser editing, conflict handling, private-library isolation,
publication protections, configuration validation, and content-only startup.
Rendering uses the Arial/Helvetica/system sans-serif stack, a fixed viewport,
and the lockfile-selected browser. Fonts are embedded in generated PDFs;
PDF bytes can differ across operating systems. Linux CI produces release artifacts;
the build rejects overflow and compares component proofs with a reviewed visual
baseline. `npm run test:visual:update` updates the application baseline only
after intentional design review.

For release, create the GitHub repository, push the reviewed source, tag the
tested commit, and pin consumers to that commit or an immutable package version.
During local extraction, sibling content projects can use `file:../binderpress`.
Replace that development link before independent distribution. See
[migration notes](docs/MIGRATION.md).

## License

Application code retains the source project's GNU GPL version 3 license. No fonts are bundled or downloaded. Design assets retain their existing
manifest credits. A binder's content and contributed images need their own
applicable permissions and attribution; do not assume the application license
relicenses third-party material.
