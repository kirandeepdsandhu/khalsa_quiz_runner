"use strict";

(function () {
  function getAllMenus() {
    return Array.from(document.querySelectorAll("details.appMenu[open]"));
  }

  function getAllDefaultBankMenus() {
    return Array.from(document.querySelectorAll("details.defaultBankMenu[open]"));
  }

  function closeAllMenus(exceptEl = null) {
    for (const d of getAllMenus()) {
      if (exceptEl && d === exceptEl) continue;
      d.open = false;
    }
  }

  function closeAllDefaultBankMenus(exceptEl = null) {
    for (const d of getAllDefaultBankMenus()) {
      if (exceptEl && d === exceptEl) continue;
      d.open = false;
    }
  }

  // Close when clicking outside.
  document.addEventListener("click", (e) => {
    const openMenus = getAllMenus();
    const openDefaultMenus = getAllDefaultBankMenus();
    if (openMenus.length === 0 && openDefaultMenus.length === 0) return;

    const clickedInsideAppMenu = e.target && e.target.closest ? e.target.closest("details.appMenu") : null;
    const clickedInsideDefaultMenu = e.target && e.target.closest ? e.target.closest("details.defaultBankMenu") : null;
    if (clickedInsideAppMenu || clickedInsideDefaultMenu) return;

    closeAllMenus();
    closeAllDefaultBankMenus();
  });

  // Close when choosing a menu link.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest(".appMenuPanel a") : null;
    if (!a) return;

    const menu = a.closest ? a.closest("details.appMenu") : null;
    if (menu) menu.open = false;
  });

  // Escape to close.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAllMenus();
    closeAllDefaultBankMenus();
  });
})();
