// The script the site's, the docs' and the blog's layouts load: without a
// `<peal-support>` on the page (no Crisp website configured) it does
// nothing; otherwise it defines the launcher, which loads Crisp only when
// pressed. The app imports `element.ts` itself.

const startPage = () => {
  if (document.querySelector("peal-support") !== null) {
    void import("./element");
  }
};

// Once a page load, and again on each page the docs' client router shows.
document.addEventListener("astro:page-load", startPage);

startPage();
