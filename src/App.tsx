import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FileImage,
  FolderOpen,
  Gamepad2,
  Grid2X2,
  Layers3,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import AssetCanvas from "./AssetCanvas";
import { GuideDialog, Modal, UploadDialog } from "./Dialogs";
import {
  api,
  jsonRequest,
  type AssetResponse,
  type Compile,
  type Motion,
  type Sample,
} from "./types";

const modeNames = {
  fixture: "Demo fixture",
  fallback: "Manual fallback",
  live: "Live model output",
  cached: "Cached output",
};
const storedIds = () => {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem("r2p-assets") ?? "[]");
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string" && /^ast_[a-f0-9]{32}$/.test(id))
      : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [data, setData] = useState<AssetResponse | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [view, setView] = useState<"studio" | "library">(() =>
    new URLSearchParams(location.search).get("view") === "library"
      ? "library"
      : "studio",
  );
  const [modal, setModal] = useState<
    "upload" | "guide" | "export" | "pipeline" | "delete" | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<AssetResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [motion, setMotion] = useState<Motion>("idle_bob");
  const [compiled, setCompiled] = useState<Compile | null>(null);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [showHashes, setShowHashes] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const receiveAsset = useCallback((asset: AssetResponse) => {
    setData(asset);
    setCompiled(null);
    setModal(null);
    setError("");
    setView("studio");
    setMotion(asset.motions[0] ?? "idle_bob");
    setAssets((previous) => {
      const next = [
        asset,
        ...previous.filter((item) => item.asset_id !== asset.asset_id),
      ];
      localStorage.setItem(
        "r2p-assets",
        JSON.stringify(next.map((item) => item.asset_id)),
      );
      return next;
    });
    localStorage.setItem("r2p-active", asset.asset_id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      setLoading(true);
      setError("");
      try {
        const [health, result] = await Promise.all([
          api<{ meta_configured: boolean }>("/health"),
          api<{ samples: Sample[] }>("/samples"),
        ]);
        if (cancelled) return;
        setMetaConfigured(health.meta_configured);
        setSamples(result.samples);
        const existing = await Promise.all(
          storedIds().map((id) =>
            api<AssetResponse>(`/assets/${encodeURIComponent(id)}`).catch(
              () => null,
            ),
          ),
        );
        if (cancelled) return;
        const valid = existing.filter(
          (item): item is AssetResponse => item !== null,
        );
        setAssets(valid);
        const active =
          valid.find(
            (item) => item.asset_id === localStorage.getItem("r2p-active"),
          ) ?? valid[0];
        if (active) {
          setData(active);
          setMotion(active.motions[0] ?? "idle_bob");
        } else {
          const sample = await api<AssetResponse>("/samples/cactus/load", {
            method: "POST",
          });
          if (!cancelled) receiveAsset(sample);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            `Cannot reach the local compiler. Start the API with npm run dev:api, then retry. ${(e as Error).message}`,
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [receiveAsset, reload]);

  useEffect(() => {
    const url = new URL(location.href);
    view === "library"
      ? url.searchParams.set("view", "library")
      : url.searchParams.delete("view");
    history.replaceState(null, "", url);
  }, [view]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || modal) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModal("upload");
      }
      if (e.key === "?") setModal("guide");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal]);

  async function loadSample(id: string) {
    setBusy(true);
    setError("");
    try {
      receiveAsset(
        await api<AssetResponse>(`/samples/${id}/load`, { method: "POST" }),
      );
      setNotice(
        "Sample loaded. This is original demo artwork, not an AI result.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updateAsset(update: Record<string, unknown>) {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<AssetResponse>(
        `/assets/${data.asset_id}`,
        jsonRequest("PATCH", update),
      );
      setData(updated);
      setCompiled(null);
      setAssets((previous) =>
        previous.map((item) =>
          item.asset_id === updated.asset_id ? updated : item,
        ),
      );
      setNotice("Asset changes saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function compileAsset() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const output = await api<Compile>(`/assets/${data.asset_id}/compile`, {
        method: "POST",
      });
      setCompiled(output);
      setModal("export");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAsset(target: AssetResponse | null) {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await api<void>(`/assets/${target.asset_id}`, { method: "DELETE" });
      const remaining = assets.filter(
        (item) => item.asset_id !== target.asset_id,
      );
      setAssets(remaining);
      localStorage.setItem(
        "r2p-assets",
        JSON.stringify(remaining.map((item) => item.asset_id)),
      );
      if (data?.asset_id === target.asset_id) {
        localStorage.removeItem("r2p-active");
        setData(remaining[0] ?? null);
        setCompiled(null);
      }
      setPendingDelete(null);
      setModal(null);
      setView("library");
      setNotice("Asset and related source files deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sprite = data?.asset.sprite;
  const filtered = assets.filter((item) =>
    `${item.asset.name} ${item.asset.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="Real2Playable home">
          <span className="brand-icon">
            <Box size={24} strokeWidth={1.8} />
          </span>
          <span>
            real<span className="brand-two">2</span>playable
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-mark">
            <Layers3 size={17} />
          </div>
          <div>
            <strong>My workspace</strong>
            <span>A little space to create</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">Create</div>
        <nav aria-label="Workspace navigation">
          <button
            className={`nav-item ${view === "studio" ? "nav-active" : ""}`}
            aria-label="Asset studio"
            onClick={() => setView("studio")}
          >
            <LayoutDashboard size={18} />
            <span>Asset studio</span>
            <span className="nav-active-dot" />
          </button>
          <button
            className={`nav-item ${view === "library" ? "nav-active" : ""}`}
            aria-label="Asset library"
            onClick={() => setView("library")}
          >
            <Grid2X2 size={18} />
            <span>Asset library</span>
            <span className="nav-count">{assets.length}</span>
          </button>
          <a
            className="nav-item"
            aria-label="Playground"
            href={`/playground/${data ? `?asset=${data.asset_id}` : ""}`}
            target="_blank"
            rel="noreferrer"
          >
            <Gamepad2 size={19} />
            <span>Playground</span>
            <ExternalLink size={12} className="nav-external" />
          </a>
        </nav>
        <div className="nav-label resource-label">Resources</div>
        <nav aria-label="Resources">
          <button className="nav-item" aria-label="Quick start guide" onClick={() => setModal("guide")}>
            <BookOpen size={18} />
            <span>Quick start guide</span>
          </button>
          <button className="nav-item" aria-label="Pipeline & provenance" onClick={() => setModal("pipeline")}>
            <Code2 size={18} />
            <span>Pipeline & provenance</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="idea-card">
            <div className="idea-illustration" aria-hidden="true">
              <div />
              <div />
              <div />
              <Sprout size={27} />
              <span>✦</span>
            </div>
            <h3>
              Real-world objects.
              <br />
              Other-worldly potential.
            </h3>
            <p>Your desk is full of game assets waiting to happen.</p>
            <button onClick={() => setModal("guide")}>
              Find your starting point
              <ArrowRight size={14} />
            </button>
          </div>
          <button className="help-link" aria-label="Help & shortcuts" onClick={() => setModal("guide")}>
            <CircleHelp size={17} />
            <span>Help & shortcuts</span>
            <kbd>?</kbd>
          </button>
          <div className="local-profile">
            <div className="profile-avatar">
              <Leaf size={18} />
            </div>
            <div>
              <strong>Local workspace</strong>
              <span>No account. Just create.</span>
            </div>
            <span className="green-dot" />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <FolderOpen size={16} />
            <span>My workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "studio" ? "Asset studio" : "Asset library"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="session-label">
              <span className="green-dot" />
              Local session
            </span>
            <span className="topbar-divider" />
            <button className="topbar-docs" onClick={() => setModal("guide")}>
              <BookOpen size={15} />
              Docs
            </button>
            <button
              className="avatar-button"
              onClick={() => setModal("guide")}
              aria-label="About your local workspace"
            >
              Y<span />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="title-line">
                <h1>
                  {view === "studio"
                    ? "Make the everyday playable."
                    : "A world of your own making."}
                </h1>
                <span className="beta-badge">Beta</span>
              </div>
              <p>
                {view === "studio"
                  ? "From a real-world object to your next game-ready asset."
                  : "Your compiled assets, ready for their next adventure."}
              </p>
            </div>
            <div className="page-actions">
              <button
                className="secondary-button guide-button"
                onClick={() => setModal("guide")}
              >
                <CircleHelp size={16} />
                How it works
              </button>
              <button
                className="primary-button"
                onClick={() => setModal("upload")}
                disabled={busy || loading}
              >
                <Plus size={17} />
                New asset
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={19} />
              <span>{error}</span>
              {!data && (
                <button
                  className="text-button"
                  onClick={() => setReload((v) => v + 1)}
                >
                  Retry connection
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-workspace">
              <LoaderCircle size={28} className="spin" />
              <h2>Opening your creative space…</h2>
              <p>Connecting to the local asset compiler.</p>
            </div>
          ) : view === "library" ? (
            <section className="library-view">
              <div className="library-toolbar">
                <h2>
                  Your assets <span>{assets.length}</span>
                </h2>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search assets"
                    name="asset-search"
                    autoComplete="off"
                    placeholder="Find an asset…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="asset-grid">
                {filtered.map((item) => (
                  <div key={item.asset_id} className="library-card">
                    <button
                      className="library-open"
                      onClick={() => receiveAsset(item)}
                      aria-label={`Open ${item.asset.name} in studio`}
                    >
                      <div className="library-preview checkerboard">
                        <img
                          src={item.preview_url}
                          alt={item.asset.name}
                          width="512"
                          height="512"
                          loading="lazy"
                        />
                        <span className="tiny-chip">
                          {modeNames[item.mode]}
                        </span>
                      </div>
                      <div className="library-meta">
                        <h3>{item.asset.name}</h3>
                        <span>
                          {item.asset.asset_type}{" "}
                          <span className="dot-separator">·</span> 512 × 512
                        </span>
                        <ChevronRight size={17} />
                      </div>
                    </button>
                    <button
                      className="library-delete"
                      aria-label={`Delete ${item.asset.name} from library`}
                      title="Delete from library"
                      disabled={busy}
                      onClick={() => {
                        setPendingDelete(item);
                        setModal("delete");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <Boxes size={36} />
                  <h3>
                    {query
                      ? "No matching assets"
                      : "Your asset collection starts here"}
                  </h3>
                  <p>
                    {query
                      ? "Try a different name or tag."
                      : "Upload a photo or explore an original demo sample below."}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => (query ? setQuery("") : setModal("upload"))}
                  >
                    {query ? "Clear search" : "Create an asset"}
                  </button>
                </div>
              )}
              <SampleShelf samples={samples} busy={busy} onLoad={loadSample} />
            </section>
          ) : data && sprite ? (
            <>
              <div className="workflow" aria-label="Asset workflow">
                {[
                  {
                    label: "Source",
                    icon: UploadCloud,
                    complete: true,
                    action: () => setModal("upload"),
                  },
                  {
                    label: "Style",
                    icon: WandSparkles,
                    complete: data.mode !== "fallback",
                    action: () => setModal("pipeline"),
                  },
                  {
                    label: "Inspect",
                    icon: Settings2,
                    active: true,
                    action: () =>
                      document
                        .querySelector(".studio-grid")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        }),
                  },
                  {
                    label: "Motion",
                    icon: Sparkles,
                    action: () =>
                      document
                        .querySelector(".motion-editor")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        }),
                  },
                  { label: "Export", icon: Box, action: compileAsset },
                ].map((step, i) => (
                  <button
                    key={step.label}
                    className={`workflow-step ${step.complete ? "step-complete" : ""} ${step.active ? "step-active" : ""}`}
                    disabled={busy}
                    onClick={step.action}
                  >
                    <span className="step-icon">
                      {step.complete ? (
                        <Check size={14} />
                      ) : (
                        <step.icon size={15} />
                      )}
                    </span>
                    <span>{step.label}</span>
                    {step.active && (
                      <span className="current-step">You're here</span>
                    )}
                    {i < 4 && (
                      <ChevronRight size={14} className="step-chevron" />
                    )}
                  </button>
                ))}
              </div>
              <div className="studio-grid">
                <section className="source-panel">
                  <div className="section-heading">
                    <h2>It started with this</h2>
                    <span className="small-pill">Source</span>
                  </div>
                  <div className="source-image">
                    <img
                      src={data.source_url}
                      alt={
                        data.mode === "fixture"
                          ? "Original authored sample illustration on a neutral background"
                          : "Your original uploaded photo"
                      }
                      width="512"
                      height="512"
                    />
                    <div className="source-image-tag">
                      <FileImage size={12} />
                      {data.mode === "fixture"
                        ? "Demo illustration"
                        : "Original photo"}
                    </div>
                  </div>
                  <div className="source-file">
                    <div className="file-icon">
                      <FileImage size={17} />
                    </div>
                    <div>
                      <strong>
                        {data.asset.source.source_object_label ||
                          data.asset.name}
                      </strong>
                      <span>
                        {data.mode === "fixture"
                          ? "Original sample · not an AI result"
                          : "Private upload · EXIF removed"}
                      </span>
                    </div>
                    <CircleCheck size={16} />
                  </div>
                  <button
                    className="upload-mini"
                    onClick={() => setModal("upload")}
                  >
                    <UploadCloud size={21} />
                    <span>
                      <strong>Try your own object</strong>
                      <span>Drop in a little piece of your world</span>
                    </span>
                    <Plus size={16} />
                  </button>
                  <div className="panel-divider" />
                  <div className="section-heading">
                    <h3>Art direction</h3>
                    <Sparkles size={14} />
                  </div>
                  <button
                    className="style-choice"
                    onClick={() => setModal("pipeline")}
                  >
                    <div className="style-thumbnail">
                      <Sprout size={29} />
                      <span />
                    </div>
                    <div>
                      <strong>
                        {data.mode === "fallback" ? "Original pixels" : "Storybook toy"}
                      </strong>
                      <span>
                        {data.mode === "fallback"
                          ? "Manual crop. No AI stylization."
                          : "Soft shapes. A little personality."}
                      </span>
                    </div>
                    <span className="style-check">
                      <Check size={12} />
                    </span>
                  </button>
                  <div
                    className="palette-row"
                    aria-label="Storybook toy style palette"
                  >
                    <span style={{ background: "#8dbb91" }} />
                    <span style={{ background: "#ecc5b3" }} />
                    <span style={{ background: "#e5c97c" }} />
                    <span style={{ background: "#c4b4de" }} />
                    <p>One coherent little world.</p>
                  </div>
                  <div className="source-note">
                    <ShieldCheck size={15} />
                    <p>
                      Source stays out of your export.
                      <br />
                      The asset is yours to take.
                    </p>
                  </div>
                </section>
                <AssetCanvas
                  data={data}
                  motion={motion}
                  setMotion={setMotion}
                  enabled={data.motions}
                  disabled={busy}
                  toggleMotion={(id) => {
                    const next = data.motions.includes(id)
                      ? data.motions.filter((item) => item !== id)
                      : [...data.motions, id];
                    if (!data.motions.includes(id)) setMotion(id);
                    void updateAsset({ motions: next });
                  }}
                  onOriginChange={(next) => void updateAsset({ origin: next })}
                />
                <aside className="inspector-panel">
                  <div className="section-heading">
                    <h2>Asset details</h2>
                    <button
                      className="icon-button small-icon"
                      aria-label="View asset pipeline"
                      onClick={() => setModal("pipeline")}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                  <label className="field-label" htmlFor="asset-name">
                    Asset name
                  </label>
                  <div className="name-field">
                    <input
                      key={`${data.asset_id}-${data.asset.name}`}
                      ref={nameInput}
                      id="asset-name"
                      name="asset-name"
                      defaultValue={data.asset.name}
                      maxLength={40}
                      autoComplete="off"
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== data.asset.name)
                          void updateAsset({ name: value });
                        else e.target.value = data.asset.name;
                      }}
                    />
                    <Pencil size={13} />
                  </div>
                  <label className="field-label" htmlFor="asset-type">
                    Asset type
                  </label>
                  <select
                    id="asset-type"
                    name="asset-type"
                    value={data.asset.asset_type}
                    disabled={busy}
                    onChange={(e) =>
                      void updateAsset({ asset_type: e.target.value })
                    }
                  >
                    {["prop", "character", "item", "environment", "ui"].map(
                      (type) => (
                        <option key={type} value={type}>
                          {type === "ui"
                            ? "UI element"
                            : type[0].toUpperCase() + type.slice(1)}
                        </option>
                      ),
                    )}
                  </select>
                  <label
                    className="field-label tags-label"
                    htmlFor="asset-tags"
                  >
                    Tags <span>Comma separated</span>
                  </label>
                  <input
                    key={`tags-${data.asset_id}-${data.asset.tags.join()}`}
                    className="tags-input"
                    id="asset-tags"
                    name="asset-tags"
                    defaultValue={data.asset.tags.join(", ")}
                    autoComplete="off"
                    maxLength={150}
                    disabled={busy}
                    onBlur={(e) => {
                      const tags = [
                        ...new Set(
                          e.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        ),
                      ].slice(0, 5);
                      if (
                        JSON.stringify(tags) !== JSON.stringify(data.asset.tags)
                      )
                        void updateAsset({ tags });
                    }}
                  />
                  <div className="panel-divider" />
                  <div className="section-heading origin-heading">
                    <h3>Origin point</h3>
                    <span className="small-pill">Normalized</span>
                  </div>
                  <div className="origin-fields">
                    {(["x", "y"] as const).map((axis) => (
                      <label key={axis}>
                        <span>{axis.toUpperCase()}</span>
                        <input
                          key={`${data.asset_id}-${sprite.origin[axis]}`}
                          aria-label={`Origin ${axis.toUpperCase()}`}
                          name={`origin-${axis}`}
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          defaultValue={sprite.origin[axis]}
                          disabled={busy}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (
                              !e.target.value ||
                              !Number.isFinite(value) ||
                              value < 0 ||
                              value > 1
                            ) {
                              e.target.value = String(sprite.origin[axis]);
                              setError(
                                "Origin coordinates must be between 0 and 1.",
                              );
                              return;
                            }
                            if (value !== sprite.origin[axis])
                              void updateAsset({
                                origin: { ...sprite.origin, [axis]: value },
                              });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="field-hint">
                    Your anchor, wherever your game needs it. Show origin on
                    the canvas, then drag the marker — arrow keys work too.
                  </p>
                  <div className="panel-divider" />
                  <div className="section-heading">
                    <h3>Under the hood</h3>
                    <ShieldCheck size={15} className="success-color" />
                  </div>
                  <dl className="technical-details">
                    <div>
                      <dt>Canvas</dt>
                      <dd>
                        {sprite.width} × {sprite.height} px
                      </dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>
                        PNG <span className="micro-pill">RGBA</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Visual bounds</dt>
                      <dd>
                        {sprite.visual_bounds.width} ×{" "}
                        {sprite.visual_bounds.height} px
                      </dd>
                    </div>
                    <div>
                      <dt>Schema</dt>
                      <dd>v{data.asset.schema_version}</dd>
                    </div>
                  </dl>
                  <div className="qa-note">
                    <CircleCheck size={15} />
                    <div>
                      <strong>
                        {data.warnings.length
                          ? "Review before export"
                          : "Looking ready to play"}
                      </strong>
                      <p>
                        {data.warnings.length
                          ? data.warnings[0]
                          : "Measured bounds. Transparent canvas."}
                      </p>
                    </div>
                  </div>
                  <button
                    className="provenance-link"
                    onClick={() => setModal("pipeline")}
                  >
                    <span className={`mode-dot mode-${data.mode}`} />
                    {modeNames[data.mode]}
                    <ChevronRight size={14} />
                  </button>
                </aside>
              </div>
              <div className="export-bar">
                <div className="export-summary">
                  <span className="export-icon">
                    <PackageCheck size={22} />
                  </span>
                  <div>
                    <strong>A little asset. Ready for a bigger world.</strong>
                    <p>
                      Transparent PNG + JSON
                      {data.motions.length > 0 && " + motion atlas"}
                      <span className="dot-separator">·</span>No engine lock-in.
                    </p>
                  </div>
                </div>
                <div className="export-actions">
                  <a
                    className="secondary-button playground-button"
                    href={`/playground/?asset=${data.asset_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Gamepad2 size={17} />
                    Test in playground
                    <ExternalLink size={13} />
                  </a>
                  <button
                    className="primary-button export-button"
                    disabled={busy}
                    onClick={() => void compileAsset()}
                  >
                    {busy ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Box size={17} />
                    )}
                    Compile & export
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <SampleShelf samples={samples} busy={busy} onLoad={loadSample} />
              <div className="workspace-footnote">
                <span>
                  <ShieldCheck size={13} />
                  Built for portability. No account required.
                </span>
                <button onClick={() => setModal("pipeline")}>
                  <span className="status-indicator" />
                  {metaConfigured
                    ? "Meta API configured"
                    : "Local compiler ready"}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Box size={40} />
              <h2>Your next asset is out there.</h2>
              <p>
                Upload a photo, or start with one of our original demo samples.
              </p>
              <button
                className="primary-button"
                onClick={() => setModal("upload")}
              >
                <Plus size={16} />
                Create an asset
              </button>
              <SampleShelf samples={samples} busy={busy} onLoad={loadSample} />
            </div>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "upload" && (
        <UploadDialog
          metaConfigured={metaConfigured}
          onClose={() => setModal(null)}
          onCreated={receiveAsset}
        />
      )}
      {modal === "guide" && (
        <GuideDialog
          metaConfigured={metaConfigured}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "pipeline" && (
        <Modal
          title="Nothing hidden under the hood"
          onClose={() => setModal(null)}
        >
          <div className="modal-body">
            <p className="modal-intro">
              The exact origin and processing stages of your asset. Live means a
              real model call; a fixture is always a fixture.
            </p>
            <div className="pipeline-status">
              <span className={`mode-dot mode-${data?.mode ?? "fixture"}`} />
              <strong>
                {data ? modeNames[data.mode] : "No asset selected"}
              </strong>
              <span>
                {metaConfigured
                  ? "API key configured"
                  : "Meta API key not configured"}
              </span>
            </div>
            {data?.stages.map((stage, index) => (
              <div className="stage-row" key={`${stage.name}-${index}`}>
                <span
                  className={stage.success ? "stage-success" : "stage-failure"}
                >
                  {stage.success ? <Check size={16} /> : <X size={16} />}
                </span>
                <div>
                  <strong>{stage.name.replaceAll("_", " ")}</strong>
                  <span>
                    {stage.provider}
                    {stage.model ? ` / ${stage.model}` : ""}
                  </span>
                </div>
                <span className="small-pill">{stage.mode}</span>
                {stage.duration_ms !== undefined && (
                  <span className="stage-duration">
                    {Math.round(stage.duration_ms)} ms
                  </span>
                )}
              </div>
            ))}
            {data?.warnings.map((warning) => (
              <p className="warning-note" key={warning}>
                {warning}
              </p>
            ))}
            <div className="honesty-note">
              <ShieldCheck size={20} />
              <div>
                <strong>Your photograph is not the product</strong>
                <p>
                  Source images are excluded from exports. Model keys stay on
                  the server. Motion presets transform the same sprite; they do
                  not generate new poses.
                </p>
              </div>
            </div>
            <button
              className="secondary-button full-width"
              onClick={() => setModal("guide")}
            >
              <BookOpen size={16} />
              Read the quick start guide
            </button>
            {data && (
              <button
                className="danger-text"
                onClick={() => {
                  setPendingDelete(data);
                  setModal("delete");
                }}
              >
                <Trash2 size={15} />
                Delete this asset & its source
              </button>
            )}
          </div>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal
          title="Delete this asset?"
          onClose={() => {
            setPendingDelete(null);
            setModal(null);
          }}
          busy={busy}
        >
          <div className="modal-body">
            <p className="modal-intro">
              “{(pendingDelete ?? data)?.asset.name}” and its related source
              files will be removed from this local workspace. Exported copies
              on your device are not affected.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setPendingDelete(null);
                  setModal(null);
                }}
              >
                Keep asset
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void deleteAsset(pendingDelete ?? data)}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete asset
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "export" && compiled && data && (
        <Modal
          title="Packed. Portable. Yours."
          onClose={() => setModal(null)}
          wide
        >
          <div className="modal-body">
            <div className="export-success">
              <span>
                <PackageCheck size={30} />
              </span>
              <div>
                <h3>Your asset pack is ready.</h3>
                <p>
                  Compiled, reopened, and checked. No source photo included.
                </p>
              </div>
              <span className="verified-badge">
                <CheckCheck size={15} />
                Verified
              </span>
            </div>
            <div className="export-modal-grid">
              <div>
                <div className="file-list-heading">
                  <h3>Inside your .asset.zip</h3>
                  <button
                    className="text-button"
                    onClick={() => setShowHashes(!showHashes)}
                  >
                    {showHashes ? "Hide" : "Show"} checksums
                  </button>
                </div>
                <div className="package-files">
                  {compiled.files.map((file) => (
                    <div key={file.path}>
                      <span className="package-file-icon">
                        {file.mime.startsWith("image/") ? (
                          <FileImage size={16} />
                        ) : (
                          <FileCode2 size={16} />
                        )}
                      </span>
                      <div>
                        <strong>{file.path}</strong>
                        {showHashes && <code>{file.sha256}</code>}
                      </div>
                      <span>
                        {file.bytes < 1024
                          ? `${file.bytes} B`
                          : `${(file.bytes / 1024).toFixed(1)} KB`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="export-checks">
                <h3>The boring bits, handled.</h3>
                {Object.entries(compiled.checks).map(([key, ok]) => (
                  <div
                    key={key}
                    className={ok ? "check-passed" : "check-failed"}
                  >
                    {ok ? <CircleCheck size={15} /> : <X size={15} />}
                    <span>{key.replaceAll("_", " ")}</span>
                  </div>
                ))}
                <p>
                  {data.motions.length
                    ? "The atlas contains 4 procedural frames of one sprite. Not AI-generated multi-pose animation."
                    : "Static export. No atlas needed."}
                </p>
                <span className="small-pill">
                  Core only · No game mechanics
                </span>
              </div>
            </div>
            {compiled.warnings.map((warning) => (
              <p key={warning} className="warning-note">
                {warning}
              </p>
            ))}
            <div className="download-actions">
              <a
                className="secondary-button"
                href={`/playground/?asset=${data.asset_id}`}
                target="_blank"
                rel="noreferrer"
              >
                <Gamepad2 size={17} />
                Preview in Phaser
                <ExternalLink size={14} />
              </a>
              <a
                className="primary-button"
                href={compiled.download_url}
                download
              >
                <Download size={17} />
                Download asset pack
              </a>
            </div>
            <p className="privacy-note">
              <ShieldCheck size={14} />
              PNG + JSON. Use in your engine, on your terms. Check artwork
              rights before publishing.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SampleShelf({
  samples,
  busy,
  onLoad,
}: {
  samples: Sample[];
  busy: boolean;
  onLoad: (id: string) => void;
}) {
  return (
    <section className="sample-shelf">
      <div className="sample-intro">
        <span className="sample-spark">
          <Sparkles size={19} />
        </span>
        <div>
          <h3>A few things from our desk</h3>
          <p>No photo handy? Explore an original demo sample.</p>
        </div>
      </div>
      <div className="sample-options">
        {samples.map((sample) => (
          <button
            key={sample.id}
            className="sample-button"
            disabled={busy}
            onClick={() => onLoad(sample.id)}
          >
            <img
              src={sample.thumbnail_url}
              alt=""
              width="56"
              height="56"
              loading="lazy"
            />
            <span>{sample.name}</span>
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}
