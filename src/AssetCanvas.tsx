import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Grid2X2,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  Scan,
  SplitSquareHorizontal,
} from "lucide-react";
import type { AssetResponse, Motion, Timeline } from "./types";

export const motionInfo: Record<Motion, { name: string; description: string }> =
  {
    idle_bob: { name: "Idle bob", description: "A little life, on a loop." },
    interact_pulse: {
      name: "Interact pulse",
      description: "A playful response to a tap.",
    },
    impact_flash: {
      name: "Impact flash",
      description: "A quick flash of feedback.",
    },
  };

function sampleMotion(timeline: Timeline, time: number) {
  const frames = timeline.keyframes;
  const t = timeline.loop
    ? time % timeline.duration_ms
    : Math.min(time, timeline.duration_ms);
  let a = frames[0],
    b = frames[frames.length - 1];
  for (let i = 1; i < frames.length; i++)
    if (t <= frames[i].t_ms) {
      a = frames[i - 1];
      b = frames[i];
      break;
    }
  const p =
    b.t_ms === a.t_ms
      ? 0
      : Math.max(0, Math.min(1, (t - a.t_ms) / (b.t_ms - a.t_ms)));
  const mix = (x: number, y: number) => x + (y - x) * p;
  return {
    x: mix(a.translate[0], b.translate[0]),
    y: mix(a.translate[1], b.translate[1]),
    sx: mix(a.scale[0], b.scale[0]),
    sy: mix(a.scale[1], b.scale[1]),
    rotation: mix(a.rotation_deg, b.rotation_deg),
    opacity: mix(a.opacity, b.opacity),
  };
}

export default function AssetCanvas({
  data,
  motion,
  setMotion,
  enabled,
  toggleMotion,
  disabled,
}: {
  data: AssetResponse;
  motion: Motion;
  setMotion: (v: Motion) => void;
  enabled: Motion[];
  toggleMotion: (v: Motion) => void;
  disabled: boolean;
}) {
  const [compare, setCompare] = useState(false);
  const [grid, setGrid] = useState(true);
  const [bounds, setBounds] = useState(false);
  const [anchor, setAnchor] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const sprite = useRef<HTMLImageElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const timeline = data.animations.states[motion];
  const { origin, visual_bounds: bbox } = data.asset.sprite;
  useEffect(() => {
    if (!playing || compare || !timeline || !enabled.includes(motion)) {
      if (sprite.current) {
        sprite.current.style.transform = "";
        sprite.current.style.opacity = "1";
      }
      if (progress.current) progress.current.style.width = "0%";
      return;
    }
    let frame = 0;
    const start = performance.now();
    const render = (now: number) => {
      const elapsed = now - start;
      const v = sampleMotion(timeline, elapsed);
      if (sprite.current) {
        sprite.current.style.transform = `translate(${(v.x / 512) * 100}%, ${(v.y / 512) * 100}%) rotate(${v.rotation}deg) scale(${v.sx}, ${v.sy})`;
        sprite.current.style.opacity = String(v.opacity);
      }
      if (progress.current)
        progress.current.style.width = `${((timeline.loop ? elapsed % timeline.duration_ms : Math.min(elapsed, timeline.duration_ms)) / timeline.duration_ms) * 100}%`;
      if (timeline.loop || elapsed < timeline.duration_ms)
        frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [playing, compare, timeline, motion, enabled]);

  return (
    <section
      className="preview-panel"
      aria-label="Sprite preview and motion editor"
    >
      <div className="preview-heading">
        <div className="segmented">
          <button
            className={!compare ? "selected" : ""}
            onClick={() => setCompare(false)}
          >
            Sprite preview
          </button>
          <button
            className={compare ? "selected" : ""}
            onClick={() => setCompare(true)}
          >
            <SplitSquareHorizontal size={14} />
            Compare
          </button>
        </div>
        <span className="canvas-size">512 × 512 px</span>
      </div>
      <div
        className={`sprite-canvas ${grid ? "checkerboard" : "plain-canvas"} ${compare ? "compare-canvas" : ""}`}
      >
        <div className="canvas-badges">
          <span className="tiny-chip">
            <span className="green-dot" />
            {data.mode === "fixture"
              ? "Demo fixture"
              : data.mode === "live"
                ? "Generated artwork"
                : "Manual cutout"}
          </span>
          <span className="tiny-chip transparent-chip">RGBA</span>
        </div>
        {compare ? (
          <div className="comparison">
            <figure>
              <img
                src={data.source_url}
                alt="Original source illustration or uploaded photo"
                width="512"
                height="512"
              />
              <figcaption>
                Source {data.mode === "fixture" && "illustration"}
              </figcaption>
            </figure>
            <div className="compare-divider">
              <SplitSquareHorizontal size={16} />
            </div>
            <figure>
              <img
                src={data.preview_url}
                alt={`${data.asset.name} transparent sprite`}
                width="512"
                height="512"
              />
              <figcaption>
                {data.mode === "live"
                  ? "Generated artwork"
                  : "Normalized sprite"}
              </figcaption>
            </figure>
          </div>
        ) : (
          <div
            className="sprite-space"
            style={{ width: `${Math.min(96, zoom * 0.8)}%` }}
          >
            <img
              ref={sprite}
              className="hero-sprite"
              src={data.preview_url}
              alt={`${data.asset.name}, transparent 2D game asset`}
              width="512"
              height="512"
              style={{
                transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
              }}
            />
            {bounds && (
              <div
                className="bounds-overlay"
                style={{
                  left: `${(bbox.x / 512) * 100}%`,
                  top: `${(bbox.y / 512) * 100}%`,
                  width: `${(bbox.width / 512) * 100}%`,
                  height: `${(bbox.height / 512) * 100}%`,
                }}
              >
                <span>
                  {bbox.width} × {bbox.height}
                </span>
              </div>
            )}
            {anchor && (
              <div
                className="origin-cross"
                style={{
                  left: `${origin.x * 100}%`,
                  top: `${origin.y * 100}%`,
                }}
              >
                <Crosshair size={24} />
                <span>Origin</span>
              </div>
            )}
          </div>
        )}
        <div className="canvas-tools">
          <div className="tool-group">
            <button
              aria-label="Toggle checkerboard"
              aria-pressed={grid}
              className={grid ? "active" : ""}
              onClick={() => setGrid(!grid)}
            >
              <Grid2X2 size={16} />
            </button>
            <button
              aria-label="Show visual bounds"
              aria-pressed={bounds}
              className={bounds ? "active" : ""}
              onClick={() => setBounds(!bounds)}
            >
              <Scan size={17} />
            </button>
            <button
              aria-label="Show origin"
              aria-pressed={anchor}
              className={anchor ? "active" : ""}
              onClick={() => setAnchor(!anchor)}
            >
              <Crosshair size={17} />
            </button>
          </div>
          <div className="tool-group zoom-tools">
            <button
              aria-label="Zoom out"
              disabled={zoom <= 50}
              onClick={() => setZoom(Math.max(50, zoom - 25))}
            >
              <Minus size={15} />
            </button>
            <span>{zoom}%</span>
            <button
              aria-label="Zoom in"
              disabled={zoom >= 150}
              onClick={() => setZoom(Math.min(150, zoom + 25))}
            >
              <Plus size={15} />
            </button>
            <button aria-label="Reset zoom" onClick={() => setZoom(100)}>
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="motion-editor">
        <div className="section-heading">
          <h3>Give it a little motion</h3>
          <span className="subtle-label">Procedural, not new poses</span>
        </div>
        <div className="motion-options">
          {(Object.keys(motionInfo) as Motion[]).map((id, i) => (
            <div
              key={id}
              className={`motion-option ${motion === id && enabled.includes(id) ? "chosen" : ""}`}
            >
              <button
                className="motion-choice"
                disabled={disabled}
                onClick={() => {
                  if (!enabled.includes(id)) toggleMotion(id);
                  setMotion(id);
                  setPlaying(true);
                }}
                aria-pressed={motion === id && enabled.includes(id)}
              >
                <span className={`motion-glyph glyph-${i}`} aria-hidden="true">
                  {i === 0 ? "↕" : i === 1 ? "◎" : "✦"}
                </span>
                <span>{motionInfo[id].name}</span>
              </button>
              <input
                aria-label={`Include ${motionInfo[id].name} in export`}
                type="checkbox"
                checked={enabled.includes(id)}
                disabled={disabled}
                onChange={() => toggleMotion(id)}
              />
            </div>
          ))}
        </div>
        <div className="playback">
          <button
            className="play-button"
            aria-label={playing ? "Pause motion" : "Play motion"}
            onClick={() => setPlaying(!playing)}
            disabled={!enabled.includes(motion)}
          >
            {playing ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
          </button>
          <span className="motion-state">
            {enabled.includes(motion)
              ? motionInfo[motion].name
              : "Static sprite"}
          </span>
          <div className="timeline-track">
            <div ref={progress} />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="timeline-duration">
            {timeline?.duration_ms ?? 0} ms
          </span>
          <span
            className="loop-symbol"
            title={timeline?.loop ? "Looping motion" : "One-shot motion"}
          >
            {timeline?.loop ? "↻" : "1×"}
          </span>
        </div>
      </div>
    </section>
  );
}
