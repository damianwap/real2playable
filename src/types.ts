export type Mode = "fixture" | "fallback" | "live" | "cached";
export type Motion = "idle_bob" | "interact_pulse" | "impact_flash";
export type Vec = { x: number; y: number };
export type Stage = {
  name: string;
  provider: string;
  model?: string | null;
  mode: Mode;
  success: boolean;
  duration_ms?: number;
};
export type Keyframe = {
  t_ms: number;
  translate: [number, number];
  scale: [number, number];
  rotation_deg: number;
  opacity: number;
};
export type Timeline = {
  kind: "transform_timeline";
  loop: boolean;
  duration_ms: number;
  keyframes: Keyframe[];
};
export type AssetResponse = {
  asset_id: string;
  preview_url: string;
  source_url: string;
  mode: Mode;
  asset: {
    schema_version: string;
    asset_id: string;
    name: string;
    asset_type: "character" | "prop" | "item" | "environment" | "ui";
    tags: string[];
    style_id: string;
    sprite: {
      file: string;
      width: number;
      height: number;
      origin: Vec;
      visual_bounds: Vec & { width: number; height: number };
    };
    animation_file: string;
    source: { kind: string; source_object_label: string };
  };
  animations: { schema_version: string; states: Record<string, Timeline> };
  motions: Motion[];
  warnings: string[];
  stages: Stage[];
};
export type Sample = {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
};
export type Upload = {
  upload_id: string;
  preview_url: string;
  width: number;
  height: number;
};
export type Selection = {
  selection_id: string;
  mask_url: string;
  preview_url: string;
  method: string;
  mode: Mode;
  warnings: string[];
  stages: Stage[];
  suggested_label: string | null;
};
export type Compile = {
  export_id: string;
  asset_id: string;
  schema_valid: boolean;
  download_url: string;
  files: { path: string; bytes: number; sha256: string; mime: string }[];
  warnings: string[];
  checks: Record<string, boolean>;
};
export type Job = {
  job_id: string;
  status: string;
  stage: string;
  mode: Mode;
  attempts: number;
  elapsed_ms: number;
  error?: { code: string; message: string };
  result?: AssetResponse;
  stages: Stage[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/v1" + path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "object" && detail?.message
        ? detail.message
        : typeof detail === "string"
          ? detail
          : `Request failed (${response.status}). Try again.`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const jsonRequest = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
