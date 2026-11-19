import { defineComponents } from "blume";

// The docs' own pieces of Blume's chrome, by path from the project root
// (Blume reads this file without running it): the sidebar gains a button to
// the web app at its foot, and the footer the consent notice and its
// Cookie settings row where the docs are measured.
export default defineComponents({
  layout: {
    Footer: "./components/footer.astro",
    Sidebar: "./components/sidebar.astro",
  },
});
