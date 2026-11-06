const search = document.querySelector('#note-search');
search?.addEventListener('input', () => {
  const query = search.value.toLocaleLowerCase().trim();
  for (const item of document.querySelectorAll('.note-index-item')) item.hidden = !item.dataset.search.includes(query);
});
const toc = document.querySelector('.note-toc');
if (toc) {
  const headings = document.querySelectorAll('.note-paper > .note-content > h2, .note-paper > .note-content > h3');
  headings.forEach((heading, i) => {
    heading.id ||= `section-${i + 1}`;
    const link = document.createElement('a'); link.href = `#${heading.id}`; link.textContent = heading.textContent;
    if (heading.tagName === 'H3') link.className = 'subsection';
    toc.append(link);
  });
  if (!headings.length) toc.textContent = 'No sections';
}
