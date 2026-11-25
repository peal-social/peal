/**
 * Whether the page's main region has hydrated (React has taken its element
 * over) and holds nothing still loading, for `browser.evaluate`: what a
 * page reads in the browser shows only after hydration, so a page that has
 * its data has hydrated, and reported any mismatch. Never `networkidle`,
 * which a page that keeps a connection open never reaches.
 */
export const settled = `(() => {
  const main = document.querySelector("main");

  return (
    main !== null &&
    Object.keys(main).some((key) => key.startsWith("__reactFiber$")) &&
    main.querySelector('[aria-busy="true"]') === null
  );
})()`;
