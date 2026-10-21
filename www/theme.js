/* Applies the saved theme (Sistem / Açık / Koyu) before first paint to avoid a flash of the wrong colours. */
(function () {
  try {
    var t = localStorage.getItem("habit-pref:theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
