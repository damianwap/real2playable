import Phaser from "phaser";
import {
  decodeImage,
  interpolate,
  MAX_ZIP_BYTES,
  validatePackage,
  type Check,
  type Package,
} from "./package";
import "./style.css";

const stage = document.querySelector<HTMLElement>("#stage")!;
const gameHost = document.querySelector<HTMLElement>("#game")!;
const empty = document.querySelector<HTMLElement>("#scene-empty")!;
const drop = document.querySelector<HTMLLabelElement>("#drop-zone")!;
const fileInput = document.querySelector<HTMLInputElement>("#zip-file")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const restart = document.querySelector<HTMLButtonElement>("#restart")!;
const motionSelect = document.querySelector<HTMLSelectElement>("#motion")!;
const scrub = document.querySelector<HTMLInputElement>("#scrub")!;
const anchor = document.querySelector<HTMLInputElement>("#anchor")!;
const grid = document.querySelector<HTMLInputElement>("#grid")!;
const report = document.querySelector<HTMLElement>("#report")!;
const errorReport = document.querySelector<HTMLElement>("#error")!;
const sceneStatus = document.querySelector<HTMLElement>("#scene-status")!;
const sceneScale = document.querySelector<HTMLElement>("#scene-scale")!;
const timeOutput = document.querySelector<HTMLOutputElement>("#time")!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let current: Package | null = null;
let elapsed = 0;
let playing = false;
let generation = 0;
let fetchController: AbortController | null = null;
let scene: PreviewScene | null = null;
let game: Phaser.Game | null = null;
let gameReady: Promise<PreviewScene> | null = null;
let textureNumber = 0;
const passed = new Set<Check>();

class PreviewScene extends Phaser.Scene {
  private image: Phaser.GameObjects.Image | null = null;
  private lines!: Phaser.GameObjects.Graphics;
  private originMark!: Phaser.GameObjects.Graphics;
  private textureKey: string | null = null;
  private gridWidth = -1;
  private gridHeight = -1;
  private gridVisible: boolean | null = null;
  onReady: ((scene: PreviewScene) => void) | null = null;
  constructor() {
    super("independent-preview");
  }
  create(): void {
    this.lines = this.add.graphics().setDepth(0);
    this.originMark = this.add.graphics().setDepth(2);
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.renderFrame());
    this.onReady?.(this);
  }
  showImage(image: HTMLImageElement): void {
    this.clearImage();
    this.textureKey = `export-sprite-${++textureNumber}`;
    this.textures.addImage(this.textureKey, image);
    this.image = this.add.image(0, 0, this.textureKey).setDepth(1);
    this.renderFrame();
  }
  clearImage(): void {
    this.image?.destroy();
    this.image = null;
    if (this.textureKey) this.textures.remove(this.textureKey);
    this.textureKey = null;
    this.originMark?.clear();
  }
  update(_time: number, delta: number): void {
    const motion = current?.states[motionSelect.value];
    if (playing && motion) {
      elapsed += delta;
      if (elapsed >= motion.duration_ms) {
        if (motion.loop) elapsed %= motion.duration_ms;
        else {
          elapsed = motion.duration_ms;
          playing = false;
          updatePlayback();
        }
      }
      updateTimeline();
      this.renderFrame();
    }
  }
  renderFrame(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (
      width !== this.gridWidth ||
      height !== this.gridHeight ||
      grid.checked !== this.gridVisible
    ) {
      this.gridWidth = width;
      this.gridHeight = height;
      this.gridVisible = grid.checked;
      this.lines.clear();
      if (grid.checked) {
        this.lines.lineStyle(1, 0xdedbe9, 0.55);
        for (let x = (width / 2) % 32; x < width; x += 32)
          this.lines.lineBetween(x, 0, x, height);
        for (let y = (height / 2) % 32; y < height; y += 32)
          this.lines.lineBetween(0, y, width, y);
      }
    }
    this.originMark.clear();
    if (!current || !this.image) return;
    const sprite = current.asset.sprite;
    const baseScale = Math.max(
      0.05,
      Math.min((width - 80) / sprite.width, (height - 64) / sprite.height, 0.8),
    );
    const bounds = sprite.visual_bounds;
    const baseX =
      width / 2 -
      (bounds.x + bounds.width / 2 - sprite.origin.x * sprite.width) *
        baseScale;
    const baseY =
      height / 2 -
      (bounds.y + bounds.height / 2 - sprite.origin.y * sprite.height) *
        baseScale;
    const motion = current.states[motionSelect.value];
    const frame = motion ? interpolate(motion, elapsed) : null;
    const x = baseX + (frame?.translate[0] ?? 0) * baseScale;
    const y = baseY + (frame?.translate[1] ?? 0) * baseScale;
    this.image
      .setOrigin(sprite.origin.x, sprite.origin.y)
      .setPosition(x, y)
      .setScale(
        baseScale * (frame?.scale[0] ?? 1),
        baseScale * (frame?.scale[1] ?? 1),
      )
      .setAngle(frame?.rotation_deg ?? 0)
      .setAlpha(frame?.opacity ?? 1);
    if (anchor.checked) {
      this.originMark.lineStyle(2, 0x7660d5, 1);
      this.originMark.strokeCircle(x, y, 5);
      this.originMark.lineBetween(x - 12, y, x + 12, y);
      this.originMark.lineBetween(x, y - 12, x, y + 12);
    }
    sceneScale.textContent = `${Math.round(baseScale * 100)}% display scale`;
  }
}

function updatePlayback(): void {
  play.textContent = playing ? "Pause" : "Play";
  play.setAttribute(
    "aria-label",
    playing ? "Pause procedural motion" : "Play procedural motion",
  );
  const motion = current?.states[motionSelect.value];
  sceneStatus.textContent = current
    ? motion
      ? `${playing ? "Playing" : "Paused"} · ${motionSelect.value.replaceAll("_", " ")}`
      : "Static sprite"
    : "Waiting for a package";
}
function updateTimeline(): void {
  const duration = current?.states[motionSelect.value]?.duration_ms ?? 0;
  scrub.value = String(duration ? (elapsed / duration) * 1000 : 0);
  timeOutput.value = `${Math.round(elapsed)} / ${duration} ms`;
  scrub.setAttribute(
    "aria-valuetext",
    `${Math.round(elapsed)} of ${duration} milliseconds`,
  );
}
function checkPassed(check: Check): void {
  passed.add(check);
  const row = document.querySelector<HTMLElement>(`[data-check="${check}"]`)!;
  row.classList.add("passed");
  row.querySelector(".check-mark")!.textContent = "✓";
  document.querySelector("#verification-count")!.textContent =
    `${passed.size} / 4`;
}
function setBusy(message: string): void {
  report.textContent = message;
  report.classList.remove("valid");
  errorReport.hidden = true;
  drop.classList.add("busy");
  stage.setAttribute("aria-busy", "true");
}
function resetImport(): void {
  playing = false;
  current = null;
  elapsed = 0;
  scene?.clearImage();
  empty.hidden = false;
  sceneScale.hidden = true;
  passed.clear();
  document.querySelectorAll(".checks li").forEach((row) => {
    row.classList.remove("passed");
    row.querySelector(".check-mark")!.textContent = "·";
  });
  document.querySelector("#verification-count")!.textContent = "0 / 4";
  motionSelect.replaceChildren(new Option("Static sprite", ""));
  [play, restart, motionSelect, scrub].forEach((control) => {
    control.disabled = true;
  });
  document.querySelector("#inventory")!.className = "inventory-empty";
  document.querySelector("#inventory")!.textContent =
    "Your verified file inventory will appear here.";
  document.querySelector("#file-count")!.textContent = "No package loaded";
  document.querySelector("#package-summary")!.textContent =
    "Only the exported files. Nothing from the generator’s private storage.";
  document.querySelector<HTMLElement>("#asset-details")!.hidden = true;
  document.querySelector<HTMLElement>("#package-warnings")!.hidden = true;
  updatePlayback();
  updateTimeline();
}
function showError(error: unknown): void {
  playing = false;
  current = null;
  scene?.clearImage();
  empty.hidden = false;
  sceneScale.hidden = true;
  [play, restart, motionSelect, scrub].forEach((control) => {
    control.disabled = true;
  });
  drop.classList.remove("busy");
  stage.removeAttribute("aria-busy");
  sceneStatus.textContent = "Package not loaded";
  report.classList.remove("valid");
  report.textContent =
    "Package could not be loaded. Nothing from this ZIP is playing.";
  errorReport.textContent =
    error instanceof Error
      ? error.message
      : "The package could not be opened. Export it again and choose the new ZIP.";
  errorReport.hidden = false;
}
function renderInventory(pkg: Package): void {
  const inventory = document.querySelector<HTMLElement>("#inventory")!;
  inventory.className = "inventory-table";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.className = "sr-only";
  caption.textContent = "Exported ZIP files and verified SHA-256 digests";
  table.append(caption);
  const head = table.createTHead().insertRow();
  for (const label of ["File", "Size", "SHA-256"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  const files = [
    ...pkg.files,
    {
      path: "manifest.json",
      bytes: pkg.entries["manifest.json"].length,
      sha256: "",
      mime: "application/json",
    },
  ];
  for (const file of files) {
    const row = body.insertRow();
    row.insertCell().textContent = file.path;
    row.insertCell().textContent =
      file.bytes < 1024
        ? `${file.bytes} B`
        : `${(file.bytes / 1024).toFixed(1)} KB`;
    const digest = row.insertCell();
    if (file.sha256) {
      digest.textContent = `✓ ${file.sha256.slice(0, 12)}…`;
      digest.title = file.sha256;
      digest.className = "verified-hash";
    } else {
      digest.textContent = "Manifest (not self-hashed)";
      digest.className = "quiet";
    }
  }
  inventory.replaceChildren(table);
  document.querySelector("#file-count")!.textContent =
    `${files.length} files · ${(pkg.compressedBytes / 1024).toFixed(1)} KB ZIP`;
  document.querySelector("#package-summary")!.textContent =
    `${pkg.asset.name} · ${pkg.asset.sprite.width} × ${pkg.asset.sprite.height} PNG · schema ${pkg.asset.schema_version}`;
  const details = document.querySelector<HTMLElement>("#asset-details")!;
  details.hidden = false;
  const origin = pkg.asset.sprite.origin;
  const bounds = pkg.asset.sprite.visual_bounds;
  details.replaceChildren();
  for (const [label, value] of [
    ["Origin", `${origin.x}, ${origin.y}`],
    [
      "Visual bounds",
      `${bounds.x}, ${bounds.y} / ${bounds.width} × ${bounds.height}`,
    ],
    ["Source", pkg.asset.source.kind.replaceAll("_", " ")],
    [
      "Provenance",
      [...new Set(pkg.stages.map((item) => item.mode))].join(", ") ||
        "No stages recorded",
    ],
  ]) {
    const detail = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value;
    detail.append(name, content);
    details.append(detail);
  }
  const warnings = document.querySelector<HTMLElement>("#package-warnings")!;
  warnings.replaceChildren();
  warnings.hidden = pkg.warnings.length === 0;
  if (pkg.warnings.length) {
    const heading = document.createElement("strong");
    heading.textContent = "Compiler notes";
    warnings.append(heading);
    const list = document.createElement("ul");
    for (const warning of pkg.warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    }
    warnings.append(list);
  }
}
async function getScene(): Promise<PreviewScene> {
  if (gameReady) return gameReady;
  gameReady = new Promise<PreviewScene>((resolve, reject) => {
    const instance = new PreviewScene();
    instance.onReady = resolve;
    try {
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: gameHost,
        width: Math.max(1, stage.clientWidth),
        height: Math.max(1, stage.clientHeight),
        transparent: true,
        render: { antialias: true },
        audio: { noAudio: true },
        scene: instance,
        banner: false,
      });
      game.canvas.setAttribute("aria-hidden", "true");
      const observer = new ResizeObserver(() => {
        game?.scale.resize(
          Math.max(1, stage.clientWidth),
          Math.max(1, stage.clientHeight),
        );
      });
      observer.observe(stage);
    } catch (error) {
      reject(error);
    }
  });
  try {
    return await gameReady;
  } catch (error) {
    gameReady = null;
    game?.destroy(true);
    game = null;
    throw new Error(
      `Phaser could not start. Enable browser canvas support and reload. ${error instanceof Error ? error.message : ""}`,
    );
  }
}
async function loadBytes(
  bytes: Uint8Array,
  name: string,
  operation: number,
): Promise<void> {
  const pkg = await validatePackage(bytes, (check) => {
    if (operation === generation) checkPassed(check);
  });
  if (operation !== generation) return;
  report.textContent = "Contract verified. Decoding the sprite into Phaser…";
  const image = await decodeImage(pkg.entries["sprite.png"], "image/png");
  if (operation !== generation) return;
  const readyScene = await getScene();
  if (operation !== generation) return;
  scene = readyScene;
  current = pkg;
  scene.showImage(image);
  checkPassed("engine");
  empty.hidden = true;
  sceneScale.hidden = false;
  stage.setAttribute(
    "aria-label",
    `${pkg.asset.name}, loaded from a verified ZIP in Phaser. Space plays or pauses, R restarts, G toggles grid, A toggles origin.`,
  );
  for (const state of Object.keys(pkg.states))
    motionSelect.add(new Option(state.replaceAll("_", " "), state));
  motionSelect.disabled = false;
  restart.disabled = false;
  elapsed = 0;
  updatePlayback();
  updateTimeline();
  renderInventory(pkg);
  report.classList.add("valid");
  report.textContent = `${name} is valid. All file hashes match. The extracted sprite is rendering in Phaser; choose a motion state to play.`;
  drop.classList.remove("busy");
  stage.removeAttribute("aria-busy");
}
async function openFile(file: File): Promise<void> {
  fetchController?.abort();
  const operation = ++generation;
  resetImport();
  setBusy(`Checking ${file.name} locally…`);
  try {
    if (!file.name.toLowerCase().endsWith(".zip"))
      throw new Error("Choose a .zip export, not a single image or JSON file.");
    if (file.size > MAX_ZIP_BYTES)
      throw new Error(
        "This ZIP exceeds the 20 MB compressed limit. Export a smaller package.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (operation === generation) await loadBytes(bytes, file.name, operation);
  } catch (error) {
    if (operation === generation) showError(error);
  } finally {
    fileInput.value = "";
  }
}
async function openAsset(id: string): Promise<void> {
  const operation = ++generation;
  resetImport();
  setBusy("Fetching the exported ZIP. No private generator data is used…");
  fetchController = new AbortController();
  const controller = fetchController;
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
      throw new Error(
        "The asset link contains an invalid ID. Open a fresh playground link or choose an export ZIP.",
      );
    const response = await fetch(
      `/api/v1/assets/${encodeURIComponent(id)}/export`,
      { signal: controller.signal },
    );
    if (!response.ok)
      throw new Error(
        `The export could not be fetched (HTTP ${response.status}). Return to the workspace and export again, or open a local ZIP.`,
      );
    const declaredLength = Number(response.headers.get("content-length"));
    if (declaredLength > MAX_ZIP_BYTES)
      throw new Error(
        "The exported ZIP exceeds the 20 MB limit. Choose a smaller package.",
      );
    if (!response.body)
      throw new Error(
        "The export response had no ZIP body. Download the ZIP from the workspace and open it here.",
      );
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > MAX_ZIP_BYTES) {
          await reader.cancel();
          throw new Error(
            "The exported ZIP exceeds the 20 MB limit. Choose a smaller package.",
          );
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    if (operation !== generation) return;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    await loadBytes(bytes, "Export package", operation);
  } catch (error) {
    if (operation === generation) {
      if (error instanceof DOMException && error.name === "AbortError")
        showError(
          new Error(
            "The export request timed out. Check the API connection or open a downloaded ZIP; offline imports need no backend.",
          ),
        );
      else if (error instanceof TypeError)
        showError(
          new Error(
            "The exported ZIP could not be reached. Check that the API is running, reopen the link, or choose a downloaded ZIP to work offline.",
          ),
        );
      else showError(error);
    }
  } finally {
    window.clearTimeout(timer);
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void openFile(file);
});
let dragDepth = 0;
drop.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth++;
  drop.classList.add("drag-over");
});
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});
drop.addEventListener("dragleave", (event) => {
  event.preventDefault();
  if (--dragDepth <= 0) {
    dragDepth = 0;
    drop.classList.remove("drag-over");
  }
});
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  drop.classList.remove("drag-over");
  const files = event.dataTransfer?.files;
  if (files?.length === 1) void openFile(files[0]);
  else if (files?.length) {
    generation++;
    fetchController?.abort();
    resetImport();
    showError(
      new Error("Open one export ZIP at a time. Drop a single .zip file."),
    );
  }
});
window.addEventListener("dragover", (event) => {
  event.preventDefault();
});
window.addEventListener("drop", (event) => {
  event.preventDefault();
});
play.addEventListener("click", () => {
  const motion = current?.states[motionSelect.value];
  if (!motion) return;
  if (!playing && elapsed >= motion.duration_ms) elapsed = 0;
  playing = !playing;
  updatePlayback();
});
restart.addEventListener("click", () => {
  elapsed = 0;
  updateTimeline();
  scene?.renderFrame();
});
motionSelect.addEventListener("change", () => {
  const motion = current?.states[motionSelect.value];
  elapsed = 0;
  playing = Boolean(motion) && !reducedMotion.matches && !document.hidden;
  play.disabled = !motion;
  scrub.disabled = !motion;
  updatePlayback();
  updateTimeline();
  scene?.renderFrame();
});
scrub.addEventListener("input", () => {
  const duration = current?.states[motionSelect.value]?.duration_ms ?? 0;
  elapsed = (Number(scrub.value) / 1000) * duration;
  playing = false;
  updateTimeline();
  updatePlayback();
  scene?.renderFrame();
});
anchor.addEventListener("change", () => scene?.renderFrame());
grid.addEventListener("change", () => scene?.renderFrame());
stage.addEventListener("keydown", (event) => {
  if (event.target !== stage || event.altKey || event.ctrlKey || event.metaKey)
    return;
  if (event.code === "Space" && !play.disabled) {
    event.preventDefault();
    play.click();
  } else if (event.key.toLowerCase() === "r" && !restart.disabled) {
    event.preventDefault();
    restart.click();
  } else if (event.key.toLowerCase() === "g") {
    grid.checked = !grid.checked;
    grid.dispatchEvent(new Event("change"));
  } else if (event.key.toLowerCase() === "a") {
    anchor.checked = !anchor.checked;
    anchor.dispatchEvent(new Event("change"));
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    updatePlayback();
  }
});
reducedMotion.addEventListener("change", (event) => {
  if (event.matches) {
    playing = false;
    updatePlayback();
  }
});
const assetId = new URLSearchParams(window.location.search).get("asset");
if (assetId !== null) void openAsset(assetId);
