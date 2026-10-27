import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Scan,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  api,
  jsonRequest,
  type AssetResponse,
  type Job,
  type Selection,
  type Upload,
} from "./types";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide-modal" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function UploadDialog({
  metaConfigured,
  onClose,
  onCreated,
}: {
  metaConfigured: boolean;
  onClose: () => void;
  onCreated: (v: AssetResponse) => void;
}) {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [label, setLabel] = useState("");
  const [rights, setRights] = useState(false);
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<"manual_box" | "sam" | "sam_box">("manual_box");
  const [box, setBox] = useState({ x: 5, y: 5, width: 90, height: 90 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const consentInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (
      !job ||
      [
        "completed",
        "failed",
        "failed_final",
        "failed_retryable",
        "cancelled",
      ].includes(job.status)
    )
      return;
    let cancelled = false;
    let timer: number;
    const poll = async () => {
      try {
        const next = await api<Job>(`/jobs/${job.job_id}`);
        if (cancelled) return;
        setJob(next);
        if (next.status === "completed" && next.result) {
          onCreated(next.result);
          return;
        }
        if (next.status.startsWith("failed") || next.status === "cancelled") {
          setError(
            next.error?.message ??
              "Generation stopped. Review the selection and try again.",
          );
          setBusy(false);
          return;
        }
        timer = window.setTimeout(poll, 900);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setBusy(false);
        }
      }
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job?.job_id, onCreated]);

  async function uploadFile(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("This photo exceeds 10 MB. Choose a smaller image.");
      return;
    }
    if (!rights) {
      setError("Confirm that you own this photo or have permission to use it.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      setUpload(await api<Upload>("/uploads", { method: "POST", body: form }));
      setConsent(false);
      setSelection(null);
      setJob(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function reviewSelection() {
    if (!upload) return;
    if (!label.trim()) {
      setError("Describe the object you want to turn into an asset.");
      return;
    }
    if (method !== "manual_box" && !consent) {
      setError("Allow sending your image to Meta before using SAM.");
      consentInput.current?.focus();
      return;
    }
    if (method !== "sam" && (box.x + box.width > 100 || box.y + box.height > 100)) {
      setError(
        "Keep the selection inside the image: left + width and top + height must be at most 100%.",
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      setSelection(
        await api<Selection>(
          `/uploads/${upload.upload_id}/selection`,
          jsonRequest("POST", {
            method: method === "sam_box" ? "sam" : method,
            label,
            consent,
            box: method === "sam" ? undefined : {
              x: Math.round((box.x / 100) * upload.width),
              y: Math.round((box.y / 100) * upload.height),
              width: Math.round((box.width / 100) * upload.width),
              height: Math.round((box.height / 100) * upload.height),
            },
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(mode: "manual" | "live") {
    if (!upload || !selection) return;
    if (mode === "live" && !metaConfigured) {
      setError("Meta API is not configured for this session. Set MODEL_API_KEY, restart the API, then refresh the page.");
      return;
    }
    if (mode === "live" && !consent) {
      setError("Allow sending your image to Meta to generate artwork.");
      consentInput.current?.focus();
      return;
    }
    setError("");
    setBusy(true);
    try {
      const started = await api<{ job_id: string }>(
        "/assets/generate",
        jsonRequest("POST", {
          upload_id: upload.upload_id,
          selection_id: selection.selection_id,
          label: label.trim(),
          mode,
          consent: mode === "manual" || consent,
        }),
      );
      setJob({
        ...started,
        status: "queued",
        stage: "queued",
        mode: mode === "live" ? "live" : "fallback",
        attempts: 1,
        elapsed_ms: 0,
        stages: [],
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Start with something real" onClose={onClose} wide busy={busy}>
      <div className="modal-body upload-flow">
        <p className="modal-intro">
          Bring your own photo. Choose one object, then make it portable.
        </p>
        <label className="check-label rights-label">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
            disabled={busy || !!upload}
          />
          <span>I own this photo or have permission to use it.</span>
        </label>
        {!upload ? (
          <div
            className={`dropzone ${dragging ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) void uploadFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="upload-symbol">
              <UploadCloud size={30} />
            </div>
            <h3>A photo today. A game asset next.</h3>
            <p>Drag a photo here, or choose one from your device.</p>
            <button
              className="primary-button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || !rights}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ImagePlus size={16} />
              )}
              Choose photo
            </button>
            <span>JPG, PNG, WebP · up to 10 MB · up to 24 megapixels</span>
          </div>
        ) : (
          <div className="selection-layout">
            <div>
              <div className="selection-image checkerboard">
                <img
                  src={selection?.preview_url ?? upload.preview_url}
                  width={upload.width}
                  height={upload.height}
                  alt={
                    selection
                      ? "Review the selected cutout before continuing"
                      : method === "sam"
                        ? "Uploaded image for SAM object-label selection"
                        : "Uploaded photo with selection box"
                  }
                />
                {!selection && method !== "sam" && (
                  <div
                    className="selection-box"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <span>Selected object</span>
                  </div>
                )}
              </div>
              <p className="image-caption">
                <FileImage size={14} />
                {upload.width} × {upload.height} px <span>EXIF removed</span>
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Choose a different photo
              </button>
            </div>
            <div className="selection-controls">
              <label className="field-label" htmlFor="object-label">
                What is the object?
              </label>
              <input
                id="object-label"
                name="object-label"
                maxLength={60}
                aria-describedby="sam-selection-help"
                autoComplete="off"
                placeholder="e.g. a small potted cactus…"
                value={label}
                disabled={busy}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setSelection(null);
                }}
              />
              <label className="field-label" htmlFor="selection-method">
                Selection method
              </label>
              <select
                id="selection-method"
                value={method}
                aria-describedby="sam-selection-help"
                disabled={busy}
                onChange={(e) => {
                  setMethod(e.target.value as typeof method);
                  setSelection(null);
                }}
              >
                <option value="manual_box">Manual box / crop</option>
                <option value="sam" disabled={!metaConfigured}>
                  SAM 3.1 by label {metaConfigured ? "" : "(API key required)"}
                </option>
                <option value="sam_box" disabled={!metaConfigured}>
                  SAM 3.1 by box {metaConfigured ? "" : "(API key required)"}
                </option>
              </select>
              <p className="field-hint selection-help" id="sam-selection-help">
                {method === "sam"
                  ? "Use one short object name, e.g. “mug”. To pick a specific object, choose SAM by box."
                  : method === "sam_box"
                    ? "Tighten the visible box around one object. SAM uses this box; the name labels your asset."
                    : "Manual crop keeps the original pixels and background inside the visible box."}
              </p>
              {method !== "sam" && !selection && (
                <div className="box-controls">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label key={key}>
                      {
                        {
                          x: "Left",
                          y: "Top",
                          width: "Width",
                          height: "Height",
                        }[key]
                      }{" "}
                      (%)
                      <input
                        type="number"
                        min={key === "width" || key === "height" ? 1 : 0}
                        max="100"
                        value={box[key]}
                        disabled={busy}
                        onChange={(e) =>
                          setBox({
                            ...box,
                            [key]: Math.max(
                              key === "width" || key === "height" ? 1 : 0,
                              Math.min(100, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <label className="check-label provider-consent">
                <input
                  ref={consentInput}
                  id="meta-consent"
                  name="meta-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                />
                <span>
                  Allow this image to be sent to Meta for segmentation and
                  artwork generation.
                </span>
              </label>
              {!selection ? (
                <button
                  className="primary-button full-width"
                  onClick={reviewSelection}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Scan size={16} />
                  )}
                  Review selection
                </button>
              ) : (
                <div className="selection-reviewed">
                  <span className="success-line">
                    <Check size={16} />
                    Selection ready for review
                  </span>
                  <p>
                    {selection.method === "manual_box"
                      ? "Manual crop keeps the original pixels and background. It is not AI segmentation."
                      : "Inspect the SAM mask before generating artwork."}
                  </p>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setSelection(null)}
                  >
                    Reject & change selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => void uploadFile(e.target.files?.[0])}
        />
        {selection && (
          <div className="generation-options">
            <div>
              <Sparkles size={18} />
              <div>
                <strong>Storybook toy</strong>
                <p>
                  {metaConfigured
                    ? "Muse Image artwork with SAM alpha cleanup."
                    : "Live AI requires MODEL_API_KEY on the server. Manual compilation works locally."}
                </p>
              </div>
            </div>
            <div className="generation-buttons">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void generate("manual")}
              >
                Use manual cutout
              </button>
              <button
                className="primary-button"
                disabled={busy}
                aria-describedby="generation-requirements"
                onClick={() => void generate("live")}
              >
                <Sparkles size={15} />
                Generate artwork
              </button>
            </div>
            <p className="field-hint" id="generation-requirements" role="status">
              {!metaConfigured
                ? "Live artwork needs MODEL_API_KEY on the server. Restart the API and refresh after configuring it."
                : !consent
                  ? "Before generating artwork, check “Allow this image to be sent to Meta” above. Manual cutout needs no Meta permission."
                  : "Ready to generate. Your selected image will be sent to Meta; the reviewed crop is accepted when you continue."}
            </p>
          </div>
        )}
        {job && (
          <div className="job-progress" aria-live="polite">
            <LoaderCircle size={18} className={busy ? "spin" : ""} />
            <div>
              <strong>
                {job.stage.replaceAll("_", " ")}
                {busy ? "…" : ""}
              </strong>
              <span>
                {job.mode} · Attempt {job.attempts} ·{" "}
                {Math.round(job.elapsed_ms / 1000)} s
              </span>
            </div>
          </div>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <p className="privacy-note">
          <ShieldCheck size={15} />
          Your source photo is never included in exported packs. No account
          required.
        </p>
      </div>
    </Modal>
  );
}

export function GuideDialog({
  onClose,
  metaConfigured,
}: {
  onClose: () => void;
  metaConfigured: boolean;
}) {
  return (
    <Modal title="Real things. Reusable assets." onClose={onClose}>
      <div className="modal-body">
        <p className="modal-intro">
          An asset compiler, not another image gallery. Here's the path from
          your desk to your game.
        </p>
        <div className="guide-steps">
          {[
            [
              "Bring an object",
              "Upload a photo you own. Review a SAM mask, or explicitly choose a manual box.",
            ],
            [
              "Make it yours",
              "Muse Image applies the Storybook toy style. Compare the result and adjust the origin.",
            ],
            [
              "Add honest motion",
              "Bob, pulse, and flash are procedural transforms of one sprite, not AI-generated poses.",
            ],
            [
              "Take it anywhere",
              "Download transparent PNG + JSON, motion timelines, checksums, and a four-frame atlas.",
            ],
            [
              "Prove the import",
              "Open the exported ZIP in the independent Phaser playground. No generator internals required.",
            ],
          ].map(([title, text], i) => (
            <div key={title}>
              <span>{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="honesty-note">
          <CircleHelp size={19} />
          <div>
            <strong>
              {metaConfigured
                ? "Meta API key configured"
                : "You’re in a local workspace"}
            </strong>
            <p>
              {metaConfigured
                ? "Stages are labeled live only after a real successful model call."
                : "Sample artwork is an original, locally drawn demo fixture. Add MODEL_API_KEY to enable live model requests. No live AI results are claimed."}
            </p>
          </div>
        </div>
        <button className="primary-button full-width" onClick={onClose}>
          Back to the studio
          <ArrowRight size={16} />
        </button>
        <a
          className="external-docs"
          href="https://dev.meta.ai/docs/overview"
          target="_blank"
          rel="noreferrer"
        >
          Meta Model API documentation
          <ChevronRight size={14} />
        </a>
      </div>
    </Modal>
  );
}
