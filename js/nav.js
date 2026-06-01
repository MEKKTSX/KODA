/**
 * @deprecated Use js/layout.js (KODA UI v2). Kept for backward compatibility.
 */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("koda-sidebar-container")) return;
  const s = document.createElement("script");
  s.src = "js/layout.js";
  document.body.appendChild(s);
});
