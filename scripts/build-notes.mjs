import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import YAML from 'yaml';
import katex from 'katex';
import sanitizeHtml from 'sanitize-html';

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
const macros = (() => {
  try { const settings = JSON.parse(fs.readFileSync(path.join(source,'setting','settings.json'),'utf8')); return settings.macros && typeof settings.macros === 'object' ? settings.macros : {}; } catch { return {}; }
})();
const math = (tex, display) => { try { return katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false,macros}); } catch { return `<code>${escape(tex)}</code>`; } };
const sanitize = html => sanitizeHtml(html, {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'details', 'summary', 'span'],
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, a:['href','title'], img:['src','alt','width','height'], span:['class'], details:['open','class'], '*':['class','id'] },
  allowedSchemes: ['http','https','mailto'],
  transformTags: { img: (tag, attrs) => ({tagName:'img',attribs:{...attrs,src:assetUrl(attrs.src)}}) }
});
function assetUrl(src) {
  if (!src || /^(https?:|data:|\/)/i.test(src)) return src || '';
  const cleaned = path.posix.normalize(decodeURI(src).replaceAll('\\','/'));
  if (!cleaned.startsWith('assets/') || cleaned.includes('..')) return '';
  if (!fs.existsSync(path.join(source, cleaned))) errors.push(`Missing asset: ${cleaned}`);
  return cleaned.split('/').map(encodeURIComponent).join('/');
}
const refs = new Map(notes.map(n => [n.label, new Set()]));
const outgoing = new Map(notes.map(n => [n.label, new Set()]));
function reference(raw, note, stack, embedded = false) {
  let value = raw.trim();
  const standout = value.startsWith('@'); if (standout) value = value.slice(1);
  const open = value.endsWith('∨'); if (open) value = value.slice(0,-1).trimEnd();
  const parts = value.split(/\s*\|\|\s*/); const label = (parts.shift() || '').trim();
  const targetLabel = (label.startsWith('/') ? note.label + label : label).normalize('NFC');
  const target = byLabel.get(targetLabel);
  const alias = parts.join(' || ').trim();
  if (!target) { errors.push(`${path.relative(source,note.file)}: missing reference ${targetLabel}`); return `<span class="broken-reference" title="Missing note">${escape(alias || label)}</span>`; }
  outgoing.get(note.label).add(target.label); refs.get(target.label).add(note.label);
  const link = `<a class="note-reference${standout?' standout':''}" href="${urlFor(target)}">${escape(alias || target.title)}</a>`;
  if (!embedded || !open) return link;
  if (stack.includes(target.label)) return `<div class="note-embed"><div class="embed-heading">${link} <span>↩ Cycle</span></div></div>`;
  return `<section class="note-embed"><div class="embed-heading"><span>Referenced note</span>${link}</div><div class="embed-content">${render(target,[...stack,target.label])}</div></section>`;
}
function render(note, stack=[note.label]) {
  const md = new MarkdownIt({html:true,linkify:true,typographer:false});
  md.block.ruler.before('paragraph','block_reference',(state,start,end,silent) => {
    const line = state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]).trim();
    const match = /^\[\[([^\]\n]+)\]\]$/.exec(line);
    if (!match) return false;
    if (silent) return true;
    const token=state.push('block_reference','',0); token.content=match[1]; state.line=start+1; return true;
  });
  md.renderer.rules.block_reference = (tokens,i) => reference(tokens[i].content,note,stack,true);
  md.inline.ruler.before('link','note_reference',(state,silent) => {
    if (state.src.slice(state.pos,state.pos+2)!=='[[' || state.pos>0 && state.src[state.pos-1]==='\\') return false;
    const end=state.src.indexOf(']]',state.pos+2);
    if (end<0 || state.src.slice(state.pos+2,end).includes('\n')) return false;
    if (!silent) { const t=state.push('note_reference','',0); t.content=state.src.slice(state.pos+2,end); }
    state.pos=end+2; return true;
  });
  md.renderer.rules.note_reference = (tokens,i) => reference(tokens[i].content,note,stack);
  md.inline.ruler.before('escape','inline_math',(state,silent) => {
    const s=state.src, p=state.pos;
    const delim=s.startsWith('\\(',p)?'\\(':s[p]==='$'&&s[p+1]!=='$'?'$':null;
    if (!delim) return false;
    const end=s.indexOf(delim==='\\('?'\\)':'$',p+delim.length);
    if (end<0 || end===p+delim.length || s.slice(p+delim.length,end).includes('\n')) return false;
    if (!silent) {const t=state.push('math_inline','',0);t.content=s.slice(p+delim.length,end);}
    state.pos=end+(delim==='\\('?2:1);return true;
  });
  md.renderer.rules.math_inline=(tokens,i)=>math(tokens[i].content,false);
  md.block.ruler.before('fence','display_math',(state,start,end,silent)=>{
    const line=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]).trim();
    const begin=line.startsWith('\\[')?'\\[':line.startsWith('$$')?'$$':null;
    if (!begin) return false;
    let close=start, content=line.slice(begin.length), stop=begin==='\\['?'\\]':'$$';
    while (!content.includes(stop) && ++close<end) content+='\n'+state.src.slice(state.bMarks[close],state.eMarks[close]);
    const idx=content.indexOf(stop); if (idx<0) return false;
    if (silent) return true;
    const t=state.push('math_display','',0);t.content=content.slice(0,idx);state.line=close+1;return true;
  });
  md.renderer.rules.math_display=(tokens,i)=>math(tokens[i].content,true);
  const defaultImage=md.renderer.rules.image;
  md.renderer.rules.image=(tokens,i,options,env,self)=>{tokens[i].attrSet('src',assetUrl(tokens[i].attrGet('src')));return defaultImage(tokens,i,options,env,self);};
  // KaTeX output is trusted here; authored HTML is restricted before rendering.
  const html=md.render(note.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
  return sanitizeHtml(html, {allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','span','math','annotation','semantics','mrow','mi','mn','mo','msup','msub','mfrac','mspace','mtext','mstyle','mtable','mtr','mtd','mover','munder','munderover','msqrt','mroot','mpadded','menclose','details','summary','section','div'],allowedAttributes:{'*':['class','id','aria-hidden','style','xmlns','encoding','mathvariant','display','stretchy','fence','separator','size','width','height','src','alt','href','title','open','role','data-mathml']},allowedSchemes:['http','https','mailto'],allowedStyles:{'*':{'*':[/^[\w\s#%.,()\-]+$/]}}});
}
function shell(title, contents, page='notes') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(title)} — hoooopla</title><link rel="icon" href="../favicon.svg"><link rel="stylesheet" href="../style.css"><link rel="stylesheet" href="../notes.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css"></head><body data-page="${page}"><a class="skip-link" href="#content">Skip to content</a><header class="site-header"><a class="site-mark" href="../index.html"><span>H</span><small>Mathematics</small></a><nav class="site-nav" aria-label="Main navigation"><a href="../index.html">About</a><a href="../files.html">Files</a><a href="index.html" aria-current="page">Notes</a><a href="../blog.html">Blog</a><a href="https://hoooopla.github.io/Math-Note-Editor/">Editor ↗</a></nav></header><main id="content">${contents}</main><footer class="site-footer"><span>© ${new Date().getFullYear()} hoooopla</span><span>Mathematical notes, connected by ideas.</span></footer></body></html>`;
}
const outputIndex = `<div class="notes-heading"><p class="coordinate">03 / Knowledge base</p><h1>Notes</h1><p class="page-lead">A growing collection of mathematical ideas. Follow a reference to see how they connect.</p></div><div class="notes-search"><label for="note-search">Find a note</label><input id="note-search" type="search" placeholder="Search titles and labels…" autocomplete="off"></div><div class="notes-index" id="notes-index">${notes.length ? notes.sort((a,b)=>a.label.localeCompare(b.label)).map(n=>`<a class="note-index-item" href="${urlFor(n)}" data-search="${escape((n.title+' '+n.label).toLowerCase())}"><span class="note-label">${escape(n.label)}</span><strong>${escape(n.title)}</strong><span aria-hidden="true">↗</span></a>`).join('') : '<div class="empty-state"><p>No notes published yet. Add Markdown files to <code>notes-workspace/</code> and run the notes build.</p></div>'}</div><script src="../notes.js" defer></script>`;
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
const assetFolder=path.join(source,'assets');if(fs.existsSync(assetFolder))fs.cpSync(assetFolder,path.join(output,'assets'),{recursive:true});
fs.writeFileSync(path.join(output,'index.html'),shell('Notes',outputIndex));
for(const note of notes) {
  const body=render(note);
  const ancestors=note.label.split('/').slice(0,-1).map((_,i)=>note.label.split('/').slice(0,i+1).join('/'));
  const tree=notes.filter(n=>n.label===note.label || n.label.startsWith(note.label+'/') || ancestors.includes(n.label));
  const sidebar=tree.sort((a,b)=>a.label.localeCompare(b.label)).map(n=>`<a class="tree-link ${n.id===note.id?'selected':''}" style="--depth:${Math.max(0,n.label.split('/').length-1)}" href="${urlFor(n)}">${escape(n.title)}</a>`).join('');
  const contents=`<div class="note-layout"><aside class="note-tree" aria-label="Nearby notes"><a class="back-link" href="index.html">← All notes</a><p class="side-label">Topic</p>${sidebar}</aside><article class="note-paper"><div class="note-kicker">${escape(note.label)}</div><h1>${escape(note.title)}</h1><div class="note-content">${body}</div></article><aside class="note-context"><p class="side-label">In this note</p><div class="note-toc"></div><p class="side-label">References</p><div class="note-outgoing"></div><p class="side-label">Backlinks</p><div class="note-backlinks"></div></aside></div><script src="../notes.js" defer></script>`;
  fs.writeFileSync(path.join(output,urlFor(note)),shell(note.title,contents));
}
for(const note of notes) {
  const p=path.join(output,urlFor(note));let html=fs.readFileSync(p,'utf8');
  const list=labels=>[...labels].sort().map(label=>`<a href="${urlFor(byLabel.get(label))}">${escape(byLabel.get(label).title)}</a>`).join('') || '<span class="side-empty">None yet</span>';
  html=html.replace('<div class="note-outgoing"></div>',`<div class="note-outgoing">${list(outgoing.get(note.label))}</div>`).replace('<div class="note-backlinks"></div>',`<div class="note-backlinks">${list(refs.get(note.label))}</div>`);
  fs.writeFileSync(p,html);
}
const unique=[...new Set(errors)];
for(const issue of unique) console.warn(`Notes: ${issue}`);
console.log(`Built ${notes.length} notes into ${output}; ${unique.length} issue(s).`);
if(strict && unique.length) process.exitCode=1;
