/*
  EDIT THIS FILE to update your personal information and downloadable files.
  Keep the quotation marks and commas in place.
*/
window.SITE_DATA = {
  profile: {
    name: "Your Name",
    headline: "Mathematics, notes, and ongoing work.",
    location: "Your city or region",
    email: "your-email@example.com",
    bio: [
      "Write a short introduction here. You might mention what you study or work on, what kinds of mathematics interest you, and what visitors can find on this website.",
      "Add another paragraph by placing another quoted sentence in this list."
    ],
    links: [
      { label: "Math Note Editor", url: "https://hoooopla.github.io/Math-Note-Editor/" },
      { label: "Block Converter", url: "https://hoooopla.github.io/Block-converter/" }
    ]
  },

  fileCategories: [
    {
      id: "works",
      name: "Works",
      description: "Finished papers, projects, and longer pieces.",
      files: []
    },
    {
      id: "notes",
      name: "Notes",
      description: "Study notes, summaries, and mathematical scratchwork.",
      files: []
    },
    {
      id: "resources",
      name: "Resources",
      description: "Templates, reference material, and other useful downloads.",
      files: []
    }
  ]
};

/*
  To publish a file:
  1. Put it inside downloads/works, downloads/notes, or downloads/resources.
  2. Add an item to the matching files: [] list, like this:

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
*/
