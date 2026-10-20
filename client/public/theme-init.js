(() => {
  let theme = "light";
  try {
    const saved = localStorage.getItem("dbms-portal-theme");
    theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  } catch {
    /* Fall back to the light palette when storage is unavailable. */
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0b1220" : "#f4f7fb";
})();
