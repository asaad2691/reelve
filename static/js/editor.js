const templateForm = document.getElementById("template-form");
if (templateForm) {
  templateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(templateForm);
    const name = formData.get("name");
    const message = document.getElementById("template-message");

    const videoW = Number(document.getElementById("tpl-video-w")?.value || 0);
    const videoH = Number(document.getElementById("tpl-video-h")?.value || 0);
    const imageW = Number(document.getElementById("tpl-image-w")?.value || 0);
    const imageH = Number(document.getElementById("tpl-image-h")?.value || 0);

    const config = {
      video: {
        resize: videoW && videoH ? [videoW, videoH] : undefined,
        speed: Number(document.getElementById("tpl-video-speed")?.value || 1),
        text: document.getElementById("tpl-video-text")?.value || "",
        brightness: Number(document.getElementById("tpl-video-brightness")?.value || 1),
        contrast: Number(document.getElementById("tpl-video-contrast")?.value || 1),
        saturation: Number(document.getElementById("tpl-video-saturation")?.value || 1),
      },
      image: {
        resize: imageW && imageH ? [imageW, imageH] : undefined,
        filter: document.getElementById("tpl-image-filter")?.value || "",
        brightness: Number(document.getElementById("tpl-image-brightness")?.value || 1),
        contrast: Number(document.getElementById("tpl-image-contrast")?.value || 1),
        saturation: Number(document.getElementById("tpl-image-saturation")?.value || 1),
      },
    };

    if (!name) {
      message.textContent = "Template name is required.";
      return;
    }

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config }),
    });
    const data = await res.json();
    if (res.ok) {
      message.textContent = "Template saved. Refresh to see it in the list.";
    } else {
      message.textContent = data.error || "Failed to save template.";
    }
  });
}

const editorForm = document.getElementById("editor-form");
if (editorForm) {
  const mediaInput = document.getElementById("media-input");
  const modeSelect = document.getElementById("mode-select");
  const templateSelect = document.getElementById("template-select");
  const editsField = document.getElementById("edits-json");
  const exportBtn = document.getElementById("editor-export");

  const videoPreview = document.getElementById("video-preview");
  const imagePreview = document.getElementById("image-preview");
  const overlay = document.getElementById("preview-overlay");

  const controls = {
    speed: document.getElementById("speed"),
    brightness: document.getElementById("brightness"),
    contrast: document.getElementById("contrast"),
    saturation: document.getElementById("saturation"),
    blur: document.getElementById("blur"),
    text: document.getElementById("text"),
    fontSize: document.getElementById("font-size"),
    textColor: document.getElementById("text-color"),
    resize: document.getElementById("resize"),
    trim: document.getElementById("trim"),
    silenceThreshold: document.getElementById("silence-threshold"),
    minClip: document.getElementById("min-clip"),
  };

  function cssFilter() {
    return [
      `brightness(${controls.brightness.value})`,
      `contrast(${controls.contrast.value})`,
      `saturate(${controls.saturation.value})`,
      `blur(${controls.blur.value}px)`,
    ].join(" ");
  }

  function updateOverlay() {
    if (!overlay) return;
    overlay.textContent = controls.text.value || "";
    overlay.style.fontSize = `${controls.fontSize.value}px`;
    overlay.style.color = controls.textColor.value;
  }

  function updatePreview() {
    const filter = cssFilter();
    videoPreview.style.filter = filter;
    imagePreview.style.filter = filter;
    const designerCanvas = document.getElementById("ed-design-canvas");
    if (designerCanvas) {
      designerCanvas.style.filter = filter;
    }
    updateOverlay();
  }

  function applyTextToDesigner() {
    const canvas = document.getElementById("ed-design-canvas");
    if (!canvas) return;
    let target = canvas.querySelector("#brand-text");
    if (!target) {
      target = document.createElement("div");
      target.id = "brand-text";
      target.className = "layer text-layer";
      target.contentEditable = "true";
      target.style.top = "24px";
      target.style.left = "24px";
      canvas.appendChild(target);
    }
    target.textContent = controls.text.value || target.textContent;
    target.style.fontSize = `${controls.fontSize.value}px`;
    target.style.color = controls.textColor.value;
  }

  function parsePair(value) {
    if (!value) return null;
    const parts = value.split(",").map((n) => n.trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    const nums = parts.map((n) => Number(n));
    if (nums.some((n) => Number.isNaN(n))) return null;
    return nums;
  }

  function collectEdits() {
    const safeVal = (el, fallback = "") => (el ? el.value : fallback);
    const edits = {
      speed: Number(safeVal(controls.speed, 1)),
      brightness: Number(safeVal(controls.brightness, 1)),
      contrast: Number(safeVal(controls.contrast, 1)),
      saturation: Number(safeVal(controls.saturation, 1)),
      text: safeVal(controls.text, ""),
      font_size: Number(safeVal(controls.fontSize, 48)),
      text_color: safeVal(controls.textColor, "#ffffff"),
    };

    if (Number(safeVal(controls.blur, 0)) > 0) {
      edits.blur = Number(safeVal(controls.blur, 0));
    }

    // Keep filter explicit; saturation should not force a filter preset

    const resize = parsePair(safeVal(controls.resize, ""));
    if (resize) edits.resize = resize;

    const trim = parsePair(safeVal(controls.trim, ""));
    if (trim) edits.trim = trim;

    if (safeVal(controls.silenceThreshold, "")) {
      edits.silence_threshold = Number(safeVal(controls.silenceThreshold, 0));
    }
    if (safeVal(controls.minClip, "")) {
      edits.min_clip = Number(safeVal(controls.minClip, 0));
    }

    editsField.value = JSON.stringify(edits);
  }

  function showPreview(file) {
    const url = URL.createObjectURL(file);
    const preview = document.querySelector(".ae-preview");
    const designerCanvas = document.getElementById("ed-design-canvas");
    if (file.type.startsWith("video")) {
      videoPreview.src = url;
      videoPreview.classList.remove("d-none");
      imagePreview.classList.add("d-none");
      if (designerCanvas) {
        designerCanvas.classList.remove("d-none");
        designerCanvas.style.backgroundImage = "none";
        videoPreview.addEventListener("loadedmetadata", () => {
          const w = videoPreview.videoWidth || preview?.clientWidth || 640;
          const h = videoPreview.videoHeight || preview?.clientHeight || 360;
          designerCanvas.style.width = `${w}px`;
          designerCanvas.style.height = `${h}px`;
          const cw = document.getElementById("ed-canvas-width");
          const ch = document.getElementById("ed-canvas-height");
          if (cw && ch) {
            cw.value = w;
            ch.value = h;
          }
        }, { once: true });
      }
      modeSelect.value = "video";
    } else {
      imagePreview.src = url;
      imagePreview.classList.add("d-none");
      videoPreview.classList.add("d-none");
      if (designerCanvas) {
        designerCanvas.classList.remove("d-none");
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          designerCanvas.dataset.source = dataUrl;
          designerCanvas.style.backgroundImage = `url('${dataUrl}')`;
          designerCanvas.style.backgroundSize = "contain";
          designerCanvas.style.backgroundRepeat = "no-repeat";
          designerCanvas.style.backgroundPosition = "center";
          // Ensure brand text exists for property bindings
          applyTextToDesigner();
        };
        reader.readAsDataURL(file);
        // Ensure brand text exists for property bindings
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || preview?.clientWidth || 640;
          const h = img.naturalHeight || preview?.clientHeight || 360;
          designerCanvas.style.width = `${w}px`;
          designerCanvas.style.height = `${h}px`;
          const cw = document.getElementById("ed-canvas-width");
          const ch = document.getElementById("ed-canvas-height");
          if (cw && ch) {
            cw.value = w;
            ch.value = h;
          }
        };
        img.src = url;
      }
      modeSelect.value = "image";
    }
  }

  mediaInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) showPreview(file);
  });

  Object.values(controls).forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      updatePreview();
      collectEdits();
      applyTextToDesigner();
    });
  });

  templateSelect?.addEventListener("change", async () => {
    const id = templateSelect.value;
    if (!id) return;
    const res = await fetch("/api/templates");
    const templates = await res.json();
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const cfg = template.config?.video || {};
    controls.speed.value = cfg.speed ?? 1;
    controls.brightness.value = cfg.brightness ?? 1;
    controls.contrast.value = cfg.contrast ?? 1;
    controls.saturation.value = cfg.saturation ?? 1;
    controls.text.value = cfg.text ?? "";
    controls.resize.value = cfg.resize ? cfg.resize.join(",") : "";
    updatePreview();
    collectEdits();
  });

  const params = new URLSearchParams(window.location.search);
  const preset = params.get("template");
  if (preset && templateSelect) {
    templateSelect.value = preset;
    templateSelect.dispatchEvent(new Event("change"));
  }

  document.querySelectorAll(".copy-config").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const config = btn.getAttribute("data-config");
      await navigator.clipboard.writeText(config);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy Config"), 1200);
    });
  });

  updatePreview();
  collectEdits();

  async function exportImageCanvas() {
    const canvasEl = document.getElementById("ed-design-canvas");
    if (!canvasEl || !window.html2canvas) return false;
    const filter = cssFilter();
    const originalBg = canvasEl.style.backgroundImage;
    const originalFilter = canvasEl.style.filter;
    const src = canvasEl.dataset.source;
    if (src) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
      });
      const temp = document.createElement("canvas");
      const w = canvasEl.clientWidth;
      const h = canvasEl.clientHeight;
      temp.width = w;
      temp.height = h;
      const tctx = temp.getContext("2d");
      tctx.filter = filter;
      const scale = Math.min(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (w - drawW) / 2;
      const dy = (h - drawH) / 2;
      tctx.drawImage(img, dx, dy, drawW, drawH);
      canvasEl.style.backgroundImage = `url(${temp.toDataURL("image/png")})`;
    }
    canvasEl.style.filter = "none";
    const images = Array.from(canvasEl.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );
    const out = await html2canvas(canvasEl, { backgroundColor: null, useCORS: true, allowTaint: true });
    const link = document.createElement("a");
    link.download = "image_edit.png";
    link.href = out.toDataURL("image/png");
    link.click();
    canvasEl.style.backgroundImage = originalBg;
    canvasEl.style.filter = originalFilter;
    return true;
  }

  exportBtn?.addEventListener("click", async () => {
    collectEdits();
    const hasFile = mediaInput && mediaInput.files && mediaInput.files.length > 0;
    const isImageMode = modeSelect && modeSelect.value === "image";
    if (!hasFile) {
      await exportImageCanvas();
      return;
    }
    if (isImageMode) {
      await exportImageCanvas();
      return;
    }
    editorForm.submit();
  });
}
