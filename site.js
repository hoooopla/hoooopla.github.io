(function () {
  "use strict";

  const data = window.SITE_DATA || { profile: {}, fileCategories: [] };
  const profile = data.profile || {};
  const categories = data.fileCategories || [];

  function text(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  }

  const currentPage = document.body.dataset.page;
  document.querySelector(`[data-nav="${currentPage}"]`)?.setAttribute("aria-current", "page");
  document.querySelectorAll("[data-current-year]").forEach((element) => { element.textContent = new Date().getFullYear(); });
  document.querySelectorAll("[data-owner-name]").forEach((element) => { element.textContent = profile.name || "hoooopla"; });

  text("#profile-name", profile.name);
  text("#profile-headline", profile.headline);
  text("#profile-location", profile.location);

  if (!profile.location) document.querySelector("#profile-location-wrap")?.remove();

  const email = document.querySelector("#profile-email");
  if (email && profile.email) {
    email.textContent = profile.email;
    email.href = `mailto:${profile.email}`;
  }
  if (!profile.email) document.querySelector("#profile-email-wrap")?.remove();

  const bio = document.querySelector("#profile-bio");
  if (bio && Array.isArray(profile.bio)) {
    bio.replaceChildren(...profile.bio.map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
  }

  const profileLinks = document.querySelector("#profile-links");
  if (profileLinks && Array.isArray(profile.links)) {
    profileLinks.replaceChildren(...profile.links.map((item) => {
      const link = document.createElement("a");
      link.href = item.url;
      link.textContent = item.label;
      link.target = "_blank";
      link.rel = "noreferrer";
      return link;
    }));
  }
  if (!Array.isArray(profile.links) || !profile.links.length) document.querySelector("#profile-links-wrap")?.remove();

  const categoryGrid = document.querySelector("#category-grid");
  if (categoryGrid) {
    categoryGrid.replaceChildren(...categories.map((category, index) => {
      const link = document.createElement("a");
      link.className = "category-card";
      link.href = `category.html?category=${encodeURIComponent(category.id)}`;
      const title = document.createElement("h2");
      title.textContent = category.name;
      const indexLabel = document.createElement("span");
      indexLabel.className = "category-index";
      indexLabel.textContent = String(index + 1).padStart(2, "0");
      const description = document.createElement("p");
      description.textContent = category.description;
      const count = document.createElement("span");
      count.className = "category-count";
      const total = (category.files || []).length;
      count.textContent = `${total} ${total === 1 ? "file" : "files"}`;
      link.append(indexLabel, title, description, count);
      return link;
    }));
  }

  const fileList = document.querySelector("#file-list");
  if (fileList) {
    const id = new URLSearchParams(window.location.search).get("category");
    const category = categories.find((item) => item.id === id);
    if (!category) {
      text("#category-name", "Category not found");
      text("#category-description", "Choose a category from the files page.");
      fileList.innerHTML = '<div class="empty-state"><p>This category does not exist.</p></div>';
    } else {
      document.title = `${category.name} — hoooopla`;
      text("#category-name", category.name);
      text("#category-coordinate", category.name);
      text("#category-description", category.description);
      const files = category.files || [];
      if (!files.length) {
        fileList.innerHTML = '<div class="empty-state"><p>No files in this category yet.</p></div>';
      } else {
        fileList.replaceChildren(...files.map((file) => {
          const item = document.createElement("article");
          item.className = "file-item";
          const copy = document.createElement("div");
          const title = document.createElement("h2");
          title.textContent = file.title;
          const description = document.createElement("p");
          description.textContent = file.description || "";
          const meta = document.createElement("span");
          meta.className = "file-meta";
          meta.textContent = [file.type, file.size, file.date].filter(Boolean).join(" · ");
          copy.append(title, description, meta);
          const download = document.createElement("a");
          download.className = "download-link";
          download.href = file.path;
          download.download = "";
          download.textContent = "Download";
          item.append(copy, download);
          return item;
        }));
      }
    }
  }
})();
