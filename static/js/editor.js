const templateForm = document.getElementById("template-form");
if (templateForm) {
  templateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(templateForm);
    const name = formData.get("name");
    const configRaw = formData.get("config");
    const message = document.getElementById("template-message");

    try {
      const config = JSON.parse(configRaw);
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
    } catch (err) {
      message.textContent = "Invalid JSON in config.";
    }
  });
}

const editorForm = document.getElementById("editor-form");
if (editorForm) {
  const mediaInput = document.getElementById("media-input");
  const modeSelect = document.getElementById("mode-select");
  const templateSelect = document.getElementById("template-select");
  const editsField = document.getElementById("edits-json");

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
    overlay.textContent = controls.text.value || "";
    overlay.style.fontSize = `${controls.fontSize.value}px`;
    overlay.style.color = controls.textColor.value;
  }

  function updatePreview() {
    const filter = cssFilter();
    videoPreview.style.filter = filter;
    imagePreview.style.filter = filter;
    updateOverlay();
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
    const edits = {
      speed: Number(controls.speed.value),
      brightness: Number(controls.brightness.value),
      contrast: Number(controls.contrast.value),
      text: controls.text.value,
      font_size: Number(controls.fontSize.value),
      text_color: controls.textColor.value,
    };

    if (Number(controls.blur.value) > 0) {
      edits.blur = Number(controls.blur.value);
    }

    if (Number(controls.saturation.value) !== 1) {
      edits.filter = "vivid";
    }

    const resize = parsePair(controls.resize.value);
    if (resize) edits.resize = resize;

    const trim = parsePair(controls.trim.value);
    if (trim) edits.trim = trim;

    if (controls.silenceThreshold.value) {
      edits.silence_threshold = Number(controls.silenceThreshold.value);
    }
    if (controls.minClip.value) {
      edits.min_clip = Number(controls.minClip.value);
    }

    editsField.value = JSON.stringify(edits);
  }

  function showPreview(file) {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video")) {
      videoPreview.src = url;
      videoPreview.classList.remove("d-none");
      imagePreview.classList.add("d-none");
      modeSelect.value = "video";
    } else {
      imagePreview.src = url;
      imagePreview.classList.remove("d-none");
      videoPreview.classList.add("d-none");
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
}
