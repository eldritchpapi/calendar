(function () {
  var script = document.currentScript;
  var slug = script.getAttribute("data-calendario-slug");
  var baseUrl = script.src.replace("/embed.js", "");

  if (!slug) {
    console.error("Calendar.io embed: missing data-calendario-slug attribute");
    return;
  }

  var container = document.createElement("div");
  container.style.width = "100%";
  container.style.maxWidth = "700px";
  container.style.margin = "0 auto";

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl + "/book/" + slug + "?embed=true";
  iframe.style.width = "100%";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)";
  iframe.style.minHeight = "500px";
  iframe.style.transition = "height 0.2s ease";
  iframe.setAttribute("loading", "lazy");

  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "calendario-resize") {
      iframe.style.height = e.data.height + "px";
    }
  });

  container.appendChild(iframe);
  script.parentNode.insertBefore(container, script.nextSibling);
})();
