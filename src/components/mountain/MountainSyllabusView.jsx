// FILE: src/components/mountain/MountainSyllabusView.jsx
import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState
} from 'react';
import NotebookPage from '../../NotebookPage';
import MountainIslandPopup from './MountainIslandPopup';
import GlitchCatMini from './GlitchCatMini';
import {
  prepareNightMountainTheme,
  finalizeNightMountainTheme,
  getMountainChunkCount,
  getMountainZoom,
  getMountainScrollX,
  lockMountainScroll,
  scrollMountainRange
} from '../../engine/mountainColorizer';
import '../../styles/MountainSyllabus.css';

const MOUNTAIN_SCALE = 0.76;
const ROAD_SPACING = 460;
const REACH = 55;
const SNAP = 45;
const MAX_STEP = 38;
const FRICTION = 0.86;
const MAX_FLICK = 14;
const PAGE_STEP = 90;
const WINDOW = 2;
const SHAN_SHUI_SYNC_MS = 110;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(v, 0, 1);

const nodePos = (r, i) => (i - r.anchor) * ROAD_SPACING;

const roadBounds = (r, n) => ({
  min: nodePos(r, 0) - ROAD_SPACING * 0.5,
  max: nodePos(r, Math.max(0, n - 1)) + ROAD_SPACING * 0.5
});

const nodeYFrac = (i) => {
  const s = Math.sin(i * 78.233) * 43758.5453;
  return 0.42 + (s - Math.floor(s)) * 0.26;
};

function makeMountainInteriorPureBlack(win) {
  try {
    const doc = win?.document;
    if (!doc || !doc.head) return;

    if (!doc.getElementById('suru-pure-black-mountain-v2')) {
      const style = doc.createElement('style');
      style.id = 'suru-pure-black-mountain-v2';
      style.textContent = `
        html, body, svg, #BG, rect {
          background: #000000 !important;
          background-color: #000000 !important;
        }
        svg path, svg polygon, svg rect, svg circle {
          fill: #000000 !important;
        }
      `;
      doc.head.appendChild(style);
    }

    const elements = doc.querySelectorAll('svg polygon, svg path, svg rect, svg circle');
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.tagName.toLowerCase() !== 'text') {
        el.setAttribute('fill', '#000000');
        if (el.style) el.style.setProperty('fill', '#000000', 'important');
      }
    }
  } catch {
    // ignore
  }
}

export default function MountainSyllabusView({
  stage,
  setStage,
  topics = [],
  activeTopic,
  onSelectTopic,
  currentMode,
  onToggleMode,
  allModeData,
  simpleData,
  immersiveNotes,
  setImmersiveNotes,
  readerFontSize,
  setReaderFontSize
}) {
  const stageElRef = useRef(null);
  const iframeRef = useRef(null);
  const canvasLayerRef = useRef(null);
  const nodeEls = useRef({});
  const readyTimer = useRef(null);
  const alive = useRef(true);
  const pinchStartDist = useRef(null);
  const pinchLocked = useRef(false);
  const touchLast = useRef(null);

  const road = useRef({
    pos: 0,
    target: 0,
    vel: 0,
    flick: 0,
    sent: 0,
    lastIframeSync: 0,
    base: null,
    k: 1,
    kCal: false,
    trustMem: true,
    anchor: 0,
    zoom: 1.142,
    dragging: false,
    snapPending: false,
    userMoved: false,
    lastInteract: 0,
    lastMoveT: 0,
    lastSelectT: 0,
    raf: 0,
    ready: false,
    selected: -1,
    reached: -1,
    nearest: -1
  });

  const [ready, setReady] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [nearIdx, setNearIdx] = useState(0);

  const safeTopics = topics.length > 0 ? topics : [];
  const currentIndex = activeTopic
    ? Math.max(0, safeTopics.findIndex((t) => t.id === activeTopic.id))
    : 0;
  const resolvedTopic = safeTopics[currentIndex] || activeTopic || safeTopics[0];

  const topicsRef = useRef(safeTopics);
  topicsRef.current = safeTopics;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const onSelectRef = useRef(onSelectTopic);
  onSelectRef.current = onSelectTopic;
  const setStageRef = useRef(setStage);
  setStageRef.current = setStage;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const layoutNodes = useCallback(() => {
    const stageEl = stageElRef.current;
    if (!stageEl) return;
    const r = road.current;
    const W = stageEl.clientWidth;
    const H = stageEl.clientHeight;
    const ppu = r.zoom * MOUNTAIN_SCALE;

    Object.keys(nodeEls.current).forEach((key) => {
      const el = nodeEls.current[key];
      if (!el) return;
      const idx = Number(key);
      const dx = (nodePos(r, idx) - r.pos) * ppu;
      const k = clamp01((0.46 * W - Math.abs(dx)) / (0.26 * W));
      const y = H * nodeYFrac(idx);
      el.style.transform = `translate3d(${(W / 2 + dx).toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(0.6 + 0.4 * k).toFixed(3)})`;
      el.style.opacity = k.toFixed(3);
      el.style.pointerEvents = k > 0.55 ? 'auto' : 'none';
    });
  }, []);

  const tick = useCallback(() => {
    const r = road.current;
    r.raf = 0;
    const topicsNow = topicsRef.current;
    const n = topicsNow.length;
    if (!r.ready || n === 0) return;

    const { min, max } = roadBounds(r, n);
    const now = performance.now();
    let busy = false;

    if (!r.dragging) {
      if (Math.abs(r.vel) > 0.12) {
        r.target = clamp(r.target + r.vel, min, max);
        r.vel *= FRICTION;
        if (r.target === min || r.target === max) r.vel = 0;
        busy = true;
      } else {
        r.vel = 0;
      }
    }

    if (!r.dragging && r.vel === 0 && r.snapPending) {
      if (now - r.lastInteract > 110) {
        r.snapPending = false;
        const idx = clamp(Math.round(r.target / ROAD_SPACING + r.anchor), 0, n - 1);
        if (Math.abs(nodePos(r, idx) - r.target) < SNAP) r.target = nodePos(r, idx);
      }
      busy = true;
    }

    const diff = r.target - r.pos;
    if (Math.abs(diff) > 0.02) {
      r.pos += clamp(diff * 0.28, -MAX_STEP, MAX_STEP);
      busy = true;
    } else {
      r.pos = r.target;
    }

    const win = iframeRef.current && iframeRef.current.contentWindow;
    const want = r.pos - r.sent;
    const shouldSyncIframe =
      win &&
      Math.abs(want) >= 1.5 &&
      (now - r.lastIframeSync >= SHAN_SHUI_SYNC_MS || !busy);

    if (shouldSyncIframe) {
      r.lastIframeSync = now;
      const req = want / r.k;
      const moved = scrollMountainRange(win, req);
      makeMountainInteriorPureBlack(win);
      if (!r.kCal && Math.abs(req) >= 2) {
        r.kCal = true;
        if (r.base === null || Math.abs(moved) < 1e-6) {
          r.trustMem = false;
        } else {
          const k = moved / req;
          if (isFinite(k) && k > 0.2 && k < 5) r.k = k;
        }
      }
      r.sent += r.trustMem ? moved : req * r.k;
    }

    if (canvasLayerRef.current) {
      const unsentPx = (r.pos - r.sent) * r.zoom * MOUNTAIN_SCALE * 0.35;
      canvasLayerRef.current.style.transform = `translate3d(${(-unsentPx).toFixed(1)}px, 0, 0)`;
    }

    layoutNodes();

    const idx = clamp(Math.round(r.pos / ROAD_SPACING + r.anchor), 0, n - 1);
    const reached = Math.abs(nodePos(r, idx) - r.pos) <= REACH ? idx : -1;

    if (idx !== r.nearest) {
      r.nearest = idx;
      setNearIdx(idx);
    }
    if (reached !== r.reached) {
      r.reached = reached;
      setActiveIdx(reached);
    }

    const st = stageRef.current;
    if (st !== 'page' && reached >= 0 && reached !== r.selected) {
      r.selected = reached;
      r.lastSelectT = now;
      if (onSelectRef.current) onSelectRef.current(topicsNow[reached]);
    }
    if (st === 'pill' && reached === -1 && r.userMoved) {
      setStageRef.current('dots');
    }

    if (busy) r.raf = requestAnimationFrame(tick);
  }, [layoutNodes]);

  const kick = useCallback(() => {
    const r = road.current;
    if (!r.raf && r.ready) r.raf = requestAnimationFrame(tick);
  }, [tick]);

  const handleIframeLoad = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    const r = road.current;
    r.ready = false;
    setReady(false);

    let tries = 0;
    let lastCount = -2;
    let stableTicks = 0;

    const reveal = () => {
      if (!alive.current) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      const n = topicsRef.current.length;
      r.zoom = getMountainZoom(win);
      lockMountainScroll(win);
      makeMountainInteriorPureBlack(win);
      r.base = getMountainScrollX(win);
      r.k = 1;
      r.kCal = false;
      r.trustMem = r.base !== null;
      r.anchor = clamp(currentIndexRef.current, 0, Math.max(0, n - 1));
      r.pos = 0;
      r.target = 0;
      r.sent = 0;
      r.vel = 0;
      r.flick = 0;
      r.selected = r.anchor;
      r.reached = r.anchor;
      r.nearest = r.anchor;
      r.ready = true;
      setActiveIdx(r.anchor);
      setNearIdx(r.anchor);
      setReady(true);
    };

    const poll = () => {
      if (!alive.current) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (!win) return;
      tries += 1;

      try {
        prepareNightMountainTheme(win);
        makeMountainInteriorPureBlack(win);
      } catch {
        /* wait */
      }

      const count = getMountainChunkCount(win);
      if (count > 0 && count === lastCount) stableTicks += 1;
      else stableTicks = 0;
      lastCount = count;

      const hasMem = count !== -1;
      const done =
        (hasMem && stableTicks >= 2) ||
        (!hasMem && tries >= 8) ||
        tries >= 35;

      if (!done) {
        readyTimer.current = setTimeout(poll, 80);
        return;
      }

      try {
        finalizeNightMountainTheme(win);
        makeMountainInteriorPureBlack(win);
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => {
        makeMountainInteriorPureBlack(win);
        readyTimer.current = setTimeout(reveal, 60);
      });
    };

    poll();
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (readyTimer.current) clearTimeout(readyTimer.current);
      const r = road.current;
      if (r.raf) cancelAnimationFrame(r.raf);
      r.raf = 0;
    };
  }, []);

  useEffect(() => {
    const onResize = () => layoutNodes();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layoutNodes]);

  useLayoutEffect(() => {
    layoutNodes();
  }, [ready, nearIdx, activeIdx, stage, safeTopics.length, layoutNodes]);

  const goToIndex = useCallback(
    (idx) => {
      const r = road.current;
      const list = topicsRef.current;
      if (!r.ready || idx < 0 || idx >= list.length) return;
      r.vel = 0;
      r.snapPending = false;

      if (stageRef.current === 'page') {
        const dir = idx > currentIndexRef.current ? 1 : -1;
        const P = r.target + dir * PAGE_STEP;
        r.anchor = idx - P / ROAD_SPACING;
        r.target = P;
        r.selected = idx;
        r.lastSelectT = performance.now();
        if (onSelectRef.current) onSelectRef.current(list[idx]);
      } else {
        r.target = nodePos(r, idx);
      }
      kick();
    },
    [kick]
  );

  const handleTouchStart = (e) => {
    const r = road.current;
    if (e.touches.length === 2) {
      pinchLocked.current = false;
      r.dragging = false;
      touchLast.current = null;
      pinchStartDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && stage !== 'page' && r.ready) {
      touchLast.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      r.dragging = true;
      r.vel = 0;
      r.flick = 0;
      r.snapPending = false;
      r.lastMoveT = performance.now();
    }
  };

  const handleTouchMove = (e) => {
    const r = road.current;

    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - pinchStartDist.current;

      if (stage === 'page') {
        if (Math.abs(delta) > 10) {
          setReaderFontSize((prev) =>
            Number(Math.min(Math.max(0.75, prev + (delta > 0 ? 0.04 : -0.04)), 2.2).toFixed(2))
          );
          pinchStartDist.current = dist;
        }
      } else if (!pinchLocked.current) {
        if (delta > 45) {
          pinchLocked.current = true;
          setStage((prev) => (prev === 'dots' ? 'pill' : 'page'));
        } else if (delta < -45 && stage === 'pill') {
          pinchLocked.current = true;
          setStage('dots');
        }
      }
      return;
    }

    if (e.touches.length === 1 && stage !== 'page' && r.dragging && touchLast.current) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const d = touchLast.current.x - x + (touchLast.current.y - y);
      touchLast.current = { x, y };

      const du = d / (r.zoom * MOUNTAIN_SCALE);
      const { min, max } = roadBounds(r, topicsRef.current.length);
      r.target = clamp(r.target + du, min, max);
      r.flick = r.flick * 0.5 + du * 0.5;
      r.lastMoveT = performance.now();
      r.userMoved = true;
      kick();
    }
  };

  const handleTouchEnd = () => {
    const r = road.current;
    pinchStartDist.current = null;
    pinchLocked.current = false;
    touchLast.current = null;

    if (r.dragging) {
      r.dragging = false;
      const stillMoving = performance.now() - r.lastMoveT < 90;
      r.vel = stillMoving ? clamp(r.flick * 0.9, -MAX_FLICK, MAX_FLICK) : 0;
      r.flick = 0;
      r.snapPending = true;
      r.lastInteract = performance.now();
      kick();
    }
  };

  const basePayload =
    (resolvedTopic && (simpleData?.[resolvedTopic.id] || allModeData?.suru?.[resolvedTopic.id])) || {
      text: `## ${resolvedTopic?.title || 'Note'}\n\nSyllabus unit ready.`,
      glossary: {}
    };

  const activeModePayload =
    resolvedTopic && allModeData?.[currentMode]?.[resolvedTopic.id]
      ? allModeData[currentMode][resolvedTopic.id]
      : basePayload;

  const visibleIdx = [];
  if (ready && safeTopics.length > 0) {
    const from = Math.max(0, nearIdx - WINDOW);
    const to = Math.min(safeTopics.length - 1, nearIdx + WINDOW);
    for (let i = from; i <= to; i++) visibleIdx.push(i);
  }

  return (
    <div
      ref={stageElRef}
      className={`mountain-syllabus-stage stage-${stage} ${
        immersiveNotes ? 'is-immersive-dark' : ''
      }`}
      style={{ '--mtn-scale': MOUNTAIN_SCALE, background: '#000000' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={canvasLayerRef}
        className="mountain-canvas-layer"
        style={{ willChange: 'transform', background: '#000000' }}
      >
        <iframe
          ref={iframeRef}
          src="/shan-shui.html"
          title="Shan Shui Mountains"
          className={`shan-shui-iframe ${ready ? 'is-ready' : ''}`}
          allowTransparency="true"
          style={{ pointerEvents: 'none', background: '#000000' }}
          onLoad={handleIframeLoad}
        />
      </div>

      <div className="mountain-top-fade" />

      {!ready && (
        <div className="mountain-loading">
          <GlitchCatMini state="processing" size={34} />
        </div>
      )}

      {ready && stage !== 'page' && (
        <div className="mountain-nodes-layer">
          {visibleIdx.map((idx) => {
            const topic = safeTopics[idx];
            const isActive = idx === activeIdx;
            return (
              <div
                key={topic.id}
                className="mountain-road-node"
                style={{ opacity: 0 }}
                ref={(el) => {
                  if (el) nodeEls.current[idx] = el;
                  else delete nodeEls.current[idx];
                }}
              >
                <MountainIslandPopup
                  topic={topic}
                  stage={isActive && stage === 'pill' ? 'pill' : 'dots'}
                  isPrimary={isActive}
                  offsetStyle={{
                    top: 0,
                    left: 0,
                    transform: 'translate3d(-50%, -50%, 0)'
                  }}
                  onTapDot={() => {
                    if (isActive) setStage('pill');
                    else goToIndex(idx);
                  }}
                  onTapPill={() => setStage('page')}
                />
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`mountain-notebook-glass-sheet ${
          stage === 'page' ? 'is-open' : ''
        } ${immersiveNotes ? 'is-immersive-black' : ''}`}
        onDoubleClick={() => {
          if (stage === 'page') setImmersiveNotes((prev) => !prev);
        }}
        style={{ fontSize: `${readerFontSize}rem` }}
      >
        {stage === 'page' && resolvedTopic && (
          <div className="full-page-container mountain-page-inner">
            <div className="full-page-header-row">
              <div>
                <h1 className="full-page-title">{resolvedTopic.title}</h1>
                {!immersiveNotes && (
                  <p className="full-page-sub">{resolvedTopic.subtitle}</p>
                )}
              </div>

              {!immersiveNotes && (
                <div className="subtle-mode-wrap">
                  <button
                    type="button"
                    className="uni-btn subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMode();
                    }}
                  >
                    {currentMode}
                  </button>
                </div>
              )}
            </div>

            <NotebookPage
              topicId={resolvedTopic.id}
              topicData={activeModePayload}
              hasPrevTopic={currentIndex > 0}
              hasNextTopic={currentIndex < safeTopics.length - 1}
              onPrevTopic={() => goToIndex(currentIndex - 1)}
              onNextTopic={() => goToIndex(currentIndex + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
