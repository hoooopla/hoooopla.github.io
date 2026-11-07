import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { createNoteReader } from '../vendor/math-note-editor/packages/note-reader/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.NOTES_WORKSPACE || path.join(root, 'notes-workspace'));
const output = path.resolve(process.env.NOTES_OUTPUT || path.join(root, 'notes'));
const strict = process.env.NOTES_STRICT === '1';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => encodeURIComponent(s);
const urlFor = note => `${slug(note.id)}.html`;
const errors = [];
const notes = [];
const byLabel = new Map();
const paths = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'assets' && entry.name !== 'setting') walk(full); }
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) paths.push(full);
  }
}
walk(source);
for (const file of paths.sort()) {
  const text = fs.readFileSync(file,'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/.exec(text);
  if (!match) { errors.push(`${path.relative(source,file)}: missing YAML frontmatter`); continue; }
  let data;
  try { data = YAML.parse(match[1]); } catch (e) { errors.push(`${path.relative(source,file)}: invalid frontmatter: ${e.message}`); continue; }
  if (!data || typeof data !== 'object' || !['id','title','label'].every(k => typeof data[k] === 'string' && data[k].trim())) {
    errors.push(`${path.relative(source,file)}: id, title, label must be nonempty strings`); continue;
  }
  const note = { id:data.id.normalize('NFC'), title:data.title.normalize('NFC'), label:data.label.normalize('NFC'), body:match[2], file };
  if (notes.some(n => n.id === note.id)) errors.push(`${path.relative(source,file)}: duplicate id ${note.id}`);
  if (byLabel.has(note.label)) errors.push(`${path.relative(source,file)}: duplicate label ${note.label}`);
  notes.push(note); byLabel.set(note.label,note);
}
const {render, renderTitle, refs, outgoing} = createNoteReader({source, notes, byLabel, errors});
function shell(title, contents, page='notes') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(title)} — hoooopla</title><link rel="icon" href="../favicon.svg"><link rel="stylesheet" href="../style.css"><link rel="stylesheet" href="../notes.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css"></head><body data-page="${page}"><a class="skip-link" href="#content">Skip to content</a><header class="site-header"><a class="site-mark" href="../index.html"><span>H</span><small>Mathematics</small></a><nav class="site-nav" aria-label="Main navigation"><a href="../index.html">About</a><a href="../files.html">Files</a><a href="index.html" aria-current="page">Notes</a><a href="../blog.html">Blog</a><a href="https://hoooopla.github.io/Math-Note-Editor/">Editor ↗</a></nav></header><main id="content">${contents}</main><footer class="site-footer"><span>© ${new Date().getFullYear()} hoooopla</span><span>Mathematical notes, connected by ideas.</span></footer></body></html>`;
}
const outputIndex = `<div class="notes-heading"><p class="coordinate">03 / Knowledge base</p><h1>Notes</h1><p class="page-lead">A growing collection of mathematical ideas. Follow a reference to see how they connect.</p></div><div class="notes-search"><label for="note-search">Find a note</label><input id="note-search" type="search" placeholder="Search titles and labels…" autocomplete="off"></div><div class="notes-index" id="notes-index">${notes.length ? notes.sort((a,b)=>a.label.localeCompare(b.label)).map(n=>`<a class="note-index-item" href="${urlFor(n)}" data-search="${escape((n.title+' '+n.label).toLowerCase())}"><span class="note-label">${escape(n.label)}</span><strong>${renderTitle(n.title)}</strong><span aria-hidden="true">↗</span></a>`).join('') : '<div class="empty-state"><p>No notes published yet. Add Markdown files to <code>notes-workspace/</code> and run the notes build.</p></div>'}</div><script src="../notes.js" defer></script>`;
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
const assetFolder=path.join(source,'assets');if(fs.existsSync(assetFolder))fs.cpSync(assetFolder,path.join(output,'assets'),{recursive:true});
fs.writeFileSync(path.join(output,'index.html'),shell('Notes',outputIndex));
for(const note of notes) {
  const body=render(note);
  const ancestors=note.label.split('/').slice(0,-1).map((_,i)=>note.label.split('/').slice(0,i+1).join('/'));
  const tree=notes.filter(n=>n.label===note.label || n.label.startsWith(note.label+'/') || ancestors.includes(n.label));
  const sidebar=tree.sort((a,b)=>a.label.localeCompare(b.label)).map(n=>`<a class="tree-link ${n.id===note.id?'selected':''}" style="--depth:${Math.max(0,n.label.split('/').length-1)}" href="${urlFor(n)}">${renderTitle(n.title)}</a>`).join('');
  const hasTopic=tree.length>1;
  const topic=hasTopic?`<aside class="note-tree" aria-label="Nearby notes"><a class="back-link" href="index.html">← All notes</a><p class="side-label">Topic</p>${sidebar}</aside>`:'';
  const example=note.label.startsWith('showcase:')?'<p class="example-label">Example from Math Note Editor · Read-only</p>':'';
  const contents=`<div class="note-layout${hasTopic?'':' reading-wide'}">${topic}<article class="note-paper">${hasTopic?'':'<a class="back-link" href="index.html">← All notes</a>'}<div class="note-block"><header class="note-block-header"><h1>${renderTitle(note.title)}</h1><span class="note-kicker">${escape(note.label)}</span></header><div class="note-content">${body}</div></div>${example}</article><aside class="note-context"><p class="side-label">In this note</p><div class="note-toc"></div><p class="side-label">References</p><div class="note-outgoing"></div><p class="side-label">Backlinks</p><div class="note-backlinks"></div></aside></div><script src="../notes.js" defer></script>`;
  fs.writeFileSync(path.join(output,urlFor(note)),shell(note.title,contents));
}
for(const note of notes) {
  const p=path.join(output,urlFor(note));let html=fs.readFileSync(p,'utf8');
  const list=labels=>[...labels].sort().map(label=>`<a href="${urlFor(byLabel.get(label))}">${renderTitle(byLabel.get(label).title)}</a>`).join('') || '<span class="side-empty">None yet</span>';
  html=html.replace('<div class="note-outgoing"></div>',`<div class="note-outgoing">${list(outgoing.get(note.label))}</div>`).replace('<div class="note-backlinks"></div>',`<div class="note-backlinks">${list(refs.get(note.label))}</div>`);
  fs.writeFileSync(p,html);
}
const unique=[...new Set(errors)];
for(const issue of unique) console.warn(`Notes: ${issue}`);
console.log(`Built ${notes.length} notes into ${output}; ${unique.length} issue(s).`);
if(strict && unique.length) process.exitCode=1;
