const search = document.querySelector('#note-search');
search?.addEventListener('input', () => {
  const query = search.value.toLocaleLowerCase().trim();
  for (const item of document.querySelectorAll('.note-index-item')) item.hidden = !item.dataset.search.includes(query);
});

const content = document.querySelector('.note-content');
const toc = document.querySelector('.note-toc');
if (content) {
  const fragmentCache = new Map();
  const collapsed = new Set();
  let nextEmbedId = 0;
  let nextSectionId = 0;
  let refreshOutline = () => {};

  const bodyFor = title => document.getElementById(title.getAttribute('aria-controls'));
  const inlineParagraph = title => title.classList.contains('inline-embed') ? title.closest('p') : null;
  function joinContinuation(title, body) {
    const paragraph = inlineParagraph(title);
    const continuation = body?.nextElementSibling;
    if (!paragraph || continuation?.tagName !== 'P' || continuation.parentElement !== paragraph.parentElement) return;
    while (continuation.firstChild) paragraph.append(continuation.firstChild);
    continuation.remove();
  }
  function splitContinuation(title, body) {
    const paragraph = inlineParagraph(title);
    if (!paragraph || body.parentElement !== paragraph.parentElement) return;
    const continuation = document.createElement('p');
    while (title.nextSibling) continuation.append(title.nextSibling);
    body.after(continuation);
  }
  function joinClosed(scope) {
    for (const title of scope.querySelectorAll('.embed-title.inline-embed[aria-expanded="false"]')) {
      joinContinuation(title, bodyFor(title));
    }
  }
  function targetFor(body) {
    const link = body.querySelector(':scope > .embed-open');
    if (!link) throw new Error('Embedded note has no target link');
    const page = new URL(link.getAttribute('href'), document.baseURI);
    if (page.origin !== location.origin || !page.pathname.endsWith('.html')) throw new Error('Invalid embedded note URL');
    const fragment = new URL(page.href);
    fragment.pathname = page.pathname.replace(/\.html$/, '.fragment.html');
    return {id: decodeURIComponent(page.pathname.split('/').at(-1).slice(0, -5)), url: fragment.href};
  }
  function remapEmbedIds(scope) {
    for (const body of scope.querySelectorAll('.note-embed[id]')) {
      const old = body.id;
      const title = scope.querySelector(`[aria-controls="${old}"]`);
      const id = `embed-body-live-${++nextEmbedId}`;
      body.id = id;
      title?.setAttribute('aria-controls', id);
    }
  }
  async function hydrate(body) {
    if (body.dataset.loaded === 'true') return;
    if (body._loading) return body._loading;
    const mount = body.querySelector(':scope > .embed-content');
    const {id, url} = targetFor(body);
    const ancestors = [content.dataset.noteId];
    for (let ancestor = body.parentElement.closest('.note-embed[data-note-id]'); ancestor; ancestor = ancestor.parentElement.closest('.note-embed[data-note-id]')) {
      ancestors.push(ancestor.dataset.noteId);
    }
    if (ancestors.includes(id)) {
      mount.textContent = 'Already shown above. Open this note on its own page to continue.';
      body.dataset.loaded = 'true';
      return;
    }
    mount.textContent = 'Loading note…';
    body._loading = (async () => {
      try {
        if (!fragmentCache.has(url)) fragmentCache.set(url, fetch(url).then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        }));
        const html = await fragmentCache.get(url);
        const template = document.createElement('template');
        template.innerHTML = html;
        remapEmbedIds(template.content);
        mount.replaceChildren(template.content);
        body.dataset.noteId = id;
        body.dataset.loaded = 'true';
        joinClosed(mount);
        refreshOutline();
        await Promise.all([...mount.querySelectorAll('.embed-title[aria-expanded="true"]')].map(title => hydrate(bodyFor(title))));
      } catch (error) {
        fragmentCache.delete(url);
        mount.textContent = 'Could not load this note. Close and reopen it to retry.';
      } finally {
        body._loading = null;
      }
    })();
    return body._loading;
  }
  async function setExpanded(title, expand) {
    const body = bodyFor(title);
    if (!body || (title.getAttribute('aria-expanded') === 'true') === expand) return;
    if (expand) splitContinuation(title, body);
    else joinContinuation(title, body);
    title.setAttribute('aria-expanded', String(expand));
    body.hidden = !expand;
    refreshOutline();
    if (expand) await hydrate(body);
  }
  joinClosed(content);
  content.addEventListener('click', event => {
    const title = event.target.closest('.embed-title[aria-controls]');
    if (title && content.contains(title)) void setExpanded(title, title.getAttribute('aria-expanded') !== 'true');
  });

  if (toc) {
    const outlineTitle = target => {
      if (target.dataset.outlineTitle) return target.dataset.outlineTitle;
      const copy = target.cloneNode(true);
      for (const formula of copy.querySelectorAll('.katex')) {
        const source = formula.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
        formula.replaceWith(document.createTextNode(source ? `$${source}$` : formula.textContent));
      }
      return copy.textContent.trim();
    };
    refreshOutline = () => {
      const targets = [...content.querySelectorAll('h1,h2,h3,h4,h5,h6,.embed-title[aria-controls]')];
      const depths = new Map(), currentHeading = new Map();
      const entries = targets.map(target => {
        const scope = target.closest('.embed-content')?.closest('.note-embed') || content;
        const parentTitle = scope === content ? null : content.querySelector(`[aria-controls="${scope.id}"]`);
        const base = scope === content ? 0 : (depths.get(parentTitle) ?? 0) + 1;
        const isEmbed = target.classList.contains('embed-title');
        const depth = isEmbed ? (currentHeading.get(scope) ?? base - 1) + 1
          : base + Math.max(0, Number(target.tagName[1]) - 2);
        if (!isEmbed) currentHeading.set(scope, depth);
        depths.set(target, depth);
        target.id ||= `section-${++nextSectionId}`;
        return {target, title: outlineTitle(target), depth: Math.min(depth, 8)};
      });
      toc.replaceChildren();
      if (!entries.length) { toc.textContent = 'No sections'; return; }
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
          toggle.setAttribute('aria-label', `${collapsed.has(entry.target) ? 'Expand' : 'Collapse'} ${entry.title}`);
          toggle.setAttribute('aria-expanded', String(!collapsed.has(entry.target)));
          toggle.addEventListener('click', () => {
            if (collapsed.has(entry.target)) collapsed.delete(entry.target); else collapsed.add(entry.target);
            updateVisibility();
            toggle.setAttribute('aria-expanded', String(!collapsed.has(entry.target)));
            toggle.setAttribute('aria-label', `${collapsed.has(entry.target) ? 'Expand' : 'Collapse'} ${entry.title}`);
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
        link.addEventListener('click', async event => {
          event.preventDefault();
          const ancestors = [];
          for (let body = entry.target.closest('.note-embed'); body; body = body.parentElement.closest('.note-embed')) ancestors.unshift(body);
          for (const body of ancestors) {
            const title = content.querySelector(`[aria-controls="${body.id}"]`);
            if (title) await setExpanded(title, true);
          }
          entry.target.scrollIntoView({behavior:'smooth',block:'start'});
          history.replaceState(null, '', `#${entry.target.id}`);
        });
        row.append(link);
        toc.append(row);
        return row;
      });
      function updateVisibility() {
        const ancestors = [];
        entries.forEach((entry, index) => {
          while (ancestors.length && entries[ancestors.at(-1)].depth >= entry.depth) ancestors.pop();
          items[index].hidden = ancestors.some(parent => collapsed.has(entries[parent].target)) || !!entry.target.closest('.note-embed[hidden]');
          ancestors.push(index);
        });
      }
      updateVisibility();
    };
    refreshOutline();
  }
  void Promise.all([...content.querySelectorAll('.embed-title[aria-expanded="true"]')].map(title => hydrate(bodyFor(title))));
}
