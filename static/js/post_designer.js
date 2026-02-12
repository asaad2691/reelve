const canvas = document.getElementById("design-canvas");
const drawLayer = document.getElementById("draw-layer");
const toolButtons = document.querySelectorAll(".tool-btn");

const imageUpload = document.getElementById("image-upload");
const bgColor = document.getElementById("bg-color");
const fontSize = document.getElementById("font-size");
const fontFamily = document.getElementById("font-family");
const textColor = document.getElementById("text-color");
const letterSpacing = document.getElementById("letter-spacing");
const lineHeight = document.getElementById("line-height");
const alignLeft = document.getElementById("align-left");
const alignCenter = document.getElementById("align-center");
const alignRight = document.getElementById("align-right");
const textBold = document.getElementById("text-bold");
const textItalic = document.getElementById("text-italic");
const textUpper = document.getElementById("text-upper");
const fillColor = document.getElementById("fill-color");
const strokeColor = document.getElementById("stroke-color");
const strokeWidth = document.getElementById("stroke-width");
const brushSize = document.getElementById("brush-size");
const drawOnSelection = document.getElementById("draw-on-selection");
const bringFront = document.getElementById("bring-front");
const sendBack = document.getElementById("send-back");
const shapeType = document.getElementById("shape-type");
const imgWidth = document.getElementById("img-width");
const imgHeight = document.getElementById("img-height");
const rotateInput = document.getElementById("rotate");
const deleteLayerBtn = document.getElementById("delete-layer");
const exportBtn = document.getElementById("export-post");

let selectedLayer = null;
let selectedLayers = [];
let activeTool = "select";
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let dragOffsets = new Map();
let drawing = false;
let drawStart = null;
let resizing = false;
let lineSnapshot = null;
let zCounter = 5;
let marquee = null;
let marqueeStart = null;

let ctx = drawLayer.getContext("2d");
let dpr = window.devicePixelRatio || 1;

function resizeDrawLayer() {
  dpr = window.devicePixelRatio || 1;
  drawLayer.width = canvas.clientWidth * dpr;
  drawLayer.height = canvas.clientHeight * dpr;
  ctx = drawLayer.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeDrawLayer();
window.addEventListener("resize", resizeDrawLayer);

function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
}

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    setTool(tool);
    if (tool === "image" && imageUpload) {
      imageUpload.click();
    }
  });
});

function selectLayer(el) {
  clearSelection();
  if (!el) return;
  selectedLayer = el;
  selectedLayers = [el];
  selectedLayer.classList.add("active");
  attachResizeHandle(selectedLayer);
  updateInspectorFromSelection();
}

function toggleSelectLayer(el) {
  if (!el) return;
  const idx = selectedLayers.indexOf(el);
  if (idx >= 0) {
    selectedLayers.splice(idx, 1);
    el.classList.remove("active");
  } else {
    selectedLayers.push(el);
    el.classList.add("active");
  }
  selectedLayer = selectedLayers[0] || null;
  if (selectedLayer) {
    attachResizeHandle(selectedLayer);
    updateInspectorFromSelection();
  }
}

function setSelection(list) {
  clearSelection();
  selectedLayers = list;
  selectedLayer = list[0] || null;
  selectedLayers.forEach((el) => el.classList.add("active"));
  if (selectedLayer) {
    attachResizeHandle(selectedLayer);
    updateInspectorFromSelection();
  }
}

function clearSelection() {
  if (selectedLayers.length) {
    selectedLayers.forEach((el) => {
      el.classList.remove("active");
      const handle = el.querySelector(".resize-handle");
      if (handle) handle.remove();
    });
  } else if (selectedLayer) {
    selectedLayer.classList.remove("active");
    const handle = selectedLayer.querySelector(".resize-handle");
    if (handle) handle.remove();
  }
  selectedLayer = null;
  selectedLayers = [];
}

function updateInspectorFromSelection() {
  if (!selectedLayer) return;
  if (selectedLayer.classList.contains("text-layer")) {
    fontSize.value = parseInt(getComputedStyle(selectedLayer).fontSize, 10) || 48;
    fontFamily.value = getComputedStyle(selectedLayer).fontFamily.split(",")[0].replace(/\"/g, "");
    textColor.value = rgbToHex(getComputedStyle(selectedLayer).color);
    letterSpacing.value = parseInt(getComputedStyle(selectedLayer).letterSpacing, 10) || 0;
    const lh = getComputedStyle(selectedLayer).lineHeight;
    lineHeight.value = lh === "normal" ? 1.2 : parseFloat(lh) || 1.2;
  }
  if (selectedLayer.classList.contains("image-layer")) {
    imgWidth.value = Math.round(selectedLayer.getBoundingClientRect().width);
    imgHeight.value = Math.round(selectedLayer.getBoundingClientRect().height);
  }
  const rot = selectedLayer.dataset.rotate || "0";
  if (rotateInput) rotateInput.value = rot;
  const fillVar = getComputedStyle(selectedLayer).getPropertyValue("--shape-fill").trim();
  if (fillVar) fillColor.value = fillVar;
}

function rgbToHex(rgb) {
  const match = rgb.match(/\d+/g);
  if (!match) return "#ffffff";
  const [r, g, b] = match.map((n) => Number(n));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function makeLayer(type, content) {
  const el = document.createElement("div");
  el.classList.add("layer");
  if (type === "text") {
    el.classList.add("text-layer");
    el.contentEditable = "true";
    el.textContent = content || "New Text";
  } else if (type === "shape") {
    el.classList.add("shape-layer");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("shape-svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    el.appendChild(svg);
  } else if (type === "img") {
    el.classList.add("image-layer");
    const img = document.createElement("img");
    img.alt = "Layer";
    img.className = "image-content";
    el.appendChild(img);
  }
  el.style.top = "80px";
  el.style.left = "80px";
  el.style.width = "200px";
  el.style.height = "120px";
  el.style.transformOrigin = "center center";
  el.dataset.rotate = "0";
  el.style.zIndex = zCounter++;
  el.style.position = "absolute";
  el.style.userSelect = "none";
  el.style.boxSizing = "border-box";
  el.style.backgroundClip = "padding-box";
  canvas.appendChild(el);
  attachLayerEvents(el);
  selectLayer(el);
  return el;
}

function attachLayerEvents(el) {
  el.addEventListener("mousedown", (e) => {
    if (activeTool !== "select") return;
    if (e.ctrlKey || e.metaKey) {
      toggleSelectLayer(el);
    } else {
      setSelection([el]);
    }
    isDragging = true;
    const rect = el.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    dragOffsets.clear();
    const canvasRect = canvas.getBoundingClientRect();
    selectedLayers.forEach((layer) => {
      const r = layer.getBoundingClientRect();
      dragOffsets.set(layer, {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        left: r.left - canvasRect.left,
        top: r.top - canvasRect.top,
      });
    });
  });
}

function attachResizeHandle(el) {
  if (el.querySelector(".resize-handle")) return;
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);

  handle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    resizing = true;
    selectLayer(el);
  });

  document.addEventListener("mouseup", () => {
    resizing = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!resizing || selectedLayer !== el) return;
    const rect = el.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const newHeight = e.clientY - rect.top;
    el.style.width = `${Math.max(40, newWidth)}px`;
    if (el.classList.contains("image-layer")) {
      el.style.height = `${Math.max(30, newHeight)}px`;
    } else {
      el.style.height = `${Math.max(30, newHeight)}px`;
    }
    syncLayerCanvas(el);
  });
}

function getLayerCanvas(el) {
  let lc = el.querySelector(".layer-draw");
  if (!lc) {
    lc = document.createElement("canvas");
    lc.className = "layer-draw";
    el.appendChild(lc);
  }
  const localDpr = window.devicePixelRatio || 1;
  lc.width = el.clientWidth * localDpr;
  lc.height = el.clientHeight * localDpr;
  const lctx = lc.getContext("2d");
  lctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
  return lc;
}

function syncLayerCanvas(el) {
  const lc = el.querySelector(".layer-draw");
  if (!lc) return;
  const localDpr = window.devicePixelRatio || 1;
  lc.width = el.clientWidth * localDpr;
  lc.height = el.clientHeight * localDpr;
  const lctx = lc.getContext("2d");
  lctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
}

function currentDrawSurface() {
  if (drawOnSelection?.checked && selectedLayer) {
    return getLayerCanvas(selectedLayer).getContext("2d");
  }
  return ctx;
}

function currentDrawCanvas() {
  if (drawOnSelection?.checked && selectedLayer) {
    return getLayerCanvas(selectedLayer);
  }
  return drawLayer;
}

canvas.addEventListener("mousedown", (e) => {
  if ((e.target === canvas || e.target === drawLayer) && activeTool === "select") {
    clearSelection();
    marqueeStart = { x: e.offsetX, y: e.offsetY };
    marquee = document.createElement("div");
    marquee.className = "selection-rect";
    marquee.style.left = `${marqueeStart.x}px`;
    marquee.style.top = `${marqueeStart.y}px`;
    canvas.appendChild(marquee);
  }
  if (activeTool === "text") {
    const el = makeLayer("text");
    el.style.left = `${e.offsetX}px`;
    el.style.top = `${e.offsetY}px`;
    return;
  }
  if (activeTool === "shape") {
    const el = makeLayer("shape");
    el.style.left = `${e.offsetX}px`;
    el.style.top = `${e.offsetY}px`;
    el.style.setProperty("--shape-fill", fillColor.value);
    el.style.setProperty("--shape-stroke", strokeColor.value);
    el.style.setProperty("--shape-stroke-width", `${strokeWidth.value}px`);
    const type = shapeType?.value || "rect";
    el.dataset.shape = type;
    applyShapeClass(el, type);
    return;
  }
  if (activeTool === "line" || activeTool === "curve") {
    drawing = true;
    if (drawOnSelection?.checked && selectedLayer) {
      const rect = selectedLayer.getBoundingClientRect();
      drawStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    } else {
      drawStart = { x: e.offsetX, y: e.offsetY };
    }
    const dc = currentDrawCanvas();
    const dctx = currentDrawSurface();
    lineSnapshot = dctx.getImageData(0, 0, dc.width, dc.height);
    return;
  }
  if (activeTool === "pen" || activeTool === "marker" || activeTool === "eraser") {
    drawing = true;
    const dctx = currentDrawSurface();
    dctx.beginPath();
    if (drawOnSelection?.checked && selectedLayer) {
      const rect = selectedLayer.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      dctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    } else {
      dctx.moveTo(e.offsetX, e.offsetY);
    }
  }
});

document.addEventListener("mousemove", (e) => {
  if (isDragging && selectedLayers.length) {
    const canvasRect = canvas.getBoundingClientRect();
    selectedLayers.forEach((layer) => {
      const off = dragOffsets.get(layer);
      if (!off) return;
      const x = e.clientX - canvasRect.left - off.x;
      const y = e.clientY - canvasRect.top - off.y;
      layer.style.left = `${x}px`;
      layer.style.top = `${y}px`;
    });
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (marquee && marqueeStart) {
    const x = Math.min(marqueeStart.x, e.offsetX);
    const y = Math.min(marqueeStart.y, e.offsetY);
    const w = Math.abs(e.offsetX - marqueeStart.x);
    const h = Math.abs(e.offsetY - marqueeStart.y);
    marquee.style.left = `${x}px`;
    marquee.style.top = `${y}px`;
    marquee.style.width = `${w}px`;
    marquee.style.height = `${h}px`;
  }
  if (drawing) {
    const dctx = currentDrawSurface();
    if ((activeTool === "line" || activeTool === "curve") && drawStart) {
      const dc = currentDrawCanvas();
      if (lineSnapshot) dctx.putImageData(lineSnapshot, 0, 0);
      dctx.beginPath();
      dctx.moveTo(drawStart.x, drawStart.y);
      if (activeTool === "curve") {
        const endX = drawOnSelection?.checked && selectedLayer
          ? e.clientX - selectedLayer.getBoundingClientRect().left
          : e.offsetX;
        const endY = drawOnSelection?.checked && selectedLayer
          ? e.clientY - selectedLayer.getBoundingClientRect().top
          : e.offsetY;
        const cpX = (drawStart.x + endX) / 2 + 30;
        const cpY = (drawStart.y + endY) / 2 - 30;
        dctx.quadraticCurveTo(cpX, cpY, endX, endY);
      } else {
        const endX = drawOnSelection?.checked && selectedLayer
          ? e.clientX - selectedLayer.getBoundingClientRect().left
          : e.offsetX;
        const endY = drawOnSelection?.checked && selectedLayer
          ? e.clientY - selectedLayer.getBoundingClientRect().top
          : e.offsetY;
        dctx.lineTo(endX, endY);
      }
      dctx.strokeStyle = strokeColor.value;
      dctx.lineWidth = Number(strokeWidth.value);
      dctx.stroke();
    } else if (activeTool === "pen" || activeTool === "marker") {
      if (drawOnSelection?.checked && selectedLayer) {
        const rect = selectedLayer.getBoundingClientRect();
        dctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      } else {
        dctx.lineTo(e.offsetX, e.offsetY);
      }
      dctx.strokeStyle = activeTool === "marker" ? "rgba(56,189,248,0.6)" : strokeColor.value;
      dctx.lineWidth = Number(brushSize.value);
      dctx.lineCap = "round";
      dctx.stroke();
    } else if (activeTool === "eraser") {
      if (drawOnSelection?.checked && selectedLayer) {
        const rect = selectedLayer.getBoundingClientRect();
        dctx.clearRect(e.clientX - rect.left - 8, e.clientY - rect.top - 8, 16, 16);
      } else {
        dctx.clearRect(e.offsetX - 8, e.offsetY - 8, 16, 16);
      }
    }
  }
});

canvas.addEventListener("mouseup", (e) => {
  isDragging = false;
  dragOffsets.clear();
  if (marquee) {
    const rect = marquee.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x1 = rect.left - canvasRect.left;
    const y1 = rect.top - canvasRect.top;
    const x2 = x1 + rect.width;
    const y2 = y1 + rect.height;
    const layers = Array.from(canvas.querySelectorAll(".layer"));
    const selected = layers.filter((el) => {
      const r = el.getBoundingClientRect();
      const ex1 = r.left - canvasRect.left;
      const ey1 = r.top - canvasRect.top;
      const ex2 = ex1 + r.width;
      const ey2 = ey1 + r.height;
      const intersects = ex1 < x2 && ex2 > x1 && ey1 < y2 && ey2 > y1;
      return intersects;
    });
    setSelection(selected);
    marquee.remove();
    marquee = null;
    marqueeStart = null;
  }
  if (drawing && (activeTool === "line" || activeTool === "curve") && drawStart) {
    drawing = false;
    drawStart = null;
    lineSnapshot = null;
  }
  if (drawing && (activeTool === "pen" || activeTool === "marker" || activeTool === "eraser")) {
    drawing = false;
    ctx.closePath();
  }
});

imageUpload?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = makeLayer("img");
  const reader = new FileReader();
  reader.onload = () => {
    const target = img.querySelector("img");
    if (target) target.src = reader.result;
  };
  reader.readAsDataURL(file);
  img.style.width = "260px";
  img.style.height = "200px";
});

fontSize?.addEventListener("input", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.fontSize = `${e.target.value}px`;
  }
});

fontFamily?.addEventListener("change", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.fontFamily = e.target.value;
  }
});

textColor?.addEventListener("input", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.color = e.target.value;
  }
});

letterSpacing?.addEventListener("input", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.letterSpacing = `${e.target.value}px`;
  }
});

lineHeight?.addEventListener("input", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.lineHeight = `${e.target.value}`;
  }
});

function applyImageSize() {
  if (!selectedLayer || !selectedLayer.classList.contains("image-layer")) return;
  const w = Number(imgWidth.value);
  const h = Number(imgHeight.value);
  if (w > 0) selectedLayer.style.width = `${w}px`;
  if (h > 0) selectedLayer.style.height = `${h}px`;
  syncLayerCanvas(selectedLayer);
}

imgWidth?.addEventListener("input", applyImageSize);
imgHeight?.addEventListener("input", applyImageSize);

rotateInput?.addEventListener("input", (e) => {
  if (!selectedLayer) return;
  const angle = Number(e.target.value || 0);
  selectedLayer.dataset.rotate = String(angle);
  selectedLayer.style.transform = `rotate(${angle}deg)`;
});

alignLeft?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.textAlign = "left";
  }
});

alignCenter?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.textAlign = "center";
  }
});

alignRight?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.textAlign = "right";
  }
});

textBold?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.fontWeight = selectedLayer.style.fontWeight === "700" ? "400" : "700";
  }
});

textItalic?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.fontStyle = selectedLayer.style.fontStyle === "italic" ? "normal" : "italic";
  }
});

textUpper?.addEventListener("click", () => {
  if (selectedLayer && selectedLayer.classList.contains("text-layer")) {
    selectedLayer.style.textTransform = selectedLayer.style.textTransform === "uppercase" ? "none" : "uppercase";
  }
});

fillColor?.addEventListener("input", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("shape-layer")) {
    selectedLayer.style.setProperty("--shape-fill", e.target.value);
  }
});

strokeColor?.addEventListener("input", (e) => {
  if (selectedLayer) {
    selectedLayer.style.setProperty("--shape-stroke", e.target.value);
  }
});

strokeWidth?.addEventListener("input", (e) => {
  if (selectedLayer) {
    selectedLayer.style.setProperty("--shape-stroke-width", `${e.target.value}px`);
  }
});

shapeType?.addEventListener("change", (e) => {
  if (selectedLayer && selectedLayer.classList.contains("shape-layer")) {
    const type = e.target.value;
    selectedLayer.dataset.shape = type;
    applyShapeClass(selectedLayer, type);
  }
});

bgColor?.addEventListener("input", (e) => {
  canvas.style.background = e.target.value;
  canvas.style.setProperty("--canvas-bg", e.target.value);
});

bringFront?.addEventListener("click", () => {
  if (!selectedLayer) return;
  const layers = Array.from(canvas.querySelectorAll(".layer"));
  const maxZ = layers.reduce((m, el) => Math.max(m, Number(el.style.zIndex || 1)), 1);
  selectedLayer.style.zIndex = maxZ + 1;
  zCounter = Math.max(zCounter, maxZ + 2);
});

sendBack?.addEventListener("click", () => {
  if (!selectedLayer) return;
  const layers = Array.from(canvas.querySelectorAll(".layer"));
  const minZ = layers.reduce((m, el) => Math.min(m, Number(el.style.zIndex || 1)), 1);
  selectedLayer.style.zIndex = minZ - 1;
});

deleteLayerBtn?.addEventListener("click", () => {
  if (selectedLayers.length) {
    selectedLayers.forEach((el) => el.remove());
    selectedLayers = [];
    selectedLayer = null;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && selectedLayers.length) {
    selectedLayers.forEach((el) => el.remove());
    selectedLayers = [];
    selectedLayer = null;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedLayers.length) {
    e.preventDefault();
    const payload = selectedLayers.map((el) => ({
      html: el.outerHTML,
      style: {
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        zIndex: el.style.zIndex,
      },
    }));
    sessionStorage.setItem("post_designer_clipboard", JSON.stringify(payload));
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
    e.preventDefault();
    const raw = sessionStorage.getItem("post_designer_clipboard");
    if (!raw) return;
    const items = JSON.parse(raw);
    const clones = items.map((item) => {
      const temp = document.createElement("div");
      temp.innerHTML = item.html;
      const el = temp.firstElementChild;
      if (!el) return null;
      el.style.left = `${parseFloat(item.style.left || 0) + 20}px`;
      el.style.top = `${parseFloat(item.style.top || 0) + 20}px`;
      el.style.width = item.style.width;
      el.style.height = item.style.height;
      el.style.zIndex = zCounter++;
      canvas.appendChild(el);
      attachLayerEvents(el);
      return el;
    }).filter(Boolean);
    setSelection(clones);
  }
});

exportBtn?.addEventListener("click", async () => {
  const canvasEl = document.getElementById("design-canvas");
  await waitForImages(canvasEl);
  const canvasImage = await html2canvas(canvasEl, { backgroundColor: null, useCORS: true, allowTaint: true });
  const link = document.createElement("a");
  link.download = "post.png";
  link.href = canvasImage.toDataURL("image/png");
  link.click();
});

async function waitForImages(root) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );
}

// Init
document.querySelectorAll(".layer").forEach((el) => attachLayerEvents(el));
canvas.style.setProperty("--canvas-bg", canvas.style.background || "#111827");

function applyShapeClass(el, type) {
  const svg = el.querySelector(".shape-svg");
  if (!svg) return;
  let shape = "";
  if (type === "rect") {
    shape = `<rect x="5" y="5" width="90" height="90" rx="12" ry="12" />`;
  } else if (type === "circle") {
    shape = `<circle cx="50" cy="50" r="45" />`;
  } else if (type === "triangle") {
    shape = `<polygon points="50,5 95,95 5,95" />`;
  } else if (type === "heart") {
    shape = `<path d="M50 85 C20 65 0 40 15 20 C30 0 50 15 50 30 C50 15 70 0 85 20 C100 40 80 65 50 85 Z" />`;
  } else if (type === "star") {
    shape = `<polygon points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" />`;
  } else if (type === "moon") {
    shape = `<path d="M70 5 A45 45 0 1 0 70 95 A28 45 0 1 1 70 5 Z" />`;
  } else if (type === "diamond") {
    shape = `<polygon points="50,5 95,50 50,95 5,50" />`;
  } else if (type === "hexagon") {
    shape = `<polygon points="25,5 75,5 95,50 75,95 25,95 5,50" />`;
  } else if (type === "pentagon") {
    shape = `<polygon points="50,5 95,40 80,95 20,95 5,40" />`;
  } else if (type === "arrow") {
    shape = `<polygon points="5,35 65,35 65,10 95,50 65,90 65,65 5,65" />`;
  } else if (type === "speech") {
    shape = `<polygon points="5,5 95,5 95,80 60,80 45,95 45,80 5,80" />`;
  } else if (type === "cross") {
    shape = `<polygon points="35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35" />`;
  } else if (type === "blob") {
    shape = `<path d="M20 10 C35 0 70 0 85 20 C100 40 95 70 75 85 C55 100 25 95 10 70 C-5 45 5 20 20 10 Z" />`;
  } else if (type === "ring") {
    shape = `<path d="M50 5 A45 45 0 1 1 49.9 5 Z M50 22 A28 28 0 1 0 50.1 22 Z" />`;
  } else if (type === "burst") {
    shape = `<polygon points="50,0 58,20 80,8 72,30 95,30 75,45 95,60 72,60 80,82 58,70 50,100 42,70 20,82 28,60 5,60 25,45 5,30 28,30 20,8 42,20" />`;
  } else if (type === "cloud") {
    shape = `<path d="M25 70 C10 70 10 50 25 48 C28 35 40 30 50 35 C60 25 80 30 82 45 C95 48 95 70 80 70 Z" />`;
  } else if (type === "chevron") {
    shape = `<polygon points="10,20 50,80 90,20 70,20 50,50 30,20" />`;
  } else if (type === "pill") {
    shape = `<rect x="5" y="25" width="90" height="50" rx="25" ry="25" />`;
  } else if (type === "parallelogram") {
    shape = `<polygon points="20,10 100,10 80,90 0,90" />`;
  } else if (type === "ticket") {
    shape = `<path d="M10 10 H90 A10 10 0 0 1 90 90 H10 A10 10 0 0 1 10 10 M10 40 A10 10 0 0 0 10 60 M90 40 A10 10 0 0 1 90 60" />`;
  }
  svg.innerHTML = `<g class="shape-geo">${shape}</g>`;
}
