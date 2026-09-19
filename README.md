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
