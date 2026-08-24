/* ==========================================================================
   Aethra — SVG icon sprite
   Injected inline so <use href="#i-name"> resolves under file:// as well as http.
   Stroke icons inherit .i styling; brand marks opt into .i--solid.
   ========================================================================== */
(function () {
  "use strict";

  var icons = {
    home: '<path d="M3 10.6 12 3l9 7.6V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    logout: '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    "user-plus": '<circle cx="9.5" cy="8" r="3.4"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "arrow-right": '<path d="M4 12h15M13 6l6 6-6 6"/>',
    "arrow-down": '<path d="M12 4v15M6 13l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.6 3.1 7.9 7.5 9 4.4-1.1 7.5-4.4 7.5-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    download: '<path d="M12 3v12"/><path d="m7.5 11 4.5 4 4.5-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9l-1.8 2.2M17 12v3.2"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
    sliders: '<path d="M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3"/><path d="M2.5 14h5M9.5 8h5M16.5 16h5"/>',
    warn: '<path d="M12 4.5 2.8 20h18.4z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2.2"/><path d="M15 5.8A2 2 0 0 0 13.2 4.5H5a2 2 0 0 0-2 2v8.2c0 .9.6 1.6 1.4 1.9"/>',
    message: '<path d="M21 12a7.5 7.5 0 0 1-10.8 6.7L4 20.5l1.8-5.7A7.5 7.5 0 1 1 21 12z"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-8-8-4z"/>',
    inbox: '<path d="M3 13h4.5l1.5 3h6l1.5-3H21"/><path d="M5.4 5.6 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-2.4-7.4A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.9 1.6z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-13.7-5.2L3 9"/><path d="M4 13a8 8 0 0 0 13.7 5.2L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>',
    spark: '<path d="m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    gauge: '<path d="M4.2 18a9 9 0 1 1 15.6 0"/><path d="m12 13 4-3.5"/><circle cx="12" cy="14" r="1.4"/>',
    logo: '<path d="M12 2.5 2.5 21h19z" fill="none"/><path d="M8.4 15h7.2"/>',
    discord:
      '<path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.51 12.51 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.011c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.007.128c-.598.349-1.22.648-1.873.891a.077.077 0 0 0-.04.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419s.956-2.419 2.157-2.419c1.211 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419c1.21 0 2.175 1.095 2.156 2.419 0 1.333-.946 2.419-2.156 2.419z"/>',
    telegram:
      '<path d="M21.6 4.1 3.4 11.2c-1 .4-1 1.7.1 2l4.5 1.4 1.7 5.2c.3.8 1.2 1 1.8.4l2.4-2.4 4.6 3.4c.7.5 1.6.1 1.8-.7l3-14.2c.2-.9-.7-1.5-1.7-1.2z" fill="none"/><path d="M8 14.6 19.5 6.2" fill="none"/>'
  };

  var solid = { discord: 1 };

  var parts = ['<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">'];
  for (var name in icons) {
    if (!Object.prototype.hasOwnProperty.call(icons, name)) continue;
    parts.push(
      '<symbol id="i-' + name + '" viewBox="0 0 24 24"' +
        (solid[name] ? ' fill="currentColor" stroke="none"' : "") +
        ">" +
        icons[name] +
        "</symbol>"
    );
  }
  parts.push("</svg>");

  function inject() {
    document.body.insertAdjacentHTML("afterbegin", parts.join(""));
  }

  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
