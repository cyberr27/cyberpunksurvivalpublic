(function () {
  "use strict";

  const TARGET_WORLD_ID = 0;
  const DEFAULT_BUILDING_ID = "sector12-corp";

  const BUILDING_MODULES = Object.freeze({
    "sector12-corp": "sector12Corp3D",
    "neon-citadel": "neonCitadel3D",
    "s12-industrial-complex": "s12IndustrialComplex3D",
    "s12-defense-headquarters": "s12DefenseHeadquarters3D",
    "s12-guild-of-masters": "s12GuildOfMasters3D",
    "s12-shop": "s12Shop3D",
    "s12-bank": "s12Bank3D",
    "s12-arena": "s12Arena3D",
    "s12-medcore": "s12Medcore3D",
  });

  const state = {
    enabled: false,
    selectedBuildingId: DEFAULT_BUILDING_ID,
    drafts: new Map(),
    points: [],
    closed: false,
    publishedBarrierSegments: [],
    savedPlacements: new Map(),
    dirtyBuildings: new Set(),
    pendingBuildingId: null,
    serverRevision: null,
    serverReady: false,

    existingBarriersMode: "all",
    scaleAxis: "x",
  };

  const canvas = document.getElementById("game3DCanvas");

  function getBuildings() {
    return (
      window.staticGeometrySystem
        ?.getGeometryForWorld?.(TARGET_WORLD_ID)
        ?.filter((item) => item.type === "model") ?? []
    );
  }

  function getSelectedBuilding() {
    return (
      window.staticGeometrySystem?.getById?.(
        state.selectedBuildingId,
        TARGET_WORLD_ID,
      ) ?? null
    );
  }

  function getBuildingModule(id) {
    const moduleName = BUILDING_MODULES[id];
    const module = moduleName ? window[moduleName] : null;

    return module?.getPlacement && module?.setPlacement ? module : null;
  }

  function selectBuilding(id) {
    if (!state.enabled || !isAvailable()) return false;

    if (state.pendingBuildingId !== null) return false;

    if (
      id !== state.selectedBuildingId &&
      state.dirtyBuildings.has(state.selectedBuildingId)
    ) {
      console.warn("[FoundationEditor3D] Apply or revert placement first.");
      return false;
    }

    const descriptor = window.staticGeometrySystem?.getById?.(
      id,
      TARGET_WORLD_ID,
    );

    if (!descriptor || descriptor.type !== "model") return false;

    state.drafts.set(state.selectedBuildingId, {
      points: state.points.map((point) => ({ ...point })),
      closed: state.closed,
    });

    state.selectedBuildingId = id;

    const draft = state.drafts.get(id);

    state.points = draft ? draft.points.map((point) => ({ ...point })) : [];

    state.closed = draft?.closed === true;

    syncBarrierDraft();

    window.dispatchEvent(
      new CustomEvent("foundationEditor3DSelectionChanged", {
        detail: { id },
      }),
    );

    return true;
  }

  function isAvailable() {
    return (
      window.rendererSystem?.is3D?.() === true &&
      window.worldSystem?.currentWorldId === TARGET_WORLD_ID
    );
  }

  function setEnabled(enabled) {
    if (enabled && !isAvailable()) {
      console.warn("[FoundationEditor3D] Switch to 3D in world 0 first.");
      return false;
    }

    state.enabled = Boolean(enabled);
    if (state.enabled && !getSelectedBuilding()) {
      state.selectedBuildingId = getBuildings()[0]?.id ?? DEFAULT_BUILDING_ID;
    }

    window.dispatchEvent(
      new CustomEvent("foundationEditor3DToggled", {
        detail: { enabled: state.enabled },
      }),
    );
    console.log(`[FoundationEditor3D] ${state.enabled ? "ON" : "OFF"}`);

    return true;
  }

  function addPoint(x, y) {
    if (
      !state.enabled ||
      state.closed ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return false;
    }

    if (x < 0 || y < 0 || x > 4096 || y > 4096) {
      return false;
    }

    const point = {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };

    const previous = state.points.at(-1);

    if (
      previous &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < 1
    ) {
      return false;
    }

    state.points.push(point);
    syncBarrierDraft();

    console.log(`[FoundationEditor3D] Point ${state.points.length}:`, point);

    return true;
  }

  function undo() {
    if (!state.enabled) return false;

    if (state.closed) {
      state.closed = false;
      syncBarrierDraft();
      return true;
    }

    if (state.points.length === 0) return false;

    state.points.pop();
    syncBarrierDraft();
    return true;
  }

  function close() {
    if (!state.enabled || state.points.length < 3) {
      console.warn("[FoundationEditor3D] At least 3 points required.");
      return false;
    }

    const points = state.points;
    let twiceArea = 0;

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }

    if (Math.abs(twiceArea) < 1) {
      console.warn("[FoundationEditor3D] Degenerate polygon.");
      return false;
    }

    state.closed = true;
    syncBarrierDraft();

    console.log("[FoundationEditor3D] Contour closed.");
    return true;
  }

  function clear() {
    if (!state.enabled) return false;

    state.points.length = 0;
    state.closed = false;
    syncBarrierDraft();
    return true;
  }

  function getSegments() {
    const segments = [];

    for (let i = 1; i < state.points.length; i++) {
      segments.push({
        x1: state.points[i - 1].x,
        y1: state.points[i - 1].y,
        x2: state.points[i].x,
        y2: state.points[i].y,
      });
    }

    if (state.closed && state.points.length >= 3) {
      const first = state.points[0];
      const last = state.points[state.points.length - 1];

      segments.push({
        x1: last.x,
        y1: last.y,
        x2: first.x,
        y2: first.y,
      });
    }

    return segments;
  }

  function syncBarrierDraft() {
    const barriersSystem = window.barriersSystem;

    if (
      !barriersSystem ||
      !Number.isSafeInteger(TARGET_WORLD_ID) ||
      typeof barriersSystem.getLocalDraftForWorld !== "function" ||
      typeof barriersSystem.setLocalDraftForWorld !== "function"
    ) {
      return false;
    }

    const previous = new Set(
      state.publishedBarrierSegments.map((segment) =>
        barriersSystem.barrierIdentity(segment),
      ),
    );

    const existingDraft = barriersSystem
      .getLocalDraftForWorld(TARGET_WORLD_ID)
      .filter(
        (segment) => !previous.has(barriersSystem.barrierIdentity(segment)),
      );

    const nextSegments = getSegments();

    const identities = new Set(
      existingDraft.map((segment) => barriersSystem.barrierIdentity(segment)),
    );

    for (const segment of nextSegments) {
      const identity = barriersSystem.barrierIdentity(segment);

      if (identities.has(identity)) continue;

      identities.add(identity);
      existingDraft.push(segment);
    }

    barriersSystem.setLocalDraftForWorld(TARGET_WORLD_ID, existingDraft);

    state.publishedBarrierSegments = nextSegments.map((segment) => ({
      ...segment,
    }));

    window.dispatchEvent(
      new CustomEvent("foundationEditor3DBarriersChanged", {
        detail: {
          worldId: TARGET_WORLD_ID,
          count: nextSegments.length,
        },
      }),
    );

    return true;
  }

  function exportContour() {
    if (!state.closed || state.points.length < 3) {
      console.warn("[FoundationEditor3D] Close the contour before export.");
      return null;
    }

    const result = {
      id: state.selectedBuildingId,
      worldId: TARGET_WORLD_ID,
      points: state.points.map((p) => ({ ...p })),
      barriers: getSegments(),
    };

    const json = JSON.stringify(result, null, 2);

    console.log("=== SECTOR 12 FOUNDATION ===");
    console.log(json);

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).catch((error) => {
        console.warn("[FoundationEditor3D] Clipboard failed:", error);
      });
    }

    return result;
  }

  const BARRIER_VIEW_MODES = Object.freeze(["local", "all", "off"]);

  // Только идентификаторы существующих серверных сегментов.
  // Никаких новых препятствий эти данные не создают.
  const SECTOR12_BARRIER_KEYS = new Set([
    "2239,1960|2862,2378",
    "2240,1960|2892,1620",
    "2891,1620|3465,1987",
    "2917,2374|3465,1987",
    "2861,2378|2921,2374",
  ]);

  function getBarrierIdentity(barrier) {
    const a = `${barrier.x1},${barrier.y1}`;
    const b = `${barrier.x2},${barrier.y2}`;

    // Порядок концов отрезка не влияет на идентификатор.
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function isSector12Barrier(barrier) {
    return SECTOR12_BARRIER_KEYS.has(getBarrierIdentity(barrier));
  }

  function getExistingBarriers() {
    if (!state.enabled || !isAvailable()) {
      return [];
    }

    const mode = state.existingBarriersMode;

    if (mode === "off") {
      return [];
    }

    const barriersSystem = window.barriersSystem;

    if (typeof barriersSystem?.getBarriersForCurrentWorld !== "function") {
      return [];
    }

    const source = barriersSystem.getBarriersForCurrentWorld();

    if (!Array.isArray(source)) {
      return [];
    }

    const result = [];

    for (const barrier of source) {
      if (
        !barrier ||
        !Number.isFinite(barrier.x1) ||
        !Number.isFinite(barrier.y1) ||
        !Number.isFinite(barrier.x2) ||
        !Number.isFinite(barrier.y2)
      ) {
        continue;
      }

      if (mode === "local" && !isSector12Barrier(barrier)) {
        continue;
      }

      // Только копия серверно-синхронизированных координат.
      result.push({
        x1: barrier.x1,
        y1: barrier.y1,
        x2: barrier.x2,
        y2: barrier.y2,
      });
    }

    return result;
  }

  function toggleExistingBarriers() {
    if (!state.enabled || !isAvailable()) {
      return false;
    }

    const currentIndex = BARRIER_VIEW_MODES.indexOf(state.existingBarriersMode);

    const nextIndex = (currentIndex + 1) % BARRIER_VIEW_MODES.length;

    state.existingBarriersMode = BARRIER_VIEW_MODES[nextIndex];

    console.log(
      "[FoundationEditor3D] Barrier view:",
      state.existingBarriersMode,
    );

    return state.existingBarriersMode;
  }

  function getExistingBarriersMode() {
    return state.existingBarriersMode;
  }

  function getRenderData() {
    if (!state.enabled || !isAvailable()) {
      return null;
    }

    return {
      // Новый контур, нарисованный в 3D.
      points: state.points.map((p) => ({ ...p })),
      segments: getSegments(),
      closed: state.closed,

      // Существующие препятствия мира.
      existingBarriers: getExistingBarriers(),

      existingBarriersMode: state.existingBarriersMode,
    };
  }

  function handlePointerDown(event) {
    if (!state.enabled || !isAvailable()) return;
    if (event.button !== 0) return;

    // Не даём клику редактора запустить движение или атаку.
    event.preventDefault();
    event.stopImmediatePropagation();

    const position = window.rendererSystem?.screenToWorld?.(
      event.clientX,
      event.clientY,
    );

    if (!position) return;

    addPoint(position.x, position.y);
  }

  // ============================================================
  // SECTOR 12 CORP — 360° ROTATION EDITOR
  // ============================================================

  const ROTATION_STEP_DEGREES = 5;
  const PRECISE_ROTATION_STEP_DEGREES = 1;

  function normalizeAngleDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  function setBuildingRotationDegrees(degrees) {
    if (!state.enabled || !isAvailable()) return false;
    if (!Number.isFinite(degrees)) return false;

    const building = getBuildingModule(state.selectedBuildingId);

    if (!building) {
      console.warn(
        "[FoundationEditor3D] Rotation API unavailable:",
        state.selectedBuildingId,
      );
      return false;
    }

    const normalized = normalizeAngleDegrees(degrees);

    return changePlacement({
      rotation: (normalized * Math.PI) / 180,
    });
  }

  function rotateBuildingDegrees(deltaDegrees) {
    if (!Number.isFinite(deltaDegrees)) return false;

    const building = getBuildingModule(state.selectedBuildingId);
    const placement = building?.getPlacement?.();

    if (!placement || !Number.isFinite(placement.rotation)) {
      return false;
    }

    const currentDegrees = (placement.rotation * 180) / Math.PI;

    return setBuildingRotationDegrees(currentDegrees + deltaDegrees);
  }

  const PLACEMENT_FIELDS = Object.freeze([
    "x",
    "y",
    "rotation",
    "scale",
    "scaleX",
    "scaleY",
    "scaleZ",
    "baseHeight",
  ]);

  function copyPlacement(value) {
    if (!value) return null;

    const result = {};

    for (const key of PLACEMENT_FIELDS) {
      const fieldValue =
        (key === "scaleX" || key === "scaleY" || key === "scaleZ") &&
        value[key] === undefined
          ? value.scale
          : value[key];

      if (!Number.isFinite(fieldValue)) return null;

      result[key] = fieldValue;
    }

    return result;
  }

  function samePlacement(a, b) {
    return Boolean(
      a && b && PLACEMENT_FIELDS.every((key) => a[key] === b[key]),
    );
  }

  function notifyPlacementChanged() {
    window.dispatchEvent(
      new CustomEvent("foundationEditor3DPlacementChanged", {
        detail: {
          id: state.selectedBuildingId,
          dirty: state.dirtyBuildings.has(state.selectedBuildingId),
          pending: state.pendingBuildingId !== null,
        },
      }),
    );
  }

  function refreshDirty(id) {
    const module = getBuildingModule(id);
    const current = copyPlacement(module?.getPlacement?.());
    const saved = state.savedPlacements.get(id);

    if (!current || !saved) return false;

    if (samePlacement(current, saved)) {
      state.dirtyBuildings.delete(id);
    } else {
      state.dirtyBuildings.add(id);
    }

    notifyPlacementChanged();
    return true;
  }

  function changePlacement(changes) {
    if (
      !state.enabled ||
      !isAvailable() ||
      !state.serverReady ||
      state.pendingBuildingId !== null
    ) {
      return false;
    }

    const id = state.selectedBuildingId;
    const module = getBuildingModule(id);

    if (!module) return false;

    if (module.setPlacement(changes) !== true) return false;

    refreshDirty(id);
    return true;
  }

  function moveSelectedBuilding(deltaX, deltaY) {
    const placement = getBuildingModule(
      state.selectedBuildingId,
    )?.getPlacement?.();

    if (!placement || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      return false;
    }

    const x = Math.round((placement.x + deltaX) * 100) / 100;
    const y = Math.round((placement.y + deltaY) * 100) / 100;

    if (x < 0 || x > 4096 || y < 0 || y > 4096) {
      return false;
    }

    return changePlacement({ x, y });
  }

  function scaleSelectedBuilding(delta) {
    const placement = getBuildingModule(
      state.selectedBuildingId,
    )?.getPlacement?.();

    if (!placement || !Number.isFinite(delta)) return false;

    const scale = placement.scale + delta;

    if (scale < 1 || scale > 5000) return false;

    return changePlacement({ scale });
  }

  function scaleSelectedBuildingAxis(axis, delta) {
    const field = {
      x: "scaleX",
      y: "scaleY",
      z: "scaleZ",
    }[axis];

    if (!field || !Number.isFinite(delta)) return false;

    const placement = getBuildingModule(
      state.selectedBuildingId,
    )?.getPlacement?.();

    if (!placement) return false;

    const current = Number.isFinite(placement[field])
      ? placement[field]
      : placement.scale;

    const next = current + delta;

    if (!Number.isFinite(next) || next < 1 || next > 5000) {
      return false;
    }

    return changePlacement({ [field]: next });
  }

  function applyServerSnapshot(snapshot) {
    if (
      !snapshot ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !snapshot.worlds ||
      typeof snapshot.worlds !== "object"
    ) {
      return false;
    }

    if (state.serverReady && snapshot.revision < state.serverRevision) {
      return false;
    }

    const entries = snapshot.worlds["0"] || {};

    for (const id of Object.keys(BUILDING_MODULES)) {
      if (state.savedPlacements.has(id)) continue;

      const placement = copyPlacement(getBuildingModule(id)?.getPlacement?.());

      if (placement) {
        state.savedPlacements.set(id, placement);
      }
    }

    for (const [id, value] of Object.entries(entries)) {
      const module = getBuildingModule(id);
      const placement = copyPlacement(value);

      if (!module || !placement) continue;

      state.savedPlacements.set(id, placement);

      if (state.dirtyBuildings.has(id) || state.pendingBuildingId === id) {
        continue;
      }

      module.setPlacement(placement);
    }

    state.serverRevision = snapshot.revision;
    state.serverReady = true;
    notifyPlacementChanged();
    return true;
  }

  function applyServerUpdate(update) {
    if (
      !update ||
      update.worldId !== TARGET_WORLD_ID ||
      !Number.isSafeInteger(update.revision) ||
      update.revision < 0
    ) {
      return false;
    }

    if (state.serverReady && update.revision <= state.serverRevision) {
      return false;
    }

    if (state.serverReady && update.revision !== state.serverRevision + 1) {
      state.serverReady = false;
      notifyPlacementChanged();
      return false;
    }

    const module = getBuildingModule(update.buildingId);
    const placement = copyPlacement(update.placement);

    if (!module || !placement) return false;

    state.savedPlacements.set(update.buildingId, placement);
    state.serverRevision = update.revision;
    state.serverReady = true;

    if (
      !state.dirtyBuildings.has(update.buildingId) &&
      state.pendingBuildingId !== update.buildingId
    ) {
      module.setPlacement(placement);
    }

    notifyPlacementChanged();
    return true;
  }

  function getSaveState() {
    return {
      ready: state.serverReady,
      revision: state.serverRevision,
      dirty: state.dirtyBuildings.has(state.selectedBuildingId),
      pending: state.pendingBuildingId !== null,
      selectedBuildingId: state.selectedBuildingId,
    };
  }

  function beginApply() {
    if (
      !state.enabled ||
      !state.serverReady ||
      state.pendingBuildingId !== null ||
      !state.dirtyBuildings.has(state.selectedBuildingId)
    ) {
      return null;
    }

    const buildingId = state.selectedBuildingId;
    const placement = copyPlacement(
      getBuildingModule(buildingId)?.getPlacement?.(),
    );

    if (!placement) return null;

    state.pendingBuildingId = buildingId;
    notifyPlacementChanged();

    return {
      worldId: TARGET_WORLD_ID,
      buildingId,
      expectedRevision: state.serverRevision,
      placement,
    };
  }

  function finishApply(result) {
    const id = state.pendingBuildingId;
    if (!id) return;

    state.pendingBuildingId = null;

    if (
      result?.success === true &&
      result.buildingId === id &&
      Number.isSafeInteger(result.revision)
    ) {
      const placement = copyPlacement(result.placement);

      if (placement) {
        state.savedPlacements.set(id, placement);
        state.dirtyBuildings.delete(id);

        getBuildingModule(id)?.setPlacement?.(placement);

        state.serverRevision = Math.max(
          state.serverRevision ?? 0,
          result.revision,
        );
        state.serverReady = true;
      }
    }

    if (result?.error === "REVISION_CONFLICT") {
      state.serverReady = false;
    }

    notifyPlacementChanged();
  }

  function revertSelectedBuilding() {
    if (state.pendingBuildingId !== null) return false;

    const id = state.selectedBuildingId;
    const saved = state.savedPlacements.get(id);
    const module = getBuildingModule(id);

    if (!saved || !module) return false;

    if (!module.setPlacement(saved)) return false;

    state.dirtyBuildings.delete(id);
    notifyPlacementChanged();
    return true;
  }

  function resetServerConnection() {
    state.serverReady = false;
    state.serverRevision = null;
    state.pendingBuildingId = null;
    notifyPlacementChanged();
  }

  function setScaleAxis(axis) {
    if (!["x", "y", "z"].includes(axis)) return false;

    state.scaleAxis = axis;

    window.dispatchEvent(
      new CustomEvent("foundationEditor3DScaleAxisChanged", {
        detail: { axis },
      }),
    );

    return true;
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();

    if (event.ctrlKey && event.shiftKey && key === "b") {
      event.preventDefault();
      event.stopImmediatePropagation();
      setEnabled(!state.enabled);
      return;
    }

    if (!state.enabled) return;

    // Не перехватываем ввод в чат и другие поля.
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"))
    ) {
      return;
    }

    if (!event.altKey && !event.metaKey) {
      const arrows = {
        arrowup: [0, -1],
        arrowdown: [0, 1],
        arrowleft: [-1, 0],
        arrowright: [1, 0],
      };

      const direction = arrows[key];

      if (direction) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (event.repeat) return;

        const step = event.ctrlKey ? 0.1 : event.shiftKey ? 10 : 1;

        moveSelectedBuilding(direction[0] * step, direction[1] * step);

        return;
      }
    }

    if (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      ["x", "y", "z"].includes(key)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!event.repeat) {
        setScaleAxis(key);
      }

      return;
    }

    if (!event.ctrlKey && !event.altKey && !event.metaKey) {
      const isPlus =
        event.code === "NumpadAdd" ||
        (event.code === "Equal" && event.shiftKey) ||
        event.key === "+";

      const isMinus =
        event.code === "NumpadSubtract" ||
        event.code === "Minus" ||
        event.key === "-";

      if (isPlus || isMinus) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (event.repeat) return;

        scaleSelectedBuildingAxis(
          state.scaleAxis,
          (isPlus ? 1 : -1) * (event.shiftKey ? 10 : 1),
        );
        return;
      }
    }

    // Вращение здания только в активном 3D-редакторе.
    // Не перехватываем Ctrl/Alt/Meta комбинации.
    if (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (key === "q" || key === "e")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();

      // Игнорируем автоповтор клавиатуры:
      // один физический нажим = один шаг поворота.
      if (event.repeat) return;

      const step = event.shiftKey
        ? PRECISE_ROTATION_STEP_DEGREES
        : ROTATION_STEP_DEGREES;

      rotateBuildingDegrees(key === "q" ? -step : step);

      return;
    }

    if (key === "b" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!event.repeat) {
        toggleExistingBarriers();
      }

      return;
    }

    if (event.ctrlKey && key === "z") {
      event.preventDefault();
      event.stopImmediatePropagation();
      undo();
      return;
    }

    if (event.ctrlKey && event.shiftKey && key === "e") {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportContour();
      return;
    }

    if (key === "enter" && !event.ctrlKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }

  canvas?.addEventListener("pointerdown", handlePointerDown, { capture: true });

  window.addEventListener("keydown", handleKeyDown, { capture: true });

  window.foundationEditor3D = Object.freeze({
    setEnabled,
    getBuildings,
    getSelectedBuilding,
    selectBuilding,
    getSelectedBuildingId: () => state.selectedBuildingId,
    getBuildingModule: () => getBuildingModule(state.selectedBuildingId),
    isEnabled: () => state.enabled,
    addPoint,
    undo,
    close,
    clear,
    exportContour,
    getRenderData,

    // Просмотр существующих препятствий.
    getExistingBarriers,
    toggleExistingBarriers,
    getExistingBarriersMode,

    // Управление поворотом Sector 12 Corp.
    setBuildingRotationDegrees,
    rotateBuildingDegrees,
    moveSelectedBuilding,
    scaleSelectedBuilding,
    scaleSelectedBuildingAxis,
    setScaleAxis,
    getScaleAxis: () => state.scaleAxis,
    applyServerSnapshot,
    applyServerUpdate,
    getSaveState,
    beginApply,
    finishApply,
    revertSelectedBuilding,
    resetServerConnection,
  });
})();
