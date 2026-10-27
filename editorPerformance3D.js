(function () {
  "use strict";

  const SAMPLE_LIMIT = 180;

  const samples = [];
  const stats = {
    fps: null,
    frameMs: null,
    low1Fps: null,
    cpuFrameMs: null,
    rendererCpuMs: null,
    rendererStagesMs: {},
    gpuTimerSupported: null,
    gpuStagesMs: {},
    drawCalls: null,
    triangles: null,
    models: null,
    players: null,
    heapMB: null,
    pingMs: null,
    gpuMs: null,
    updateMs: null,
    renderMs: null,
    buildings: [],
    visibleModels: 0,
    culledModels: 0,
    culledDrawCalls: 0,
    culledTriangles: 0,
    buildingDrawCalls: 0,
    buildingTriangles: 0,
    otherDrawCalls: 0,
    otherTriangles: 0,
  };

  let lastTimestamp = null;
  let cpuStart = null;
  let drawCalls = 0;
  let triangles = 0;
  let lastPublish = 0;
  let updateStart = null;
  let renderStart = null;
  let currentBuildingId = null;
  let buildingCounters = new Map();
  let completedBuildingCounters = [];
  let visibleModels = 0;
  let culledModels = 0;
  let culledDrawCalls = 0;
  let culledTriangles = 0;
  let buildingDrawCalls = 0;
  let buildingTriangles = 0;
  let otherDrawCalls = 0;
  let otherTriangles = 0;
  const rendererStageStarts = new Map();
  const rendererStageDurations = Object.create(null);
  let rendererCpuStart = null;

  function active() {
    return (
      window.foundationEditor3D?.isEnabled?.() === true &&
      window.rendererSystem?.is3D?.() === true &&
      window.worldSystem?.currentWorldId === 0
    );
  }

  function beginUpdate() {
    if (!active()) return;
    updateStart = performance.now();
  }

  function endUpdate() {
    if (updateStart === null) return;

    stats.updateMs = performance.now() - updateStart;
    updateStart = null;
  }

  function beginGameRender() {
    if (!active()) return;
    renderStart = performance.now();
  }

  function endGameRender() {
    if (renderStart === null) return;

    stats.renderMs = performance.now() - renderStart;
    renderStart = null;
  }

  function recordVisibleBuilding() {
    if (!active()) return;

    visibleModels++;
  }

  function recordCulledBuilding(id, savedDrawCalls, savedTriangles) {
    if (!active()) return;

    culledModels++;

    if (Number.isFinite(savedDrawCalls) && savedDrawCalls >= 0) {
      culledDrawCalls += savedDrawCalls;
    }

    if (Number.isFinite(savedTriangles) && savedTriangles >= 0) {
      culledTriangles += savedTriangles;
    }
  }

  function beginBuilding(id) {
    if (!active()) return;

    currentBuildingId = id;

    if (!buildingCounters.has(id)) {
      buildingCounters.set(id, {
        id,
        drawCalls: 0,
        triangles: 0,
      });
    }
  }

  function endBuilding() {
    currentBuildingId = null;
  }

  function beginFrame(timestamp) {
    if (!active()) {
      lastTimestamp = null;
      cpuStart = null;
      samples.length = 0;
      return;
    }

    if (lastTimestamp !== null) {
      const elapsed = timestamp - lastTimestamp;

      if (elapsed > 0 && elapsed < 1000) {
        samples.push(elapsed);

        if (samples.length > SAMPLE_LIMIT) {
          samples.shift();
        }
      }
    }

    lastTimestamp = timestamp;
    cpuStart = performance.now();
  }

  function endFrame() {
    if (cpuStart === null || !active()) return;

    const now = performance.now();
    stats.cpuFrameMs = now - cpuStart;
    cpuStart = null;

    if (now - lastPublish < 500) return;
    lastPublish = now;

    if (samples.length > 0) {
      const sum = samples.reduce((a, b) => a + b, 0);
      const average = sum / samples.length;

      stats.frameMs = average;
      stats.fps = 1000 / average;

      if (samples.length >= 60) {
        const slowest = [...samples].sort((a, b) => b - a);
        const count = Math.max(1, Math.ceil(slowest.length * 0.01));
        const slowAverage =
          slowest.slice(0, count).reduce((a, b) => a + b, 0) / count;

        stats.low1Fps = 1000 / slowAverage;
      } else {
        stats.low1Fps = null;
      }
    }

    const models =
      window.staticGeometrySystem
        ?.getGeometryForWorld?.(0)
        ?.filter((item) => item.type === "model") ?? [];

    stats.models = models.length;

    stats.players = window.editorPlayerCountProvider?.() ?? null;

    const heap = performance.memory?.usedJSHeapSize;
    stats.heapMB = Number.isFinite(heap) ? heap / 1048576 : null;
  }

  function beginRendererStage(name) {
    if (!active() || typeof name !== "string") return;

    rendererStageStarts.set(name, performance.now());
  }

  function endRendererStage(name) {
    const startedAt = rendererStageStarts.get(name);

    if (startedAt === undefined) return;

    rendererStageStarts.delete(name);

    const elapsed = performance.now() - startedAt;

    rendererStageDurations[name] =
      (rendererStageDurations[name] ?? 0) + elapsed;
  }

  function setGpuTimerSupported(supported) {
    stats.gpuTimerSupported = supported === true;

    if (!supported) {
      stats.gpuMs = null;
    }
  }

  function setGpuFrameTime(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      return;
    }

    if (!active()) {
      return;
    }

    stats.gpuMs = milliseconds;
  }

  function setGpuStages(stages) {
    if (!active()) return;

    const next = Object.create(null);

    if (stages && typeof stages === "object") {
      for (const [name, milliseconds] of Object.entries(stages)) {
        if (
          typeof name === "string" &&
          Number.isFinite(milliseconds) &&
          milliseconds >= 0
        ) {
          next[name] = milliseconds;
        }
      }
    }

    stats.gpuStagesMs = next;
  }

  function beginRender() {
    if (!active()) return;

    rendererCpuStart = performance.now();
    rendererStageStarts.clear();

    for (const key of Object.keys(rendererStageDurations)) {
      delete rendererStageDurations[key];
    }

    drawCalls = 0;
    triangles = 0;
    buildingDrawCalls = 0;
    buildingTriangles = 0;
    otherDrawCalls = 0;
    otherTriangles = 0;
    currentBuildingId = null;
    buildingCounters = new Map();

    visibleModels = 0;
    culledModels = 0;
    culledDrawCalls = 0;
    culledTriangles = 0;
  }

  function recordDraw(mode, count, instances = 1) {
    if (!active()) return;
    if (!Number.isFinite(count) || count < 0) return;

    const validInstances =
      Number.isFinite(instances) && instances > 0 ? Math.floor(instances) : 1;

    let triangleCount = 0;

    if (mode === WebGL2RenderingContext.TRIANGLES) {
      triangleCount = Math.floor(count / 3) * validInstances;
    } else if (
      mode === WebGL2RenderingContext.TRIANGLE_STRIP ||
      mode === WebGL2RenderingContext.TRIANGLE_FAN
    ) {
      triangleCount = Math.max(0, count - 2) * validInstances;
    }

    drawCalls++;
    triangles += triangleCount;

    if (currentBuildingId !== null) {
      buildingDrawCalls++;
      buildingTriangles += triangleCount;

      const building = buildingCounters.get(currentBuildingId);

      if (building) {
        building.drawCalls++;
        building.triangles += triangleCount;
      }
    } else {
      otherDrawCalls++;
      otherTriangles += triangleCount;
    }
  }

  function endRender() {
    if (!active()) return;

    if (rendererCpuStart !== null) {
      stats.rendererCpuMs = performance.now() - rendererCpuStart;
      rendererCpuStart = null;
    }

    stats.rendererStagesMs = { ...rendererStageDurations };

    stats.drawCalls = drawCalls;
    stats.triangles = triangles;
    stats.buildingDrawCalls = buildingDrawCalls;
    stats.buildingTriangles = buildingTriangles;
    stats.otherDrawCalls = otherDrawCalls;
    stats.otherTriangles = otherTriangles;

    stats.visibleModels = visibleModels;
    stats.culledModels = culledModels;
    stats.culledDrawCalls = culledDrawCalls;
    stats.culledTriangles = culledTriangles;

    completedBuildingCounters = Array.from(buildingCounters.values()).sort(
      (a, b) => b.triangles - a.triangles,
    );

    stats.buildings = completedBuildingCounters;
    currentBuildingId = null;
  }

  function getStats() {
    return { ...stats };
  }

  window.editorPerformance3D = Object.freeze({
    beginFrame,
    endFrame,
    beginUpdate,
    endUpdate,
    beginGameRender,
    endGameRender,
    beginRender,
    recordDraw,
    endRender,
    beginBuilding,
    endBuilding,
    recordVisibleBuilding,
    recordCulledBuilding,
    beginRendererStage,
    endRendererStage,
    setGpuTimerSupported,
    setGpuFrameTime,
    setGpuStages,
    getStats,
  });
})();
