import JSZip from "jszip";

declare global {
  interface Window {
    kengiriVscode?: {
      postMessage(message: unknown): void;
    };
    kengiriAssets?: {
      logoUri?: string;
    };
  }
}

type PlatformKey = "apple" | "android" | "androidTv" | "web";
type DrawMode = "cover" | "contain";
const DEFAULT_ZIP_BASE_NAME = "kengiri-app-icon";
const HELP_REPOSITORY_URL = "https://github.com/oguzhan18/kengiri-icon";

interface RasterJob {
  path: string;
  width: number;
  height: number;
  mode?: DrawMode;
}

interface TextJob {
  path: string;
  content: string;
}

interface GenerationPlan {
  rasterJobs: RasterJob[];
  textJobs: TextJob[];
}

interface AppleImageEntry {
  size: string;
  idiom: string;
  filename: string;
  scale: string;
  platform?: string;
  role?: string;
  subtype?: string;
}

const vscodeApi = window.kengiriVscode;
const logoUri = window.kengiriAssets?.logoUri ?? "";

const app = document.getElementById("app");
if (!app) {
  throw new Error("App container not found.");
}

app.innerHTML = `
  <main class="desktop-shell animate-fade-up">
    <header class="window-titlebar">
      <div class="title-wrap">
        <div class="title-row">
          ${logoUri ? `<img src="${logoUri}" alt="Kengiri Logo" class="title-logo" />` : ""}
          <div>
            <h1>Kengiri Icon Generator</h1>
            <p>Desktop icon packaging tool for Apple, Android, TV and Web targets.</p>
          </div>
        </div>
      </div>
      <div class="status-chip" id="statusChip">READY</div>
    </header>

    <nav class="menu-bar">
      <button type="button" class="menu-item" id="menuFileButton" title="Open source image">File</button>
      <button type="button" class="menu-item" id="menuEditButton" title="Reset form and preview">Edit</button>
      <button type="button" class="menu-item" id="menuBuildButton" title="Generate icon package">Build</button>
      <button type="button" class="menu-item" id="menuToolsButton" title="Toggle platform presets">Tools</button>
      <button type="button" class="menu-item" id="menuHelpButton" title="Open GitHub repository">Help</button>
    </nav>

    <div class="tool-strip">
      <button type="button" class="tool-btn" id="toolbarOpenButton">Open Image</button>
      <button type="button" class="tool-btn" id="toolbarGenerateButton">Generate Package</button>
      <div class="tool-strip-note">Select source artwork, choose platform sets, then build ZIP output.</div>
    </div>

    <section class="workspace-grid">
      <section class="pane">
        <div class="pane-header">Build Configuration</div>
        <div class="pane-body">
          <section class="groupbox">
            <div class="groupbox-label">Source Artwork</div>
            <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
            <button id="dropZone" type="button" class="drop-zone">
              <span class="drop-zone-primary">Click or drop image here</span>
              <span class="drop-zone-secondary">Recommended: square 1024x1024 PNG</span>
            </button>
          </section>

          <section class="groupbox">
            <div class="groupbox-label">Package Names</div>
            <div class="field-grid">
              <label class="field">
                <span class="field-label">Android Base Name</span>
                <input id="iconNameInput" type="text" value="ic_launcher" class="desktop-input" />
              </label>
              <label class="field">
                <span class="field-label">ZIP Name</span>
                <input id="zipNameInput" type="text" value="${DEFAULT_ZIP_BASE_NAME}" class="desktop-input" />
              </label>
            </div>
          </section>

          <section class="groupbox">
            <div class="groupbox-label">Target Platforms</div>
            <div class="platform-grid">
              <label class="platform-item active" data-platform-item="apple">
                <input id="platformApple" data-platform="apple" type="checkbox" checked />
                <span>
                  <strong>Apple Pack</strong>
                  <small>iPhone, iPad, watchOS, macOS AppIcon set</small>
                </span>
              </label>
              <label class="platform-item active" data-platform-item="android">
                <input id="platformAndroid" data-platform="android" type="checkbox" checked />
                <span>
                  <strong>Android</strong>
                  <small>mipmap density folders + Play Store icon</small>
                </span>
              </label>
              <label class="platform-item active" data-platform-item="androidTv">
                <input id="platformAndroidTv" data-platform="androidTv" type="checkbox" checked />
                <span>
                  <strong>Android TV</strong>
                  <small>launcher icons + 320x180 TV banner</small>
                </span>
              </label>
              <label class="platform-item active" data-platform-item="web">
                <input id="platformWeb" data-platform="web" type="checkbox" checked />
                <span>
                  <strong>Web / PWA</strong>
                  <small>manifest-ready icon files</small>
                </span>
              </label>
            </div>
          </section>

          <div class="action-bar">
            <button id="generateButton" type="button" class="btn-primary">
              Generate Icon Package
            </button>
          </div>
        </div>
      </section>

      <aside class="pane">
        <div class="pane-header">Preview and Output</div>
        <div class="pane-body">
          <section class="groupbox">
            <div class="groupbox-label groupbox-title-row">
              <span>Source Preview</span>
              <span id="dimensionText">No image</span>
            </div>
            <div class="preview-surface">
              <img id="previewImage" alt="Preview" class="hidden preview-image" />
              <p id="previewPlaceholder" class="preview-placeholder">Image preview will appear here</p>
            </div>
          </section>

          <section class="groupbox">
            <div class="groupbox-label">Build Summary</div>
            <div id="summaryText" class="summary-text">Upload an image to inspect generated files.</div>
            <ul id="filePreviewList" class="summary-list"></ul>
          </section>

          <section class="groupbox">
            <div class="groupbox-label">Status Log</div>
            <p id="statusText" class="status-text">Ready to generate.</p>
          </section>
        </div>
      </aside>
    </section>

    <footer class="status-bar">
      <span>Kengiri Studio Desktop Shell</span>
      <span>Theme-aware light and dark rendering</span>
    </footer>
  </main>
`;

const fileInput = must<HTMLInputElement>("fileInput");
const dropZone = must<HTMLButtonElement>("dropZone");
const menuFileButton = must<HTMLButtonElement>("menuFileButton");
const menuEditButton = must<HTMLButtonElement>("menuEditButton");
const menuBuildButton = must<HTMLButtonElement>("menuBuildButton");
const menuToolsButton = must<HTMLButtonElement>("menuToolsButton");
const menuHelpButton = must<HTMLButtonElement>("menuHelpButton");
const toolbarOpenButton = must<HTMLButtonElement>("toolbarOpenButton");
const toolbarGenerateButton = must<HTMLButtonElement>("toolbarGenerateButton");
const iconNameInput = must<HTMLInputElement>("iconNameInput");
const zipNameInput = must<HTMLInputElement>("zipNameInput");
const generateButton = must<HTMLButtonElement>("generateButton");
const previewImage = must<HTMLImageElement>("previewImage");
const previewPlaceholder = must<HTMLParagraphElement>("previewPlaceholder");
const dimensionText = must<HTMLSpanElement>("dimensionText");
const summaryText = must<HTMLDivElement>("summaryText");
const filePreviewList = must<HTMLUListElement>("filePreviewList");
const statusText = must<HTMLParagraphElement>("statusText");
const statusChip = must<HTMLDivElement>("statusChip");

const platformInputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-platform]"));

const state: {
  sourceImage: HTMLImageElement | null;
  sourceName: string;
  sourceWidth: number;
  sourceHeight: number;
  busy: boolean;
} = {
  sourceImage: null,
  sourceName: "",
  sourceWidth: 0,
  sourceHeight: 0,
  busy: false
};

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }
  return el as T;
}

function selectedPlatforms(): Set<PlatformKey> {
  const values = new Set<PlatformKey>();
  for (const input of platformInputs) {
    if (input.checked) {
      values.add(input.dataset.platform as PlatformKey);
    }
  }
  return values;
}

function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function sanitizeAndroidIconName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "ic_launcher";
}

function setGenerationButtonsDisabled(disabled: boolean): void {
  generateButton.disabled = disabled;
  toolbarGenerateButton.disabled = disabled;
}

function setBusy(value: boolean): void {
  state.busy = value;
  setGenerationButtonsDisabled(value || !state.sourceImage);
  generateButton.textContent = value ? "Generating..." : "Generate Icon Package";
  toolbarGenerateButton.textContent = value ? "Generating..." : "Generate Package";
}

function setStatus(message: string, chip = "Ready"): void {
  statusText.textContent = message;
  statusChip.textContent = chip.toUpperCase();
  statusChip.dataset.state = chip.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function updatePlatformCards(): void {
  for (const input of platformInputs) {
    const item = document.querySelector<HTMLElement>(`[data-platform-item=\"${input.dataset.platform}\"]`);
    if (!item) {
      continue;
    }
    if (input.checked) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  }
}

function refreshPlanPreview(): void {
  updatePlatformCards();
  const platforms = selectedPlatforms();

  if (platforms.size === 0) {
    summaryText.textContent = "Select at least one platform.";
    filePreviewList.innerHTML = "";
    setGenerationButtonsDisabled(true);
    return;
  }

  const iconName = sanitizeAndroidIconName(iconNameInput.value);
  const plan = buildGenerationPlan(platforms, iconName);
  summaryText.textContent = `${plan.rasterJobs.length} PNG files and ${plan.textJobs.length} metadata files will be generated.`;

  const files = [...plan.rasterJobs.map((job) => job.path), ...plan.textJobs.map((job) => job.path)].slice(0, 18);
  filePreviewList.innerHTML = files.map((file) => `<li class=\"summary-file truncate\">${file}</li>`).join("");

  if (!state.busy) {
    setGenerationButtonsDisabled(!state.sourceImage);
  }
}

function resetWorkspace(): void {
  if (state.busy) {
    setStatus("Please wait until current build finishes.", "Working");
    return;
  }

  state.sourceImage = null;
  state.sourceName = "";
  state.sourceWidth = 0;
  state.sourceHeight = 0;

  fileInput.value = "";
  iconNameInput.value = "ic_launcher";
  zipNameInput.value = DEFAULT_ZIP_BASE_NAME;
  dimensionText.textContent = "No image";

  previewImage.src = "";
  previewImage.classList.add("hidden");
  previewPlaceholder.classList.remove("hidden");

  for (const input of platformInputs) {
    input.checked = true;
  }

  setBusy(false);
  refreshPlanPreview();
  setStatus("Workspace reset.", "Ready");
}

function toggleToolsPreset(): void {
  if (state.busy) {
    setStatus("Please wait until current build finishes.", "Working");
    return;
  }

  const allSelected = platformInputs.every((input) => input.checked);
  if (allSelected) {
    for (const input of platformInputs) {
      if (input.dataset.platform === "androidTv") {
        input.checked = false;
      } else {
        input.checked = true;
      }
    }
    setStatus("Tools preset: Mobile focused (Android TV off).", "Ready");
  } else {
    for (const input of platformInputs) {
      input.checked = true;
    }
    setStatus("Tools preset: All platforms enabled.", "Ready");
  }

  refreshPlanPreview();
}

function openHelpRepository(): void {
  if (vscodeApi) {
    vscodeApi.postMessage({
      type: "openExternal",
      url: HELP_REPOSITORY_URL
    });
    return;
  }

  window.open(HELP_REPOSITORY_URL, "_blank", "noopener,noreferrer");
}

function buildGenerationPlan(platforms: Set<PlatformKey>, iconName: string): GenerationPlan {
  const rasterJobs: RasterJob[] = [];
  const textJobs: TextJob[] = [];

  if (platforms.has("apple")) {
    const apple = buildApplePlan();
    rasterJobs.push(...apple.rasterJobs);
    textJobs.push(...apple.textJobs);
  }

  if (platforms.has("android")) {
    const androidDensity: Array<{ folder: string; size: number }> = [
      { folder: "mdpi", size: 48 },
      { folder: "hdpi", size: 72 },
      { folder: "xhdpi", size: 96 },
      { folder: "xxhdpi", size: 144 },
      { folder: "xxxhdpi", size: 192 }
    ];

    for (const density of androidDensity) {
      rasterJobs.push({
        path: `android/mipmap-${density.folder}/${iconName}.png`,
        width: density.size,
        height: density.size,
        mode: "cover"
      });
      rasterJobs.push({
        path: `android/mipmap-${density.folder}/${iconName}_round.png`,
        width: density.size,
        height: density.size,
        mode: "cover"
      });
    }

    rasterJobs.push({
      path: `android/play-store/${iconName}_playstore.png`,
      width: 512,
      height: 512,
      mode: "cover"
    });

    textJobs.push({
      path: "android/README.txt",
      content: [
        "Android icon bundle generated by Kengiri Icon Generator",
        `Base icon name: ${iconName}`,
        "Folders follow mipmap density naming.",
        "Round icons are included as *_round.png."
      ].join("\n")
    });
  }

  if (platforms.has("androidTv")) {
    const tvDensity: Array<{ folder: string; size: number }> = [
      { folder: "mdpi", size: 48 },
      { folder: "hdpi", size: 72 },
      { folder: "xhdpi", size: 96 },
      { folder: "xxhdpi", size: 144 }
    ];

    for (const density of tvDensity) {
      rasterJobs.push({
        path: `android-tv/mipmap-${density.folder}/${iconName}_tv.png`,
        width: density.size,
        height: density.size,
        mode: "cover"
      });
    }

    rasterJobs.push({
      path: "android-tv/drawable-xhdpi/tv_banner.png",
      width: 320,
      height: 180,
      mode: "contain"
    });

    textJobs.push({
      path: "android-tv/README.txt",
      content: [
        "Android TV icon bundle generated by Kengiri Icon Generator",
        "Includes launcher icons and a 320x180 TV banner.",
        "Review banner safe areas before store submission."
      ].join("\n")
    });
  }

  if (platforms.has("web")) {
    rasterJobs.push(
      { path: "web/icons/icon-192.png", width: 192, height: 192, mode: "cover" },
      { path: "web/icons/icon-512.png", width: 512, height: 512, mode: "cover" },
      { path: "web/icons/apple-touch-icon.png", width: 180, height: 180, mode: "cover" }
    );

    textJobs.push({
      path: "web/manifest.webmanifest",
      content: JSON.stringify(
        {
          name: "App",
          short_name: "App",
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png"
            }
          ],
          theme_color: "#0f172a",
          background_color: "#f8fafc",
          display: "standalone"
        },
        null,
        2
      )
    });
  }

  textJobs.push({
    path: "README.txt",
    content: [
      "Generated with Kengiri Icon Generator",
      `Timestamp: ${new Date().toISOString()}`,
      "",
      "Selected platforms:",
      ...Array.from(platforms).map((platform) => `- ${platform}`),
      "",
      "Links:",
      "- GitHub: https://github.com/oguzhan18/kengiri-icon",
      "- LinkedIn: https://www.linkedin.com/in/o%C4%9Fuzhan-%C3%A7art-b73405199/",
      "- Medium: https://medium.com/@oguzhancart1",
      "- Instagram: https://www.instagram.com/oguzhan_cart/"
    ].join("\n")
  });

  return { rasterJobs, textJobs };
}

function buildApplePlan(): GenerationPlan {
  const entries: Array<{
    idiom: string;
    size: number;
    scale: number;
    platform?: string;
    role?: string;
    subtype?: string;
  }> = [
    { idiom: "iphone", size: 20, scale: 2 },
    { idiom: "iphone", size: 20, scale: 3 },
    { idiom: "iphone", size: 29, scale: 2 },
    { idiom: "iphone", size: 29, scale: 3 },
    { idiom: "iphone", size: 40, scale: 2 },
    { idiom: "iphone", size: 40, scale: 3 },
    { idiom: "iphone", size: 60, scale: 2 },
    { idiom: "iphone", size: 60, scale: 3 },

    { idiom: "ipad", size: 20, scale: 1 },
    { idiom: "ipad", size: 20, scale: 2 },
    { idiom: "ipad", size: 29, scale: 1 },
    { idiom: "ipad", size: 29, scale: 2 },
    { idiom: "ipad", size: 40, scale: 1 },
    { idiom: "ipad", size: 40, scale: 2 },
    { idiom: "ipad", size: 76, scale: 1 },
    { idiom: "ipad", size: 76, scale: 2 },
    { idiom: "ipad", size: 83.5, scale: 2 },

    { idiom: "watch", size: 24, scale: 2, role: "notificationCenter", subtype: "38mm", platform: "watchos" },
    { idiom: "watch", size: 27.5, scale: 2, role: "notificationCenter", subtype: "42mm", platform: "watchos" },
    { idiom: "watch", size: 29, scale: 2, role: "companionSettings", platform: "watchos" },
    { idiom: "watch", size: 29, scale: 3, role: "companionSettings", platform: "watchos" },
    { idiom: "watch", size: 40, scale: 2, role: "appLauncher", subtype: "38mm", platform: "watchos" },
    { idiom: "watch", size: 44, scale: 2, role: "appLauncher", subtype: "40mm", platform: "watchos" },
    { idiom: "watch", size: 50, scale: 2, role: "appLauncher", subtype: "44mm", platform: "watchos" },
    { idiom: "watch", size: 86, scale: 2, role: "quickLook", subtype: "38mm", platform: "watchos" },
    { idiom: "watch", size: 98, scale: 2, role: "quickLook", subtype: "42mm", platform: "watchos" },

    { idiom: "watch-marketing", size: 1024, scale: 1, platform: "watchos" },

    { idiom: "mac", size: 16, scale: 1 },
    { idiom: "mac", size: 16, scale: 2 },
    { idiom: "mac", size: 32, scale: 1 },
    { idiom: "mac", size: 32, scale: 2 },
    { idiom: "mac", size: 128, scale: 1 },
    { idiom: "mac", size: 128, scale: 2 },
    { idiom: "mac", size: 256, scale: 1 },
    { idiom: "mac", size: 256, scale: 2 },
    { idiom: "mac", size: 512, scale: 1 },
    { idiom: "mac", size: 512, scale: 2 },

    { idiom: "ios-marketing", size: 1024, scale: 1, platform: "ios" }
  ];

  const prefix = "apple/Assets.xcassets/AppIcon.appiconset";
  const rasterJobs: RasterJob[] = [];
  const contentsImages: AppleImageEntry[] = [];

  for (const entry of entries) {
    const sizeToken = String(entry.size).replace(".", "_");
    const fileName = `${entry.idiom}-${sizeToken}@${entry.scale}x.png`;
    const pixel = Math.round(entry.size * entry.scale);

    rasterJobs.push({
      path: `${prefix}/${fileName}`,
      width: pixel,
      height: pixel,
      mode: "cover"
    });

    const imageEntry: AppleImageEntry = {
      size: `${entry.size}x${entry.size}`,
      idiom: entry.idiom,
      filename: fileName,
      scale: `${entry.scale}x`
    };

    if (entry.platform) {
      imageEntry.platform = entry.platform;
    }
    if (entry.role) {
      imageEntry.role = entry.role;
    }
    if (entry.subtype) {
      imageEntry.subtype = entry.subtype;
    }

    contentsImages.push(imageEntry);
  }

  const contentsJson = {
    images: contentsImages,
    info: {
      version: 1,
      author: "xcode"
    }
  };

  const textJobs: TextJob[] = [
    {
      path: `${prefix}/Contents.json`,
      content: JSON.stringify(contentsJson, null, 2)
    }
  ];

  return { rasterJobs, textJobs };
}

async function loadImage(file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    setStatus("Please upload a valid image file.", "Invalid");
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await imageFromDataUrl(dataUrl);

  state.sourceImage = img;
  state.sourceName = file.name;
  state.sourceWidth = img.width;
  state.sourceHeight = img.height;

  previewImage.src = dataUrl;
  previewImage.classList.remove("hidden");
  previewPlaceholder.classList.add("hidden");

  dimensionText.textContent = `${img.width} x ${img.height}`;

  const sourceBase = sanitizeName(file.name, DEFAULT_ZIP_BASE_NAME);
  zipNameInput.value = `${sourceBase}-icons`;

  if (img.width < 1024 || img.height < 1024) {
    setStatus("Image loaded. Tip: use at least 1024x1024 for crisp outputs.", "Warning");
  } else {
    setStatus("Image loaded and ready for generation.", "Loaded");
  }

  refreshPlanPreview();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function imageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
}

async function rasterToPng(image: HTMLImageElement, job: RasterJob): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not start canvas renderer.");
  }

  context.clearRect(0, 0, job.width, job.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const mode = job.mode ?? "cover";
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const scale = mode === "contain"
    ? Math.min(job.width / sourceWidth, job.height / sourceHeight)
    : Math.max(job.width / sourceWidth, job.height / sourceHeight);

  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = (job.width - drawWidth) / 2;
  const dy = (job.height - drawHeight) / 2;

  context.drawImage(image, dx, dy, drawWidth, drawHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode PNG output."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function bufferToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function generatePackage(): Promise<void> {
  if (!state.sourceImage) {
    setStatus("Upload an image first.", "Missing");
    return;
  }

  const platforms = selectedPlatforms();
  if (platforms.size === 0) {
    setStatus("Select at least one platform.", "Missing");
    return;
  }

  if (!vscodeApi) {
    setStatus("VS Code API not available in this webview.", "Error");
    return;
  }

  const iconName = sanitizeAndroidIconName(iconNameInput.value);
  const zipName = `${sanitizeName(zipNameInput.value, DEFAULT_ZIP_BASE_NAME)}.zip`;

  const plan = buildGenerationPlan(platforms, iconName);
  setBusy(true);
  setStatus("Generating icon files...", "Working");

  try {
    const zip = new JSZip();

    for (let index = 0; index < plan.rasterJobs.length; index += 1) {
      const job = plan.rasterJobs[index];
      const png = await rasterToPng(state.sourceImage, job);
      const bytes = new Uint8Array(await png.arrayBuffer());
      zip.file(job.path, bytes);

      if ((index + 1) % 8 === 0 || index + 1 === plan.rasterJobs.length) {
        setStatus(`Rasterized ${index + 1}/${plan.rasterJobs.length} icons...`, "Working");
      }
    }

    for (const textFile of plan.textJobs) {
      zip.file(textFile.path, textFile.content);
    }

    setStatus("Compressing package...", "Working");

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    const base64 = bufferToBase64(new Uint8Array(await zipBlob.arrayBuffer()));

    vscodeApi.postMessage({
      type: "saveZip",
      base64,
      fileName: zipName
    });

    setStatus("Package ready. Select save location in VS Code dialog.", "Save");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Generation failed: ${message}`, "Error");
  } finally {
    setBusy(false);
  }
}

function bindEvents(): void {
  const startGeneration = () => {
    void generatePackage();
  };

  menuFileButton.addEventListener("click", () => fileInput.click());
  menuEditButton.addEventListener("click", () => resetWorkspace());
  menuBuildButton.addEventListener("click", startGeneration);
  menuToolsButton.addEventListener("click", () => toggleToolsPreset());
  menuHelpButton.addEventListener("click", () => openHelpRepository());

  dropZone.addEventListener("click", () => fileInput.click());
  toolbarOpenButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    await loadImage(file);
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drop-zone-active");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drop-zone-active");
  });

  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("drop-zone-active");

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    await loadImage(file);
  });

  generateButton.addEventListener("click", startGeneration);
  toolbarGenerateButton.addEventListener("click", startGeneration);

  for (const input of platformInputs) {
    input.addEventListener("change", refreshPlanPreview);
  }

  iconNameInput.addEventListener("input", refreshPlanPreview);
  zipNameInput.addEventListener("input", () => {
    if (!zipNameInput.value.trim()) {
      zipNameInput.value = DEFAULT_ZIP_BASE_NAME;
    }
  });

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const payload = event.data as { type?: string; path?: string; message?: string };
    if (!payload?.type) {
      return;
    }

    switch (payload.type) {
      case "saveSuccess":
        setStatus(`Saved successfully: ${payload.path ?? ""}`, "Saved");
        break;
      case "saveCanceled":
        setStatus("Save canceled.", "Canceled");
        break;
      case "saveError":
        setStatus(`Save error: ${payload.message ?? "Unknown error"}`, "Error");
        break;
      case "externalOpened":
        setStatus("Help opened in your browser.", "Ready");
        break;
      case "externalOpenError":
        setStatus(`Could not open help link: ${payload.message ?? "Unknown error"}`, "Error");
        break;
      default:
        break;
    }
  });
}

bindEvents();
refreshPlanPreview();
setStatus("Ready to generate.", "Ready");
