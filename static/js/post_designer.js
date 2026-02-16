document.addEventListener("DOMContentLoaded", () => {
  if (window.ReelveDesigner) {
    window.ReelveDesigner.init({ rootId: "designer-root", prefix: "" });
  } else {
    console.warn("ReelveDesigner not loaded");
  }
});
