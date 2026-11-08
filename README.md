# hoooopla.github.io

A minimal personal website for GitHub Pages, with a profile, categorized file archive, an empty math blog, and a link to the Math Note Editor.

## Preview the website locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Fill in your personal information

Open `site-data.js` and edit the `profile` section near the top:

- `name`: your displayed name
- `headline`: one short line describing the focus of the website
- `location`: your city, country, institution, or a broader region
- `email`: your public contact email address
- `bio`: one or more paragraphs; keep each paragraph inside quotation marks
- `links`: your public links; remove any you do not want

The homepage is the About page and is generated from those values automatically. You do not need to edit `index.html` for normal profile changes. Leave a field empty if you do not want to publish it. The old `about.html` address forwards to the homepage.

## Add a downloadable file

1. Put the file in the matching folder:
   - `downloads/works/`
   - `downloads/notes/`
   - `downloads/resources/`
2. Open `site-data.js`.
3. Find the matching category and add an item inside its `files: []` list:

```js
files: [
  {
    title: "Linear Algebra Notes",
    description: "Notes from my first course in linear algebra.",
    path: "downloads/notes/linear-algebra.pdf",
    type: "PDF",
    size: "1.4 MB",
    date: "2026-09-18"
  }
]
```

Commit both the uploaded file and the change to `site-data.js`. The Files page and its category page will update automatically.

Use simple lowercase filenames without spaces when possible, such as `linear-algebra.pdf`.

## Add or rename a file category

Categories also live in `site-data.js`. Each one needs:

- a unique lowercase `id` without spaces
- a displayed `name`
- a short `description`
- a `files` list

The website creates the category cards and category pages automatically.

## Start the math blog later

`blog.html` is intentionally empty except for its heading and blank state. When you are ready, create a `blog/` folder for articles and replace the blank state with links to them. Add MathJax to the article template when the first mathematical post is created.

## Publish

Push the changes to the repository's GitHub Pages publishing branch. For a user site named `hoooopla.github.io`, this is usually the `main` branch.

## Publish Math Note Editor workspace notes

Put the `.md` files you want public in `notes-workspace/`. Nested directories are fine; labels in YAML frontmatter, rather than filenames, determine their position in the notes. Put referenced images in `notes-workspace/assets/`, and optionally copy `setting/settings.json` for KaTeX macros. **Everything in this folder is public after you push it.**

A note begins with:

```md
---
id: stable-id
title: A note title
label: analysis/sequences
---
Content with $inline$ math, \[display math\], and [[other/label]].
```

`[[other/label∨]]` starts expanded; `[[other/label]]` starts collapsed. Click either title to toggle the embedded note in place. `[[@label]]` uses the editor's larger standout title. Both styles work recursively, including relative `[[/child]]` links; cycles stop at a link to the note. Aliases such as `[[label || display text]]` work too. Each expanded block also has an “Open note ↗” link to its own page. Note titles can contain `$math$`, and isolated `_underscores_` render as underlines. The reading outline includes headings and visible embeds. Raw HTML is sanitized; local images must be under `assets/`. See the published `showcase:render-demo` example for nested inline, standout, and math rendering.

Clone with the editor's shared reader and preview locally:

```sh
git clone --recurse-submodules https://github.com/hoooopla/hoooopla.github.io
cd hoooopla.github.io
npm ci
npm test
npm run build:notes
python3 -m http.server 8000
```

If you already cloned the site, run `git submodule update --init`. Visit `http://localhost:8000/notes/`. The build reports broken references, duplicate labels, and missing assets. To make these errors fail the build, run `NOTES_STRICT=1 npm run build:notes`. Pushing to `main` triggers the GitHub Actions notes build, which commits generated `notes/` pages to the repository. GitHub Pages then serves them from the existing branch-based site.

The website imports the read-only renderer and syntax rules from its pinned `vendor/math-note-editor` submodule. The editor also imports those syntax rules, so changes to aliases, relative labels, title math, and embed structure belong in the editor repository. To adopt a new editor reader version, advance the submodule commit, run the tests and build, and commit its pointer. The website's `notes.css` owns its appearance: edit the `--reader-*` variables in `.note-block` for fonts, colours, spacing, indent, and standout size without changing embedded note semantics.
