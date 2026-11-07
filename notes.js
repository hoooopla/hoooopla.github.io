const search = document.querySelector('#note-search');
search?.addEventListener('input', () => {
  const query = search.value.toLocaleLowerCase().trim();
  for (const item of document.querySelectorAll('.note-index-item')) item.hidden = !item.dataset.search.includes(query);
});
const toc = document.querySelector('.note-toc');
const content = document.querySelector('.note-content');
for (const title of document.querySelectorAll('.embed-title[aria-controls]')) {
  title.addEventListener('click', () => {
    const body = document.getElementById(title.getAttribute('aria-controls'));
    const expanded = title.getAttribute('aria-expanded') === 'true';
    title.setAttribute('aria-expanded', String(!expanded));
    if (body) body.hidden = expanded;
  });
}
if (toc && content) {
  const outlineTitle = target => {
    if (target.dataset.outlineTitle) return target.dataset.outlineTitle;
    const copy = target.cloneNode(true);
    for (const formula of copy.querySelectorAll('.katex')) {
      const source = formula.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      formula.replaceWith(document.createTextNode(source ? `$${source}$` : formula.textContent));
    }
    return copy.textContent.trim();
  };
  const targets = [...content.querySelectorAll('h1,h2,h3,h4,h5,h6,.embed-title[aria-controls]')];
  const depths = new Map(), currentHeading = new Map();
  const entries = targets.map((target, index) => {
    const scope = target.closest('.embed-content')?.closest('.note-embed') || content;
    const parentTitle = scope === content ? null : content.querySelector(`[aria-controls="${scope.id}"]`);
    const base = scope === content ? 0 : (depths.get(parentTitle) ?? 0) + 1;
    const isEmbed = target.classList.contains('embed-title');
    const depth = isEmbed ? (currentHeading.get(scope) ?? base - 1) + 1
      : base + Math.max(0, Number(target.tagName[1]) - 2);
    if (!isEmbed) currentHeading.set(scope, depth);
    depths.set(target, depth);
    target.id ||= `section-${index + 1}`;
    return { target, title: outlineTitle(target), depth: Math.min(depth, 8) };
  });
  const collapsed = new Set();
  const items = entries.map((entry, index) => {
    const row = document.createElement('div');
    row.className = 'outline-row';
    row.style.setProperty('--outline-depth', entry.depth);
    const hasChildren = entries[index + 1]?.depth > entry.depth;
    if (hasChildren) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'outline-toggle';
      toggle.textContent = '⌄';
      toggle.setAttribute('aria-label', `Collapse ${entry.title}`);
      toggle.setAttribute('aria-expanded', 'true');
      toggle.addEventListener('click', () => {
        if (collapsed.has(index)) collapsed.delete(index); else collapsed.add(index);
        toggle.setAttribute('aria-expanded', String(!collapsed.has(index)));
        toggle.setAttribute('aria-label', `${collapsed.has(index) ? 'Expand' : 'Collapse'} ${entry.title}`);
        updateVisibility();
      });
      row.append(toggle);
    } else {
      const space = document.createElement('span');
      space.className = 'outline-spacer';
      row.append(space);
    }
    const link = document.createElement('a');
    link.href = `#${entry.target.id}`;
    link.textContent = entry.title;
    link.addEventListener('click', () => {
      let ancestor = entry.target.closest('.note-embed');
      while (ancestor) {
        ancestor.hidden = false;
        content.querySelector(`[aria-controls="${ancestor.id}"]`)?.setAttribute('aria-expanded','true');
        ancestor = ancestor.parentElement.closest('.note-embed');
      }
    });
    row.append(link);
    toc.append(row);
    return row;
  });
  function updateVisibility() {
    const ancestors = [];
    entries.forEach((entry, index) => {
      while (ancestors.length && entries[ancestors.at(-1)].depth >= entry.depth) ancestors.pop();
      items[index].hidden = ancestors.some(parent => collapsed.has(parent));
      ancestors.push(index);
    });
  }
  if (!entries.length) toc.textContent = 'No sections';
}
