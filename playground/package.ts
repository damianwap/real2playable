import { strFromU8, unzipSync } from "fflate";

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const ALLOWED: Record<string, true> = {
  "sprite.png": true,
  "thumbnail.webp": true,
  "asset.json": true,
  "animations.json": true,
  "manifest.json": true,
  "README.md": true,
  "atlas/spritesheet.png": true,
  "atlas/frames.json": true,
};
const REQUIRED = [
  "sprite.png",
  "thumbnail.webp",
  "asset.json",
  "animations.json",
  "manifest.json",
  "README.md",
];
export type Check = "zip" | "hash" | "schema" | "engine";
export interface Keyframe {
  t_ms: number;
  translate: [number, number];
  scale: [number, number];
  rotation_deg: number;
  opacity: number;
}
export interface Motion {
  kind: "transform_timeline";
  loop: boolean;
  duration_ms: number;
  keyframes: Keyframe[];
}
export interface Asset {
  schema_version: string;
  asset_id: string;
  name: string;
  asset_type: string;
  tags: string[];
  style_id: string;
  sprite: {
    file: string;
    width: number;
    height: number;
    origin: { x: number; y: number };
    visual_bounds: { x: number; y: number; width: number; height: number };
  };
  animation_file: string;
  source: { kind: string; source_object_label: string };
}
export interface FileInfo {
  path: string;
  bytes: number;
  sha256: string;
  mime: string;
}
export interface Package {
  asset: Asset;
  states: Record<string, Motion>;
  files: FileInfo[];
  entries: Record<string, Uint8Array>;
  warnings: string[];
  stages: { name: string; mode: string }[];
  compressedBytes: number;
}

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown, label: string): Record<string, unknown> {
  requireThat(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be a JSON object.`,
  );
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 512): string {
  requireThat(
    typeof value === "string" && value.length > 0 && value.length <= max,
    `${label} must be a nonempty string (up to ${max} characters).`,
  );
  return value;
}
function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  requireThat(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max,
    `${label} must be between ${min} and ${max}.`,
  );
  return value;
}
function integer(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  const result = number(value, label, min, max);
  requireThat(Number.isInteger(result), `${label} must be a whole number.`);
  return result;
}
function safePath(path: string): void {
  requireThat(
    !path.includes("\\") &&
      !path.startsWith("/") &&
      !path.split("/").some((part) => !part || part === "." || part === "..") &&
      !/[\u0000-\u001f:]/.test(path),
    `Unsafe ZIP path: ${JSON.stringify(path)}. Re-export using safe relative paths.`,
  );
  requireThat(
    Object.hasOwn(ALLOWED, path),
    `Unexpected ZIP entry: ${path}. Only the core asset files and procedural atlas are accepted; remove extra files and re-export.`,
  );
}
function readJSON(
  entries: Record<string, Uint8Array>,
  path: string,
): Record<string, unknown> {
  requireThat(
    entries[path] && entries[path].length <= 1024 * 1024,
    `${path} is missing or larger than the 1 MB JSON limit.`,
  );
  try {
    return object(JSON.parse(strFromU8(entries[path])), path);
  } catch (error) {
    throw new Error(
      `${path} could not be read: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
}

// Inspect the central directory before allocating decompressed data. unzipSync alone is
// not a size boundary, and a ZIP filename must never become a filesystem path.
function inspectZIP(bytes: Uint8Array): Map<string, number> {
  requireThat(
    bytes.length >= 22 && bytes.length <= MAX_ZIP_BYTES,
    "The ZIP must be between 22 bytes and 20 MB. Choose a smaller Real2Playable export.",
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let pos = bytes.length - 22;
    pos >= Math.max(0, bytes.length - 65557);
    pos--
  ) {
    if (
      view.getUint32(pos, true) === 0x06054b50 &&
      pos + 22 + view.getUint16(pos + 20, true) === bytes.length
    ) {
      end = pos;
      break;
    }
  }
  requireThat(
    end >= 0,
    "This is not a complete ZIP archive. Download or export it again.",
  );
  requireThat(
    view.getUint16(end + 4, true) === 0 && view.getUint16(end + 6, true) === 0,
    "Split ZIP archives are not supported. Export a single ZIP.",
  );
  const count = view.getUint16(end + 10, true);
  const start = view.getUint32(end + 16, true);
  requireThat(
    count >= 6 && count <= 8 && count === view.getUint16(end + 8, true),
    "The ZIP must contain 6 core files, plus the optional 2 atlas files. ZIP64 archives are not supported.",
  );
  requireThat(
    start + view.getUint32(end + 12, true) === end,
    "The ZIP directory is corrupt or uses an unsupported ZIP64 format. Re-export the package.",
  );
  const names = new Map<string, number>();
  let cursor = start;
  let total = 0;
  for (let index = 0; index < count; index++) {
    requireThat(
      cursor + 46 <= end && view.getUint32(cursor, true) === 0x02014b50,
      "The ZIP directory is corrupt. Download the package again.",
    );
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const expanded = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const next =
      cursor +
      46 +
      nameLength +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
    requireThat(
      next <= end && nameLength > 0,
      "A ZIP entry has an invalid filename or directory length.",
    );
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = strFromU8(nameBytes);
    safePath(name);
    requireThat(
      !names.has(name),
      `Duplicate ZIP entry: ${name}. Re-export without duplicate filenames.`,
    );
    requireThat(
      (flags & 1) === 0 && (method === 0 || method === 8),
      `${name} uses encryption or unsupported compression. Export a standard, unencrypted ZIP.`,
    );
    requireThat(
      view.getUint16(cursor + 34, true) === 0,
      "Split ZIP entries are not supported.",
    );
    requireThat(
      ((view.getUint32(cursor + 38, true) >>> 16) & 0xf000) !== 0xa000,
      `Symlinks are not allowed in asset ZIPs: ${name}.`,
    );
    total += expanded;
    requireThat(
      expanded > 0 &&
        total <= MAX_EXPANDED_BYTES &&
        compressed <= MAX_ZIP_BYTES,
      "The expanded ZIP exceeds 64 MB or contains an empty entry. Export a smaller, complete package.",
    );
    if (name.endsWith(".json"))
      requireThat(
        expanded <= 1024 * 1024,
        `${name} exceeds the 1 MB JSON limit.`,
      );
    const local = view.getUint32(cursor + 42, true);
    requireThat(
      local + 30 <= start && view.getUint32(local, true) === 0x04034b50,
      `The local ZIP header for ${name} is corrupt.`,
    );
    const localNameLength = view.getUint16(local + 26, true);
    const dataStart =
      local + 30 + localNameLength + view.getUint16(local + 28, true);
    requireThat(
      dataStart + compressed <= start && localNameLength === nameLength,
      `The ZIP data boundaries for ${name} are invalid.`,
    );
    requireThat(
      strFromU8(bytes.subarray(local + 30, local + 30 + localNameLength)) ===
        name &&
        view.getUint16(local + 8, true) === method &&
        view.getUint16(local + 6, true) === flags,
      `The ZIP headers for ${name} disagree. Re-export the archive.`,
    );
    names.set(name, expanded);
    cursor = next;
  }
  requireThat(cursor === end, "The ZIP contains an invalid directory length.");
  for (const name of REQUIRED)
    requireThat(
      names.has(name),
      `Required file missing: ${name}. Choose a complete Real2Playable export ZIP.`,
    );
  return names;
}

function pair(
  value: unknown,
  label: string,
  min: number,
  max: number,
): [number, number] {
  requireThat(
    Array.isArray(value) && value.length === 2,
    `${label} must contain exactly two numbers.`,
  );
  return [number(value[0], label, min, max), number(value[1], label, min, max)];
}
function point(value: unknown, label: string): { x: number; y: number } {
  const p = object(value, label);
  return {
    x: number(p.x, `${label}.x`, 0, 1),
    y: number(p.y, `${label}.y`, 0, 1),
  };
}
function validateAsset(data: Record<string, unknown>): Asset {
  requireThat(
    data.schema_version === "1.3.0",
    "asset.json schema_version must be 1.3.0. Re-export with the current compiler.",
  );
  for (const key of ["role", "rarity", "attack", "lore"])
    requireThat(
      !(key in data),
      `Gameplay field ${key} is not part of the core asset contract.`,
    );
  const sprite = object(data.sprite, "asset.sprite");
  requireThat(
    sprite.file === "sprite.png" && data.animation_file === "animations.json",
    "The sprite and animation references must resolve to sprite.png and animations.json inside this ZIP.",
  );
  const width = integer(sprite.width, "sprite.width", 512, 512);
  const height = integer(sprite.height, "sprite.height", 512, 512);
  const bounds = object(sprite.visual_bounds, "sprite.visual_bounds");
  const x = integer(bounds.x, "visual_bounds.x", 0, width - 1);
  const y = integer(bounds.y, "visual_bounds.y", 0, height - 1);
  const w = integer(bounds.width, "visual_bounds.width", 1, width);
  const h = integer(bounds.height, "visual_bounds.height", 1, height);
  requireThat(
    x + w <= width && y + h <= height,
    "The visual bounds extend outside the sprite canvas. Recompile the asset.",
  );
  requireThat(
    ["character", "prop", "item", "environment", "ui"].includes(
      String(data.asset_type),
    ),
    "asset_type must be character, prop, item, environment, or ui.",
  );
  requireThat(
    Array.isArray(data.tags) && data.tags.length <= 32,
    "Asset tags must be an array of up to 32 strings.",
  );
  const source = object(data.source, "asset.source");
  return {
    schema_version: "1.3.0",
    asset_id: text(data.asset_id, "asset_id"),
    name: text(data.name, "asset.name", 120),
    asset_type: String(data.asset_type),
    tags: data.tags.map((tag) => text(tag, "tag", 80)),
    style_id: text(data.style_id, "style_id"),
    sprite: {
      file: "sprite.png",
      width,
      height,
      origin: point(sprite.origin, "sprite.origin"),
      visual_bounds: { x, y, width: w, height: h },
    },
    animation_file: "animations.json",
    source: {
      kind: text(source.kind, "source.kind"),
      source_object_label: text(
        source.source_object_label,
        "source.source_object_label",
      ),
    },
  };
}
function validateMotions(
  data: Record<string, unknown>,
): Record<string, Motion> {
  requireThat(
    data.schema_version === "1.3.0",
    "animations.json schema_version must be 1.3.0.",
  );
  const states = object(data.states, "animation states");
  requireThat(
    Object.keys(states).length <= 32,
    "A package can contain at most 32 motion states.",
  );
  const result: Record<string, Motion> = Object.create(null) as Record<
    string,
    Motion
  >;
  for (const [name, value] of Object.entries(states)) {
    requireThat(
      /^[a-z][a-z0-9_]{0,63}$/.test(name),
      `Invalid motion state name: ${name}. Use lowercase letters, digits, and underscores.`,
    );
    const motion = object(value, name);
    requireThat(
      motion.kind === "transform_timeline" && typeof motion.loop === "boolean",
      `${name} must be a transform_timeline with a boolean loop flag.`,
    );
    const duration = number(
      motion.duration_ms,
      `${name}.duration_ms`,
      1,
      60000,
    );
    requireThat(
      Array.isArray(motion.keyframes) &&
        motion.keyframes.length >= 2 &&
        motion.keyframes.length <= 256,
      `${name} must contain between 2 and 256 keyframes.`,
    );
    let previous = -1;
    const keyframes: Keyframe[] = motion.keyframes.map((value, index) => {
      const frame = object(value, `${name} keyframe ${index}`);
      const t = number(frame.t_ms, `${name}.t_ms`, 0, duration);
      requireThat(
        t > previous,
        `${name} keyframe times must be strictly increasing.`,
      );
      previous = t;
      return {
        t_ms: t,
        translate: pair(frame.translate, `${name}.translate`, -4096, 4096),
        scale: pair(frame.scale, `${name}.scale`, 0.01, 8),
        rotation_deg: number(
          frame.rotation_deg,
          `${name}.rotation_deg`,
          -360,
          360,
        ),
        opacity: number(frame.opacity, `${name}.opacity`, 0, 1),
      };
    });
    requireThat(
      keyframes[0].t_ms === 0 &&
        keyframes[keyframes.length - 1].t_ms === duration,
      `${name} must start at 0 ms and end exactly at duration_ms (${duration}).`,
    );
    result[name] = {
      kind: "transform_timeline",
      loop: motion.loop as boolean,
      duration_ms: duration,
      keyframes,
    };
  }
  return result;
}

export async function decodeImage(
  bytes: Uint8Array,
  mime: string,
): Promise<HTMLImageElement> {
  // Bound raster allocation before handing untrusted compressed pixels to a decoder.
  requireThat(
    bytes.length >= 30,
    `The extracted ${mime} image header is truncated.`,
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  if (mime === "image/png") {
    requireThat(
      view.getUint32(0) === 0x89504e47 &&
        view.getUint32(4) === 0x0d0a1a0a &&
        view.getUint32(12) === 0x49484452,
      "A PNG entry does not contain a valid PNG header.",
    );
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else {
    requireThat(
      view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250,
      "thumbnail.webp does not contain a valid WebP header.",
    );
    const kind = view.getUint32(12);
    if (kind === 0x56503858) {
      width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
      height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
    } else if (kind === 0x5650384c && bytes[20] === 0x2f) {
      const packed = view.getUint32(21, true);
      width = (packed & 0x3fff) + 1;
      height = ((packed >>> 14) & 0x3fff) + 1;
    } else if (
      kind === 0x56503820 &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    }
  }
  requireThat(
    width > 0 &&
      height > 0 &&
      width <= 8192 &&
      height <= 8192 &&
      width * height <= 16777216,
    "An image header is invalid or exceeds the 16 megapixel safety limit. Re-export a smaller asset.",
  );
  if (mime === "image/webp")
    requireThat(
      width === 256 && height === 256,
      "thumbnail.webp must be 256 × 256 pixels.",
    );
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: mime }),
  );
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth === width && image.naturalHeight === height)
          resolve(image);
        else
          reject(
            new Error("The decoded image dimensions do not match its header."),
          );
      };
      image.onerror = () =>
        reject(
          new Error(
            `The extracted ${mime} image is corrupt or cannot be decoded. Re-export the package.`,
          ),
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function validateImages(
  entries: Record<string, Uint8Array>,
  asset: Asset,
  states: Record<string, Motion>,
): Promise<void> {
  const sprite = await decodeImage(entries["sprite.png"], "image/png");
  requireThat(
    sprite.naturalWidth === asset.sprite.width &&
      sprite.naturalHeight === asset.sprite.height,
    "The decoded sprite dimensions disagree with asset.json. Recompile the package.",
  );
  const canvas = document.createElement("canvas");
  canvas.width = sprite.naturalWidth;
  canvas.height = sprite.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  requireThat(
    context,
    "This browser cannot inspect sprite transparency. Enable canvas support or use another browser.",
  );
  context.drawImage(sprite, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const bounds = asset.sprite.visual_bounds;
  requireThat(
    right >= 0,
    "sprite.png is fully transparent. Re-export a visible sprite.",
  );
  requireThat(
    left === bounds.x &&
      top === bounds.y &&
      right - left + 1 === bounds.width &&
      bottom - top + 1 === bounds.height,
    "The sprite alpha bounds do not match visual_bounds in asset.json. Recompile the package.",
  );
  const thumb = await decodeImage(entries["thumbnail.webp"], "image/webp");
  requireThat(
    thumb.naturalWidth === 256 && thumb.naturalHeight === 256,
    "thumbnail.webp must decode to 256 × 256 pixels.",
  );
  const hasMotion = Object.keys(states).length > 0;
  const hasAtlas = Boolean(
    entries["atlas/spritesheet.png"] || entries["atlas/frames.json"],
  );
  requireThat(
    !hasMotion || hasAtlas,
    "Animated exports must include atlas/spritesheet.png and atlas/frames.json with four procedural frames.",
  );
  if (!hasAtlas) return;
  requireThat(
    entries["atlas/spritesheet.png"] && entries["atlas/frames.json"],
    "The atlas image and frame map must both exist inside the ZIP.",
  );
  const data = readJSON(entries, "atlas/frames.json");
  requireThat(
    data.schema_version === "1.3.0" &&
      data.kind === "procedural_motion_frames" &&
      data.image === "atlas/spritesheet.png",
    "The atlas must use schema 1.3.0, kind procedural_motion_frames, and reference atlas/spritesheet.png.",
  );
  const motionName = text(data.motion, "atlas.motion");
  requireThat(
    Object.hasOwn(states, motionName),
    `The atlas references a missing motion state: ${motionName}.`,
  );
  const duration = number(data.duration_ms, "atlas.duration_ms", 1, 60000);
  requireThat(
    duration === states[motionName].duration_ms,
    "The atlas duration must match its referenced motion.",
  );
  requireThat(
    Array.isArray(data.frames) && data.frames.length === 4,
    "The procedural atlas must contain exactly four frames.",
  );
  const atlas = await decodeImage(
    entries["atlas/spritesheet.png"],
    "image/png",
  );
  requireThat(
    atlas.naturalWidth <= 8192 &&
      atlas.naturalHeight <= 8192 &&
      atlas.naturalWidth * atlas.naturalHeight <= 16777216,
    "The atlas exceeds the 16 megapixel limit.",
  );
  let previous = -1;
  const rectangles: { x: number; y: number; w: number; h: number }[] = [];
  data.frames.forEach((value, index) => {
    const frame = object(value, `atlas frame ${index}`);
    const rect = object(frame.frame, "atlas frame rectangle");
    const x = integer(rect.x, "frame.x", 0, atlas.naturalWidth - 1);
    const y = integer(rect.y, "frame.y", 0, atlas.naturalHeight - 1);
    const w = integer(rect.w, "frame.w", 1, atlas.naturalWidth);
    const h = integer(rect.h, "frame.h", 1, atlas.naturalHeight);
    requireThat(
      x + w <= atlas.naturalWidth && y + h <= atlas.naturalHeight,
      `Atlas frame ${index} extends beyond the image.`,
    );
    requireThat(
      !rectangles.some(
        (r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y,
      ),
      "Atlas frame rectangles must not overlap.",
    );
    rectangles.push({ x, y, w, h });
    const offset = object(frame.offset, "frame.offset");
    number(offset.x, "frame.offset.x", -4096, 4096);
    number(offset.y, "frame.offset.y", -4096, 4096);
    point(frame.pivot, "frame.pivot");
    const t = number(frame.t_ms, "frame.t_ms", 0, duration);
    requireThat(
      t > previous &&
        (index !== 0 || t === 0) &&
        (index !== 3 || t === duration),
      "Atlas timestamps must increase from 0 to the motion duration.",
    );
    previous = t;
  });
}

export async function validatePackage(
  bytes: Uint8Array,
  onCheck: (check: Check) => void,
): Promise<Package> {
  const directory = inspectZIP(bytes);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (entry) =>
        directory.has(entry.name) &&
        entry.originalSize === directory.get(entry.name),
    });
  } catch {
    throw new Error(
      "ZIP decompression failed. The archive is corrupt; download or export it again.",
    );
  }
  requireThat(
    Object.keys(entries).length === directory.size,
    "The extracted ZIP does not match its directory. Re-export the archive.",
  );
  for (const [name, size] of directory)
    requireThat(
      entries[name]?.length === size,
      `${name} has an unexpected expanded size. The archive may be corrupt.`,
    );
  onCheck("zip");
  const manifest = readJSON(entries, "manifest.json");
  requireThat(
    manifest.package_version === "1.3.0",
    "manifest.json package_version must be 1.3.0.",
  );
  text(manifest.compiler_version, "manifest.compiler_version");
  requireThat(
    typeof manifest.created_at === "string" &&
      Number.isFinite(Date.parse(manifest.created_at)),
    "manifest.created_at must be a valid timestamp.",
  );
  requireThat(
    manifest.source_photo_included === false,
    "This core importer only accepts packages without the source photo. Export without source images.",
  );
  text(manifest.license_note, "manifest.license_note", 4000);
  requireThat(
    Array.isArray(manifest.files) &&
      manifest.files.length === directory.size - 1,
    "The manifest must list every ZIP file except manifest.json itself.",
  );
  const listed = new Set<string>();
  const files: FileInfo[] = [];
  requireThat(
    globalThis.crypto?.subtle,
    "SHA-256 verification needs a secure browser context. Open this page on localhost or HTTPS.",
  );
  for (const value of manifest.files) {
    const info = object(value, "manifest file");
    const path = text(info.path, "manifest file path");
    safePath(path);
    requireThat(
      path !== "manifest.json" && !listed.has(path) && directory.has(path),
      `Manifest file ${path} is missing, duplicated, or references itself.`,
    );
    listed.add(path);
    const size = integer(info.bytes, `${path} bytes`, 1, MAX_EXPANDED_BYTES);
    requireThat(
      size === entries[path].length,
      `${path} byte count does not match the manifest. Re-export an unmodified package.`,
    );
    requireThat(
      typeof info.sha256 === "string" && /^[a-f0-9]{64}$/i.test(info.sha256),
      `${path} has an invalid SHA-256 value in the manifest.`,
    );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(entries[path]),
    );
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    requireThat(
      hash === info.sha256.toLowerCase(),
      `SHA-256 mismatch for ${path}. The file has changed or is corrupt. Download a fresh export; do not edit a compiled ZIP.`,
    );
    files.push({
      path,
      bytes: size,
      sha256: hash,
      mime: text(info.mime, `${path} MIME type`),
    });
  }
  onCheck("hash");
  const asset = validateAsset(readJSON(entries, "asset.json"));
  requireThat(
    manifest.asset_id === asset.asset_id,
    "The asset ID in manifest.json does not match asset.json.",
  );
  const states = validateMotions(readJSON(entries, "animations.json"));
  requireThat(
    Array.isArray(manifest.warnings) &&
      manifest.warnings.length <= 64 &&
      manifest.warnings.every(
        (warning) => typeof warning === "string" && warning.length <= 4000,
      ),
    "manifest.warnings must contain at most 64 strings of up to 4,000 characters.",
  );
  requireThat(
    Array.isArray(manifest.stages) && manifest.stages.length <= 64,
    "manifest.stages must contain at most 64 provenance stages.",
  );
  const stages = manifest.stages.map((value) => {
    const stage = object(value, "manifest stage");
    requireThat(
      ["fixture", "fallback", "live", "cached"].includes(String(stage.mode)) &&
        typeof stage.success === "boolean",
      "Each provenance stage needs a valid mode and success flag.",
    );
    text(stage.provider, "stage.provider");
    return { name: text(stage.name, "stage.name"), mode: String(stage.mode) };
  });
  await validateImages(entries, asset, states);
  onCheck("schema");
  return {
    asset,
    states,
    files,
    entries,
    warnings: manifest.warnings as string[],
    stages,
    compressedBytes: bytes.length,
  };
}

export function interpolate(motion: Motion, time: number): Keyframe {
  const t = Math.max(0, Math.min(time, motion.duration_ms));
  const frames = motion.keyframes;
  let end = 1;
  while (end < frames.length - 1 && frames[end].t_ms < t) end++;
  const left = frames[end - 1];
  const right = frames[end];
  const fraction = (t - left.t_ms) / (right.t_ms - left.t_ms);
  const mix = (a: number, b: number) => a + (b - a) * fraction;
  return {
    t_ms: t,
    translate: [
      mix(left.translate[0], right.translate[0]),
      mix(left.translate[1], right.translate[1]),
    ],
    scale: [
      mix(left.scale[0], right.scale[0]),
      mix(left.scale[1], right.scale[1]),
    ],
    rotation_deg: mix(left.rotation_deg, right.rotation_deg),
    opacity: mix(left.opacity, right.opacity),
  };
}
