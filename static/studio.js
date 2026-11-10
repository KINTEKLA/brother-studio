

const historyScreen = document.getElementById("historyScreen");
const workspaceGallery = document.querySelector(".workspace");

function setGalleryOpen(open) {
  historyScreen.hidden = !open;
  historyScreen.style.display = open ? "flex" : "none";

  const galleryButton = document.getElementById("openHistory");
  galleryButton.textContent = open ? "Close Gallery" : "Gallery";
  galleryButton.setAttribute("aria-expanded", String(open));
  workspaceGallery.classList.toggle("gallery-open", open);
}

setGalleryOpen(false);

document.getElementById("openHistory").addEventListener("click", () => {
  setGalleryOpen(historyScreen.hidden);
});

document.getElementById("deleteSelected").addEventListener("click", async () => {
  const selected = Array.from(
    document.querySelectorAll(".historySelect:checked")
  ).map(item => item.value);

  if (!selected.length) return;

  const confirmed = confirm(
    `Permanently delete ${selected.length} selected history entries and their saved images?`
  );
  if (!confirmed) return;

  const deleteButton = document.getElementById("deleteSelected");
  deleteButton.disabled = true;

  try {
    const response = await fetch("/history/delete", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ids: selected})
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    await loadPrintHistory();
    document.getElementById("historyStatus").textContent = result.message;
  } catch (error) {
    document.getElementById("historyStatus").textContent =
      "Deletion failed: " + error.message;
    deleteButton.disabled = false;
  }
});

async function loadPrintHistory() {
  const list = document.getElementById("historyList");
  const status = document.getElementById("historyStatus");

  status.textContent = "Loading history...";
  list.replaceChildren();

  try {
    const response = await fetch("/history");
    if (!response.ok) throw new Error("Unable to retrieve history");

    const records = await response.json();
    status.textContent = records.length
      ? `${records.length} saved entries`
      : "No saved prints yet.";

    for (const record of records) {
      const entry = document.createElement("div");
      entry.className = "history-card";

      const thumbnail = document.createElement("img");
      thumbnail.src = "/history/image/" + encodeURIComponent(record.id);
      thumbnail.alt = "Saved print";
      thumbnail.className = "history-thumbnail";

      const details = document.createElement("p");
      const date = new Date(record.timestamp).toLocaleString();
      const method = record.method ||
        (record.dither ? "floyd" : "threshold");

      const methodNames = {
        threshold: "Threshold",
        floyd: "Floyd–Steinberg",
        line: "Line Halftone"
      };

      details.className = "history-details";
      details.textContent =
        `${methodNames[method] || method} · ${date}`;

      const sendButton = document.createElement("button");
      sendButton.type = "button";
      sendButton.textContent = "Load";

      sendButton.addEventListener("click", () => {
        ++previewRequest;
        if (imageURL) URL.revokeObjectURL(imageURL);
        if (processedURL) URL.revokeObjectURL(processedURL);

        imageURL = null;
        processedURL = null;
        previewMode = "processed";
        historyImage = record;
        printOrientation.value = "0";
        appliedCrop = null;
        input.value = "";

        contrast.value = record.contrast;
        threshold.value = record.threshold;
        dither.checked = record.dither;

        processingMethod.value =
          record.method || (record.dither ? "floyd" : "threshold");

        setLineSpacing(record.line_spacing ?? 6, false);
        setBackgroundCutoff(record.background_cutoff ?? 180, false);
        syncMethodControls();
	contrastNumber.value = Number(record.contrast).toFixed(1);
        thresholdNumber.value = record.threshold;

        document.getElementById("contrastValue").textContent = contrast.value;
        document.getElementById("thresholdValue").textContent = threshold.value;

        updatePreview();
        button.disabled = false;

        setGalleryOpen(false);
      });

      const selection = document.createElement("input");
      selection.type = "checkbox";
      selection.className = "historySelect";
      selection.title = "Select for deletion";
      selection.setAttribute(
        "aria-label", "Select print for deletion"
      );
      selection.value = record.id;
      selection.addEventListener("change", () => {
        document.getElementById("deleteSelected").disabled =
          !document.querySelector(".historySelect:checked");
      });

      thumbnail.addEventListener("click", () => {
        sendButton.click();
      });

      entry.append(selection, thumbnail, details, sendButton);
      list.appendChild(entry);
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById("openHistory")
  .addEventListener("click", loadPrintHistory);

const input = document.getElementById("image");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const button = document.getElementById("print");
const printCopies = document.getElementById("printCopies");

function validateCopies() {
  const value = Number(printCopies.value);
  printCopies.value = Number.isFinite(value)
    ? Math.max(1, Math.min(50, Math.trunc(value)))
    : 1;
}

printCopies.addEventListener("change", validateCopies);
let imageURL = null;
let historyImage = null;
let processedURL = null;
let previewMode = "processed";
let appliedCrop = null;

const showOriginal = document.getElementById("showOriginal");
const showProcessed = document.getElementById("showProcessed");
const printOrientation = document.getElementById("printOrientation");

function displayPreview() {
  const cropButton = document.getElementById("openCrop");
  cropButton.disabled = !imageURL || Boolean(historyImage);
  cropButton.textContent = appliedCrop
    ? "Crop / Position (Active)"
    : "Crop / Position";

  document.getElementById("exportPNG").disabled =
    !(historyImage || input.files[0]);

  const originalAvailable = Boolean(imageURL) && !historyImage;
  showOriginal.disabled = !originalAvailable;

  if (!originalAvailable) previewMode = "processed";

  showOriginal.classList.toggle("active", previewMode === "original");
  showProcessed.classList.toggle("active", previewMode === "processed");

  let source = null;

  if (historyImage) {
    source = "/history/image/" + encodeURIComponent(historyImage.id);
  } else if (previewMode === "original") {
    source = imageURL;
  } else {
    source = processedURL || imageURL;
  }

  if (source) {
    preview.src = source;
    preview.hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
  }
}

showOriginal.addEventListener("click", () => {
  previewMode = "original";
  displayPreview();
});

showProcessed.addEventListener("click", () => {
  previewMode = "processed";
  displayPreview();
});
input.addEventListener("change", () => {
  ++previewRequest;
  historyImage = null;
  appliedCrop = null;
  previewMode = "processed";
  button.disabled = true;

  if (imageURL) URL.revokeObjectURL(imageURL);
  if (processedURL) URL.revokeObjectURL(processedURL);

  imageURL = null;
  processedURL = null;

  const file = input.files[0];

  if (!file) {
    status.textContent = "Select an image to begin.";
    displayPreview();
    return;
  }

  imageURL = URL.createObjectURL(file);
  status.textContent = file.name;
  displayPreview();
});


const contrast = document.getElementById("contrast");
const threshold = document.getElementById("threshold");
const dither = document.getElementById("dither");

const processingMethod = document.getElementById("processingMethod");
const lineOptions = document.getElementById("lineOptions");
const lineSpacing = document.getElementById("lineSpacing");
const backgroundCutoff = document.getElementById("backgroundCutoff");

function syncMethodControls() {
  const method = processingMethod.value;

  lineOptions.hidden = method !== "line";

  // Threshold only applies to the threshold method.
  threshold.closest(".precision-control").parentElement.hidden =
    method !== "threshold";

  // Preserve the original backend compatibility field.
  dither.checked = method === "floyd";
}

function bindIntegerControl(id, minimum, maximum) {
  const slider = document.getElementById(id);
  const number = document.getElementById(id + "Number");
  const minus = document.getElementById(id + "Minus");
  const plus = document.getElementById(id + "Plus");

  function setValue(value, refresh = true) {
    if (value === "") {
      number.value = slider.value;
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      number.value = slider.value;
      return;
    }

    const adjusted = Math.round(
      Math.max(minimum, Math.min(maximum, parsed))
    );

    slider.value = adjusted;
    number.value = adjusted;

    if (refresh) updatePreview();
  }

  slider.addEventListener("input", () => {
    setValue(slider.value);
  });

  number.addEventListener("change", () => {
    setValue(number.value);
  });

  minus.addEventListener("click", () => {
    setValue(Number(slider.value) - 1);
  });

  plus.addEventListener("click", () => {
    setValue(Number(slider.value) + 1);
  });

  return setValue;
}

const setLineSpacing = bindIntegerControl("lineSpacing", 3, 10);
const setBackgroundCutoff = bindIntegerControl(
  "backgroundCutoff", 0, 255
);

processingMethod.addEventListener("change", () => {
  syncMethodControls();
  updatePreview();
});

syncMethodControls();

let previewRequest = 0;

async function updatePreview() {
  if (historyImage) {
    displayPreview();
    status.textContent = "Saved print loaded — original processing preserved.";
    return;
  }

  const file = input.files[0];
  if (!file) return;

  const requestNumber = ++previewRequest;
  const data = new FormData();

  data.append("image", file);
  data.append("contrast", contrast.value);
  data.append("threshold", threshold.value);
  data.append("dither", dither.checked);
  data.append("method", processingMethod.value);
  data.append("line_spacing", lineSpacing.value);
  data.append("background_cutoff", backgroundCutoff.value);
  data.append("rotate", printOrientation.value);
  if (appliedCrop) data.append("crop", JSON.stringify(appliedCrop));

  status.textContent = "Processing preview...";

  try {
    const response = await fetch("/preview", {
      method: "POST",
      body: data
    });

    if (!response.ok) throw new Error("Preview processing failed");

    const blob = await response.blob();
    if (requestNumber !== previewRequest) return;

    const newURL = URL.createObjectURL(blob);
    const previousURL = processedURL;

    processedURL = newURL;
    displayPreview();
    button.disabled = false;

    if (previousURL) URL.revokeObjectURL(previousURL);

    status.textContent = "Processed preview ready.";
  } catch (error) {
    if (requestNumber === previewRequest) {
      status.textContent = error.message;
    }
  }
}


const contrastNumber = document.getElementById("contrastNumber");

function setContrast(value) {
  const min = Number(contrast.min);
  const max = Number(contrast.max);

  const number = Number(value);
  if (!Number.isFinite(number)) return;

  const clamped = Math.min(max, Math.max(min, number));
  const adjusted = Math.round(clamped * 10) / 10;

  contrast.value = adjusted;
  contrastNumber.value = adjusted.toFixed(1);
  document.getElementById("contrastValue").textContent = adjusted.toFixed(1);

  updatePreview();
}

contrast.addEventListener("input", () => {
  setContrast(contrast.value);
});

document.getElementById("contrastMinus").addEventListener("click", () => {
  setContrast(Number(contrast.value) - 0.1);
});

document.getElementById("contrastPlus").addEventListener("click", () => {
  setContrast(Number(contrast.value) + 0.1);
});

contrastNumber.addEventListener("change", () => {
  setContrast(contrastNumber.value);
});

const thresholdNumber = document.getElementById("thresholdNumber");

function setThreshold(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;

  const adjusted = Math.round(Math.min(255, Math.max(0, number)));

  threshold.value = adjusted;
  thresholdNumber.value = adjusted;
  document.getElementById("thresholdValue").textContent = adjusted;

  updatePreview();
}

threshold.addEventListener("input", () => {
  setThreshold(threshold.value);
});

document.getElementById("thresholdMinus").addEventListener("click", () => {
  setThreshold(Number(threshold.value) - 1);
});

document.getElementById("thresholdPlus").addEventListener("click", () => {
  setThreshold(Number(threshold.value) + 1);
});

thresholdNumber.addEventListener("change", () => {
  if (thresholdNumber.value === "") {
    thresholdNumber.value = threshold.value;
    return;
  }
  setThreshold(thresholdNumber.value);
});
dither.addEventListener("change", updatePreview);
printOrientation.addEventListener("change", updatePreview);
input.addEventListener("change", updatePreview);

button.addEventListener("click", async () => {

  const file = input.files[0];
  if (!file && !historyImage) return;
  button.disabled = true;
  status.textContent = "Sending to printer...";

  if (historyImage) {
    try {
      const reprintData = new FormData();
      reprintData.append("copies", printCopies.value);

      const response = await fetch(
        "/history/reprint/" + encodeURIComponent(historyImage.id),
        { method: "POST", body: reprintData }
      );
      const result = await response.json();
      status.textContent = result.message;
    } catch (error) {
      status.textContent = "Reprint request failed: " + error.message;
    } finally {
      button.disabled = false;
    }
    return;
  }

  const data = new FormData();
  data.append("image", file);
  data.append("copies", printCopies.value);
  data.append("contrast", contrast.value);
  data.append("threshold", threshold.value);
  data.append("dither", dither.checked);
  data.append("method", processingMethod.value);
  data.append("line_spacing", lineSpacing.value);
  data.append("background_cutoff", backgroundCutoff.value);
  data.append("rotate", printOrientation.value);
  if (appliedCrop) data.append("crop", JSON.stringify(appliedCrop));

  try {
    const response = await fetch("/print", {
      method: "POST",
      body: data
    });
    const result = await response.json();
    status.textContent = result.message;
  } catch (error) {
    status.textContent = "Printing request failed: " + error.message;
  } finally {
    button.disabled = false;
  }
});


// Collapsible editing panel

const toggleEditing = document.getElementById("toggleEditing");
const editingPanel = document.getElementById("editingPanel");
const workspace = document.querySelector(".workspace");

toggleEditing.addEventListener("click", () => {
  const collapsed = !editingPanel.hidden;

  editingPanel.hidden = collapsed;
  workspace.classList.toggle("editing-collapsed", collapsed);

  toggleEditing.textContent =
    collapsed ? "Show Adjustments" : "Hide Adjustments";

  toggleEditing.setAttribute("aria-expanded", String(!collapsed));
});


// Artwork inspector

const inspectDialog = document.getElementById("inspectDialog");
const inspectStage = document.getElementById("inspectStage");
const inspectImage = document.getElementById("inspectImage");
const inspectZoomValue = document.getElementById("inspectZoomValue");

let inspectScale = 1;
let inspectX = 0;
let inspectY = 0;
let inspectDragging = false;
let inspectLastX = 0;
let inspectLastY = 0;

function renderInspector() {
  inspectImage.style.transform =
    `translate(calc(-50% + ${inspectX}px), ` +
    `calc(-50% + ${inspectY}px)) scale(${inspectScale})`;

  inspectZoomValue.textContent =
    Math.round(inspectScale * 100) + "%";
}

function syncInspectorMode() {
  const originalButton = document.getElementById("inspectOriginal");
  const processedButton = document.getElementById("inspectProcessed");

  originalButton.disabled = showOriginal.disabled;

  originalButton.classList.toggle(
    "active", showOriginal.classList.contains("active")
  );

  processedButton.classList.toggle(
    "active", showProcessed.classList.contains("active")
  );
}

function fitInspector() {
  if (!inspectImage.naturalWidth || !inspectImage.naturalHeight) return;

  const width = Math.max(1, inspectStage.clientWidth - 24);
  const height = Math.max(1, inspectStage.clientHeight - 24);

  inspectScale = Math.min(
    1,
    width / inspectImage.naturalWidth,
    height / inspectImage.naturalHeight
  );

  inspectX = 0;
  inspectY = 0;
  renderInspector();
}

function setInspectorScale(nextScale, clientX, clientY) {
  const oldScale = inspectScale;
  inspectScale = Math.max(0.05, Math.min(16, nextScale));

  if (clientX !== undefined && clientY !== undefined) {
    const rect = inspectStage.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    const ratio = inspectScale / oldScale;

    inspectX = x - (x - inspectX) * ratio;
    inspectY = y - (y - inspectY) * ratio;
  }

  renderInspector();
}

function updateInspectorImage() {
  if (!inspectDialog.open || preview.hidden) return;

  syncInspectorMode();

  const source = preview.currentSrc || preview.src;

  if (!source) return;

  if (inspectImage.src !== source) {
    inspectImage.src = source;
  }
}

function openArtworkInspector() {
  if (preview.hidden || !preview.getAttribute("src")) return;

  inspectDialog.showModal();
  syncInspectorMode();

  inspectImage.src = preview.currentSrc || preview.src;

  if (inspectImage.complete && inspectImage.naturalWidth) {
    fitInspector();
  }
}

document.getElementById("openInspector")
  .addEventListener("click", openArtworkInspector);

preview.addEventListener("click", openArtworkInspector);

preview.addEventListener("load", updateInspectorImage);

inspectImage.addEventListener("load", fitInspector);

document.getElementById("inspectClose").addEventListener("click", () => {
  inspectDialog.close();
});

document.getElementById("inspectFit").addEventListener("click", fitInspector);

document.getElementById("inspectActual").addEventListener("click", () => {
  inspectScale = 1;
  inspectX = 0;
  inspectY = 0;
  renderInspector();
});

document.getElementById("inspectPlus").addEventListener("click", () => {
  setInspectorScale(inspectScale * 1.25);
});

document.getElementById("inspectMinus").addEventListener("click", () => {
  setInspectorScale(inspectScale / 1.25);
});

document.getElementById("inspectOriginal").addEventListener("click", () => {
  if (!showOriginal.disabled) {
    showOriginal.click();
    syncInspectorMode();
  }
});

document.getElementById("inspectProcessed").addEventListener("click", () => {
  showProcessed.click();
  syncInspectorMode();
});

inspectStage.addEventListener("wheel", (event) => {
  event.preventDefault();

  const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;

  setInspectorScale(
    inspectScale * factor,
    event.clientX,
    event.clientY
  );
}, { passive: false });

inspectStage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;

  inspectDragging = true;
  inspectLastX = event.clientX;
  inspectLastY = event.clientY;

  inspectStage.setPointerCapture(event.pointerId);
  inspectStage.classList.add("dragging");
});

inspectStage.addEventListener("pointermove", (event) => {
  if (!inspectDragging) return;

  inspectX += event.clientX - inspectLastX;
  inspectY += event.clientY - inspectLastY;

  inspectLastX = event.clientX;
  inspectLastY = event.clientY;

  renderInspector();
});

function stopInspectDragging() {
  inspectDragging = false;
  inspectStage.classList.remove("dragging");
}

inspectStage.addEventListener("pointerup", stopInspectDragging);
inspectStage.addEventListener("pointercancel", stopInspectDragging);
inspectStage.addEventListener("lostpointercapture", stopInspectDragging);


/* Brother Studio — Export PNG */

async function exportArtworkPNG() {
  const exportButton = document.getElementById("exportPNG");
  const file = input.files[0];

  if (!file && !historyImage) {
    status.textContent = "Select an image before exporting.";
    return;
  }

  exportButton.disabled = true;
  status.textContent = "Preparing PNG export...";

  try {
    let response;
    let filename;

    if (historyImage) {
      response = await fetch(
        "/history/image/" + encodeURIComponent(historyImage.id)
      );

      filename = "brother-studio-" + historyImage.id + ".png";

    } else {
      const data = new FormData();

      data.append("image", file);
      data.append("contrast", contrast.value);
      data.append("threshold", threshold.value);
      data.append("dither", dither.checked);
      data.append("method", processingMethod.value);
      data.append("line_spacing", lineSpacing.value);
      data.append("background_cutoff", backgroundCutoff.value);
      data.append("rotate", printOrientation.value);
      if (appliedCrop) data.append("crop", JSON.stringify(appliedCrop));

      response = await fetch("/preview", {
        method: "POST",
        body: data
      });

      const name = file.name.replace(/\\.[^.]+$/, "");
      filename = name + "-brother-studio.png";
    }

    if (!response.ok) {
      throw new Error("Image export failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    status.textContent = "PNG export ready: " + filename;

  } catch (error) {
    status.textContent = "Export failed: " + error.message;
  } finally {
    exportButton.disabled =
      !(historyImage || input.files[0]);
  }
}

document.getElementById("exportPNG")
  .addEventListener("click", exportArtworkPNG);


/* Brother Studio — Reset Adjustments */

function resetAllAdjustments() {
  processingMethod.value = "threshold";
  printOrientation.value = "0";

  // Reset the existing precision controls.
  setContrast(1.0);
  setThreshold(128);
  setLineSpacing(6, false);
  setBackgroundCutoff(180, false);

  syncMethodControls();

  // Return to the processed preview.
  previewMode = "processed";
  displayPreview();

  // Refresh the processed image using default settings.
  updatePreview();
}

document.getElementById("resetAdjustments")
  .addEventListener("click", resetAllAdjustments);


// Brother Studio — reversible Crop / Position editor

const cropDialog = document.getElementById("cropDialog");
const cropStage = document.getElementById("cropStage");
const cropImage = document.getElementById("cropImage");
const cropFrame = document.getElementById("cropFrame");

let cropFrameWidth = 0;
let cropFrameHeight = 0;
let cropScale = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropLastX = 0;
let cropLastY = 0;

function cropMinimumScale() {
  return Math.max(
    cropFrameWidth / cropImage.naturalWidth,
    cropFrameHeight / cropImage.naturalHeight
  );
}

function constrainCrop() {
  if (!cropImage.naturalWidth || !cropImage.naturalHeight) return;

  const minimum = cropMinimumScale();
  cropScale = Math.max(minimum, Math.min(cropScale, minimum * 40));

  const extraX = Math.max(
    0, (cropImage.naturalWidth * cropScale - cropFrameWidth) / 2
  );
  const extraY = Math.max(
    0, (cropImage.naturalHeight * cropScale - cropFrameHeight) / 2
  );

  cropOffsetX = Math.max(-extraX, Math.min(extraX, cropOffsetX));
  cropOffsetY = Math.max(-extraY, Math.min(extraY, cropOffsetY));
}

function renderCrop() {
  constrainCrop();

  const width = cropImage.naturalWidth * cropScale;
  const height = cropImage.naturalHeight * cropScale;

  cropImage.style.width = width + "px";
  cropImage.style.height = height + "px";
  cropImage.style.left =
    (cropStage.clientWidth - width) / 2 + cropOffsetX + "px";
  cropImage.style.top =
    (cropStage.clientHeight - height) / 2 + cropOffsetY + "px";

  cropFrame.style.width = cropFrameWidth + "px";
  cropFrame.style.height = cropFrameHeight + "px";
}

function resetCropFrame() {
  const naturalWidth = cropImage.naturalWidth;
  const naturalHeight = cropImage.naturalHeight;
  if (!naturalWidth || !naturalHeight) return;

  const maximumWidth = cropStage.clientWidth * 0.82;
  const maximumHeight = cropStage.clientHeight * 0.82;
  const ratio = naturalHeight / naturalWidth;

  cropFrameWidth = Math.min(maximumWidth, maximumHeight / ratio);
  cropFrameHeight = cropFrameWidth * ratio;

  cropScale = cropFrameWidth / naturalWidth;
  cropOffsetX = 0;
  cropOffsetY = 0;

  renderCrop();
}

function initializeCropFrame() {
  if (!cropImage.naturalWidth || !cropImage.naturalHeight) return;

  if (!appliedCrop) {
    resetCropFrame();
    return;
  }

  const [x, y, w, h] = appliedCrop;
  const ratio =
    (h * cropImage.naturalHeight) / (w * cropImage.naturalWidth);

  cropFrameWidth = Math.min(
    cropStage.clientWidth * 0.82,
    cropStage.clientHeight * 0.82 / ratio
  );
  cropFrameHeight = cropFrameWidth * ratio;

  cropScale = cropFrameWidth / (w * cropImage.naturalWidth);

  cropOffsetX =
    (0.5 - x - w / 2) * cropImage.naturalWidth * cropScale;
  cropOffsetY =
    (0.5 - y - h / 2) * cropImage.naturalHeight * cropScale;

  renderCrop();
}

function openCropEditor() {
  if (!imageURL || historyImage) return;

  cropDialog.showModal();

  // Reloading from the original keeps all cropping reversible.
  cropImage.onload = initializeCropFrame;
  cropImage.src = imageURL;

  if (cropImage.complete && cropImage.naturalWidth) {
    initializeCropFrame();
  }
}

function zoomCrop(factor) {
  cropScale *= factor;
  renderCrop();
}

function changeCropWidth(factor) {
  cropFrameWidth = Math.max(
    30,
    Math.min(cropStage.clientWidth * 0.88, cropFrameWidth * factor)
  );
  renderCrop();
}

function changeCropHeight(factor) {
  cropFrameHeight = Math.max(
    30,
    Math.min(cropStage.clientHeight * 0.88, cropFrameHeight * factor)
  );
  renderCrop();
}

function readCropCoordinates() {
  const imageWidth = cropImage.naturalWidth * cropScale;
  const imageHeight = cropImage.naturalHeight * cropScale;

  const imageLeft =
    (cropStage.clientWidth - imageWidth) / 2 + cropOffsetX;
  const imageTop =
    (cropStage.clientHeight - imageHeight) / 2 + cropOffsetY;

  const frameLeft = (cropStage.clientWidth - cropFrameWidth) / 2;
  const frameTop = (cropStage.clientHeight - cropFrameHeight) / 2;

  const x = (frameLeft - imageLeft) / imageWidth;
  const y = (frameTop - imageTop) / imageHeight;
  const w = cropFrameWidth / imageWidth;
  const h = cropFrameHeight / imageHeight;

  // Account for harmless floating-point rounding at image edges.
  const clamp = value => Math.max(0, Math.min(1, value));
  const left = clamp(x);
  const top = clamp(y);
  const right = clamp(x + w);
  const bottom = clamp(y + h);

  if (right - left < 0.001 || bottom - top < 0.001) {
    throw new Error("Crop area is too small.");
  }

  if (
    left < 0.000001 && top < 0.000001 &&
    right > 0.999999 && bottom > 0.999999
  ) {
    return null;
  }

  return [left, top, right - left, bottom - top];
}

document.getElementById("openCrop")
  .addEventListener("click", openCropEditor);

document.getElementById("cropCancel")
  .addEventListener("click", () => cropDialog.close());

document.getElementById("cropReset")
  .addEventListener("click", resetCropFrame);

document.getElementById("cropZoomIn")
  .addEventListener("click", () => zoomCrop(1.2));

document.getElementById("cropZoomOut")
  .addEventListener("click", () => zoomCrop(1 / 1.2));

document.getElementById("cropNarrower")
  .addEventListener("click", () => changeCropWidth(1 / 1.15));

document.getElementById("cropWider")
  .addEventListener("click", () => changeCropWidth(1.15));

document.getElementById("cropShorter")
  .addEventListener("click", () => changeCropHeight(1 / 1.15));

document.getElementById("cropTaller")
  .addEventListener("click", () => changeCropHeight(1.15));

document.getElementById("cropApply").addEventListener("click", () => {
  try {
    appliedCrop = readCropCoordinates();
    cropDialog.close();
    previewMode = "processed";
    displayPreview();
    updatePreview();
  } catch (error) {
    status.textContent = error.message;
  }
});

cropStage.addEventListener("wheel", event => {
  event.preventDefault();
  zoomCrop(event.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

cropStage.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  cropDragging = true;
  cropLastX = event.clientX;
  cropLastY = event.clientY;
  cropStage.setPointerCapture(event.pointerId);
  cropStage.classList.add("dragging");
});

cropStage.addEventListener("pointermove", event => {
  if (!cropDragging) return;

  cropOffsetX += event.clientX - cropLastX;
  cropOffsetY += event.clientY - cropLastY;

  cropLastX = event.clientX;
  cropLastY = event.clientY;

  renderCrop();
});

function endCropDrag() {
  cropDragging = false;
  cropStage.classList.remove("dragging");
}

cropStage.addEventListener("pointerup", endCropDrag);
cropStage.addEventListener("pointercancel", endCropDrag);
cropStage.addEventListener("lostpointercapture", endCropDrag);
cropDialog.addEventListener("close", endCropDrag);
