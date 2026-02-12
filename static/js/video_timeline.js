const fileInput = document.getElementById("timeline-files");
const list = document.getElementById("timeline-list");
const timelineField = document.getElementById("timeline-json");

let items = [];

function renderList() {
  list.innerHTML = "";
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    row.draggable = true;
    row.dataset.index = index;

    row.innerHTML = `
      <div class="timeline-item__handle">≡</div>
      <div class="timeline-item__name">${item.name}</div>
      <input class="form-control form-control-sm timeline-input" data-field="start" value="${item.start}">
      <input class="form-control form-control-sm timeline-input" data-field="end" value="${item.end}">
    `;

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index.toString());
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = index;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      renderList();
      collectTimeline();
    });

    row.querySelectorAll(".timeline-input").forEach((input) => {
      input.addEventListener("input", () => {
        item[input.dataset.field] = input.value;
        collectTimeline();
      });
    });

    list.appendChild(row);
  });
}

function collectTimeline() {
  const timeline = items.map((item, index) => {
    const start = Number(item.start || 0);
    const end = Number(item.end || 0);
    const entry = { index };
    if (start || end) {
      entry.trim = [start, end || undefined];
    }
    return entry;
  });
  timelineField.value = JSON.stringify(timeline);
}

fileInput?.addEventListener("change", (e) => {
  items = Array.from(e.target.files).map((f) => ({
    name: f.name,
    start: "",
    end: "",
  }));
  renderList();
  collectTimeline();
});
