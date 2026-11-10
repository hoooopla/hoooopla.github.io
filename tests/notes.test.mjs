import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve('scripts/build-notes.mjs');
const make = () => fs.mkdtempSync(path.join(os.tmpdir(),'notes-site-'));
const build = (source,output,strict=true) => execFileSync(process.execPath,[root],{env:{...process.env,NOTES_WORKSPACE:source,NOTES_OUTPUT:output,NOTES_STRICT:strict?'1':'0'},encoding:'utf8'});
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('renders one-level pages and fetchable fragments with math, references and assets', t => {
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'workspace'),output=path.join(dir,'output');
  fs.mkdirSync(path.join(source,'assets'),{recursive:true});fs.mkdirSync(path.join(source,'nested'));
  fs.writeFileSync(path.join(source,'assets','graph.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  fs.writeFileSync(path.join(source,'root.md'),'---\nid: root\ntitle: Sequences $x^2$\nlabel: analysis/sequences\n---\n## Definition\nLet $a_n$ converge and _underlined_ matter.\n\\[\\lim_{n\\to\\infty}a_n=a\\]\nIn the same line \\[a^2+b^2=c^2\\] then continue.\n\n[[@/convergence∨]]\n\n![Graph](assets/graph.svg)\n');
  fs.writeFileSync(path.join(source,'nested','child.md'),'---\nid: child\ntitle: Convergence\nlabel: analysis/sequences/convergence\n---\n### Embedded heading\nA sequence $z^2$. [[analysis/sequences || Parent]]\n');
  build(source,output);
  const page=fs.readFileSync(path.join(output,'root.html'),'utf8');
  const fragment=fs.readFileSync(path.join(output,'child.fragment.html'),'utf8');
  assert.match(page,/class="embed-title standout-embed" aria-expanded="true"/);
  assert.match(page,/class="note-embed standout-embed"[^>]*><div class="embed-content"><\/div>/);
  assert.doesNotMatch(page,/Embedded heading/);
  assert.match(fragment,/<h3>Embedded heading<\/h3>/);
  assert.match(fragment,/class="katex/);
  assert.match(page,/class="katex-display"/);
  assert.match(page,/assets\/graph.svg/);
  assert.match(page,/<span class="note-underline">underlined<\/span>/);
  assert.match(page,/data-note-id="root"/);
  assert.ok(fs.existsSync(path.join(output,'assets','graph.svg')));
  assert.match(fs.readFileSync(path.join(output,'child.html'),'utf8'),/Backlinks/);
});

test('strict build rejects duplicate labels and broken references',t=>{
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'one.md'),'---\nid: one\ntitle: One\nlabel: same\n---\n[[missing]]');
  fs.writeFileSync(path.join(source,'two.md'),'---\nid: two\ntitle: Two\nlabel: same\n---\n');
  assert.throws(()=>build(source,path.join(dir,'out')));
});

test('renders Math Note Editor viewer workspace image fixture',t=>{
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'output');build(path.resolve('tests/fixtures/editor-viewer'),output);
  const page=fs.readFileSync(path.join(output,'viewer-image-test.html'),'utf8');
  assert.match(page,/src="assets\/test-image.svg"/);
  assert.match(fs.readFileSync(path.join(output,'viewer-image-test.fragment.html'),'utf8'),/src="assets\/test-image.svg"/);
  assert.doesNotMatch(page,/src="\/api\/assets/);
});

test('editor starter notes build into pages and shallow fragments',t=>{
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'output');
  assert.match(build(path.resolve('tests/fixtures/editor-starter'),output),/Built 8 notes.*0 issue\(s\)/);
  const pages=fs.readdirSync(output).filter(file=>file.endsWith('.html')&&!file.endsWith('.fragment.html'));
  assert.equal(pages.length,9);
  const welcome=fs.readFileSync(path.join(output,`${id(1)}.html`),'utf8');
  const math=fs.readFileSync(path.join(output,`${id(5)}.fragment.html`),'utf8');
  assert.match(welcome,/<button type="button" class="embed-title inline-embed" aria-expanded="true"/);
  assert.match(welcome,/<button type="button" class="embed-title inline-embed" aria-expanded="false"[^>]*>Math<\/button>/);
  assert.match(welcome,/<span class="note-underline">underline<\/span>/);
  assert.doesNotMatch(welcome,/This text belongs to a separate note/);
  assert.match(math,/class="katex-display"/);
  assert.match(fs.readFileSync(path.join(output,`${id(2)}.fragment.html`),'utf8'),/This text belongs to a separate note/);
});

test('published rendering examples cover open and closed inline and standout, nested math and editor-style quotes',t=>{
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'output');
  assert.match(build(path.resolve('notes-workspace'),output),/Built 15 notes.*0 issue\(s\)/);
  const root=fs.readFileSync(path.join(output,`${id(12)}.html`),'utf8');
  const inline=fs.readFileSync(path.join(output,`${id(13)}.fragment.html`),'utf8');
  const standout=fs.readFileSync(path.join(output,`${id(14)}.fragment.html`),'utf8');
  const nested=fs.readFileSync(path.join(output,`${id(15)}.fragment.html`),'utf8');
  assert.match(root,/<blockquote>.*This is a &gt; quote/s);
  assert.match(root,/This second quoted line stays on the next line/);
  assert.match(root,/class="katex-display"/);
  assert.match(root,/first note<\/button><\/p><div class="note-embed inline-embed"[^>]* hidden>/);
  assert.match(root,/open note<\/button><\/p><div class="note-embed inline-embed"/);
  assert.match(root,/class="embed-title standout-embed" aria-expanded="false"[^>]*>Closed standout<\/button>/);
  assert.match(root,/class="embed-title standout-embed" aria-expanded="true"[^>]*>Open standout<\/button>/);
  assert.doesNotMatch(root,/A heading inside an inline note|Math in a standout body/);
  assert.match(inline,/A heading inside an inline note/);
  assert.match(inline,/deeper note open<\/button>/);
  assert.match(standout,/Math in a standout body/);
  assert.match(standout,/class="katex-display"/);
  assert.match(nested,/return reference/);
  assert.match(fs.readFileSync('notes.css','utf8'),/blockquote \{ border: 0;[^}]*color: #cbf0ff; font-weight: 700/);
});

test('relative standout aliases and math in titles use editor syntax',t=>{
  const dir=make();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'workspace'),output=path.join(dir,'output');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'root.md'),'---\nid: root\ntitle: Root\nlabel: topic/root\n---\n[[@/child || lower $x^2$∨]]\n');
  fs.writeFileSync(path.join(source,'child.md'),'---\nid: child\ntitle: Child\nlabel: topic/root/child\n---\nNested text.\n');
  build(source,output);
  const html=fs.readFileSync(path.join(output,'root.html'),'utf8');
  assert.match(html,/data-outline-title="Lower \$x\^2\$"/);
  assert.match(html,/class="embed-title standout-embed"[^>]*>Lower <span class="katex">/);
  assert.doesNotMatch(html,/Nested text\./);
  assert.match(fs.readFileSync(path.join(output,'child.fragment.html'),'utf8'),/Nested text\./);
});
