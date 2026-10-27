(function () {
  "use strict";

  const editor = () => window.foundationEditor3D;
  const panel = document.createElement("section");

  panel.id = "foundationEditorPanel3D";
  panel.style.cssText = `
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 2147483000;
    width: 290px;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    padding: 14px;
    background: rgba(12, 16, 21, 0.94);
    border: 1px solid #776b57;
    border-radius: 8px;
    color: #e4dfd4;
    font: 12px Consolas, monospace;
    box-shadow: 0 8px 28px #0009;
    display: none;
    pointer-events: auto;
  `;

  panel.innerHTML = `
    <div style="font-size:15px;font-weight:bold;margin-bottom:12px">
      SECTOR 12 — 3D EDITOR
    </div>

    <label for="foundationBuildingSelect">
      SELECT BUILDING
    </label>

    <select id="foundationBuildingSelect"
      style="width:100%;margin:8px 0 12px;padding:7px;
      background:#202831;color:#eee;border:1px solid #776b57">
    </select>

    <div id="foundationBuildingInfo"
      style="line-height:1.7;white-space:pre-wrap"></div>

      <div
  id="foundationScaleAxes"
  style="display:flex;gap:6px;margin-top:10px"
>
  <button type="button" data-scale-axis="x">X</button>
  <button type="button" data-scale-axis="y">Y</button>
  <button type="button" data-scale-axis="z">Z</button>
</div>

<div
  id="foundationScaleActions"
  style="display:flex;gap:6px;margin-top:6px"
>
  <button type="button" data-scale-delta="-10">−10</button>
  <button type="button" data-scale-delta="-1">−1</button>
  <button type="button" data-scale-delta="1">+1</button>
  <button type="button" data-scale-delta="10">+10</button>
</div>

<div
  id="foundationScaleAxisStatus"
  style="margin-top:6px;color:#aaa"
></div>
      
<div style="display:flex;gap:8px;margin-top:12px">
  <button
    id="foundationApplyPlacement"
    type="button"
    style="flex:1;padding:9px;background:#00b894;
    border:0;border-radius:4px;color:#071511;
    font-weight:bold;cursor:pointer">
    ПРИМЕНИТЬ
  </button>

  <button
    id="foundationRevertPlacement"
    type="button"
    style="flex:1;padding:9px;background:#374151;
    border:0;border-radius:4px;color:#fff;
    font-weight:bold;cursor:pointer">
    ОТМЕНИТЬ
  </button>
</div>

<div
  id="foundationSaveStatus"
  role="status"
  aria-live="polite"
  style="margin-top:8px;line-height:1.5;color:#aaa">
  Ожидание конфигурации сервера...
</div>


      <div style="margin:12px 0;border-top:1px solid #555"></div>

<div style="font-weight:bold;margin-bottom:8px">
  MODEL LOD
</div>

<div id="foundationLodInfo"
  style="line-height:1.8;white-space:pre-wrap"></div>

    <div style="margin:12px 0;border-top:1px solid #555"></div>

    <div style="font-weight:bold;margin-bottom:8px">
      PERFORMANCE MONITOR
    </div>

    <div id="foundationPerformanceInfo"
      style="line-height:1.8;white-space:pre-wrap"></div>
        <div style="margin:12px 0;border-top:1px solid #555"></div>

    <div style="font-weight:bold;margin-bottom:8px">
      BUILDING RENDER COST
    </div>

    <div id="foundationBuildingPerformance"
      style="line-height:1.7;white-space:pre-wrap;
      font-size:11px"></div>

    <div style="margin-top:12px;color:#aaa;line-height:1.6">
      Q / E — Rotate ±5°
      <div>Shift + Q / E — Rotate ±1°</div>
      <div>X / Y / Z — Select scale axis</div>
<div>+ / - — Scale selected axis ±1</div>
<div>Shift + / - — Scale selected axis ±10</div>
<div>Arrow keys — Move ±1</div>
<div>Shift + Arrows — Move ±10</div>
<div>Ctrl + Arrows — Move ±0.1</div>
      <div>B — Barriers</div>
      <div>Ctrl + Z — Undo</div>
      <div>Enter — Close contour</div>
      <div>Ctrl + Shift + E — Export</div>
    </div>
  `;

  document.body.appendChild(panel);

  const select = panel.querySelector("#foundationBuildingSelect");
  const buildingInfo = panel.querySelector("#foundationBuildingInfo");
  const applyButton = panel.querySelector("#foundationApplyPlacement");

  const revertButton = panel.querySelector("#foundationRevertPlacement");

  const saveStatus = panel.querySelector("#foundationSaveStatus");
  const lodInfo = panel.querySelector("#foundationLodInfo");
  const performanceInfo = panel.querySelector("#foundationPerformanceInfo");
  const buildingPerformanceInfo = panel.querySelector(
    "#foundationBuildingPerformance",
  );

  const axisStatus = panel.querySelector("#foundationScaleAxisStatus");

  for (const button of panel.querySelectorAll(
    "#foundationScaleAxes button, #foundationScaleActions button",
  )) {
    button.style.cssText =
      "flex:1;padding:7px;background:#202831;color:#eee;" +
      "border:1px solid #776b57;cursor:pointer";
  }

  panel
    .querySelector("#foundationScaleAxes")
    .addEventListener("click", (event) => {
      const axis = event.target.closest("button[data-scale-axis]")?.dataset
        .scaleAxis;

      if (axis) {
        editor()?.setScaleAxis?.(axis);
      }

      refreshBuildings();
    });

  panel
    .querySelector("#foundationScaleActions")
    .addEventListener("click", (event) => {
      const delta = Number(
        event.target.closest("button[data-scale-delta]")?.dataset.scaleDelta,
      );

      if (Number.isFinite(delta) && delta !== 0) {
        editor()?.scaleSelectedBuildingAxis?.(
          editor()?.getScaleAxis?.(),
          delta,
        );
      }

      refresh();
    });

  let refreshTimer = null;

  let lastSaveMessage = "";

  function refreshSaveControls() {
    const state = editor()?.getSaveState?.();

    if (!state) {
      applyButton.disabled = true;
      revertButton.disabled = true;
      saveStatus.textContent = "Редактор недоступен";
      return;
    }

    applyButton.disabled = !state.ready || !state.dirty || state.pending;

    revertButton.disabled = !state.dirty || state.pending;

    applyButton.style.opacity = applyButton.disabled ? "0.45" : "1";

    revertButton.style.opacity = revertButton.disabled ? "0.45" : "1";

    if (state.pending) {
      saveStatus.textContent = "Сохранение на сервере...";
      return;
    }

    if (!state.ready) {
      saveStatus.textContent = "Нет актуальной конфигурации сервера";
      return;
    }

    if (lastSaveMessage) {
      saveStatus.textContent = lastSaveMessage;
      return;
    }

    saveStatus.textContent = state.dirty
      ? `Есть несохранённые изменения. Ревизия ${state.revision}`
      : `Все изменения сохранены. Ревизия ${state.revision}`;
  }

  function refreshBuildings() {
    const buildings = editor()?.getBuildings?.() ?? [];
    const selectedId = editor()?.getSelectedBuildingId?.();

    const signature = buildings.map((building) => building.id).join("|");

    if (select.dataset.signature !== signature) {
      select.replaceChildren();

      for (const building of buildings) {
        const option = document.createElement("option");
        option.value = building.id;
        option.textContent = building.id;
        select.appendChild(option);
      }

      select.dataset.signature = signature;
    }

    if (selectedId && select.value !== selectedId) {
      select.value = selectedId;
    }

    const axis = editor()?.getScaleAxis?.() || "x";

    axisStatus.textContent = `Выбрана ось: ${axis.toUpperCase()}`;

    for (const button of panel.querySelectorAll(
      "#foundationScaleAxes button",
    )) {
      button.style.borderColor =
        button.dataset.scaleAxis === axis ? "#00b894" : "#776b57";
    }

    const building = editor()?.getSelectedBuilding?.();
    const placement = editor()?.getBuildingModule?.()?.getPlacement?.();

    if (!building) {
      buildingInfo.textContent = "No building selected";
      return;
    }

    const angle = Number.isFinite(building.rotation)
      ? ((((building.rotation * 180) / Math.PI) % 360) + 360) % 360
      : 0;

    buildingInfo.textContent = [
      `ID: ${building.id}`,
      `X: ${building.x.toFixed(2)}`,
      `Y: ${building.y.toFixed(2)}`,
      `Rotation: ${angle.toFixed(1)}°`,
      `Scale X: ${building.scaleX.toFixed(2)}`,
      `Scale Y: ${building.scaleY.toFixed(2)}`,
      `Scale Z: ${building.scaleZ.toFixed(2)}`,
      `Editable: ${placement ? "YES" : "NO"}`,
    ].join("\n");
  }

  function refreshLod() {
    const building = editor()?.getSelectedBuilding?.();
    const lod = window.staticModelLOD3D?.getStats?.();

    if (!building || !lod) {
      lodInfo.textContent = "LOD telemetry unavailable";
      return;
    }

    const model = lod.models.find(
      (item) => item.key === `${building.worldId}:${building.id}`,
    );

    if (!Array.isArray(building.lodLevels) || building.lodLevels.length < 2) {
      lodInfo.textContent = "LOD: Not configured";
      return;
    }

    const value = (number) =>
      Number.isFinite(number) ? number.toFixed(1) : "N/A";

    const assetStatus = model?.assetUrl
      ? window.gltfAssetSystem3D?.getStatus?.(model.assetUrl)
      : "N/A";

    lodInfo.textContent = [
      `Enabled:       ${lod.enabled ? "YES" : "NO"}`,
      `Active LOD:    ${model ? model.index : "N/A"}`,
      `Target LOD:    ${model ? model.requestedIndex : "N/A"}`,
      `Distance:      ${value(model?.distance)}`,
      `Asset URL:     ${model?.assetUrl ?? "N/A"}`,
      `Asset status:  ${assetStatus ?? "N/A"}`,
      `LOD switches:  ${lod.switches}`,
      `Rendered tris: ${
        window.editorPerformance3D
          ?.getStats?.()
          ?.buildings?.find((item) => item.id === building.id)?.triangles ??
        "N/A"
      }`,
    ].join("\n");
  }

  function refreshPerformance() {
    const stats = window.editorPerformance3D?.getStats?.();

    if (!stats) {
      performanceInfo.textContent = "Waiting for telemetry...";
      return;
    }

    const value = (number, digits = 1) =>
      Number.isFinite(number) ? number.toFixed(digits) : "N/A";

    performanceInfo.textContent = [
      `FPS:          ${value(stats.fps)}`,
      `Frame ms:     ${value(stats.frameMs, 2)}`,
      `1% Low FPS:   ${value(stats.low1Fps)}`,
      `CPU frame ms: ${value(stats.cpuFrameMs, 2)}`,
      `Update ms:    ${value(stats.updateMs, 2)}`,
      `Render ms:    ${value(stats.renderMs, 2)}`,
      `Draw calls:   ${stats.drawCalls ?? "N/A"}`,
      `Triangles:    ${stats.triangles ?? "N/A"}`,
      `Models:       ${stats.models ?? "N/A"}`,
      `Visible:      ${stats.visibleModels ?? "N/A"}`,
      `Culled:       ${stats.culledModels ?? "N/A"}`,
      `Saved calls:  ${stats.culledDrawCalls ?? "N/A"}`,
      `Saved tris:   ${
        Number.isFinite(stats.culledTriangles)
          ? stats.culledTriangles.toLocaleString("en-US")
          : "N/A"
      }`,
      `Culling:      ${
        window.staticModelCulling3D?.isEnabled?.() ? "ON" : "OFF"
      }`,
      `Players:      ${stats.players ?? "N/A"}`,
      `JS Heap MB:   ${value(stats.heapMB)}`,

      `Ping ms:      ${value(stats.pingMs)}`,
      `GPU ms:       ${value(stats.gpuMs, 2)}`,
      "",
      "GPU STAGES",
      ...(stats.gpuTimerSupported !== true
        ? ["GPU timer: unavailable"]
        : Object.entries(stats.gpuStagesMs ?? {})
            .filter(([, ms]) => Number.isFinite(ms) && ms >= 0)
            .sort((a, b) => b[1] - a[1])
            .map(([name, ms]) => `${name.padEnd(18)} ${value(ms, 3)} ms`)),
    ].join("\n");
  }

  function refreshBuildingPerformance() {
    const stats = window.editorPerformance3D?.getStats?.();
    const buildings = stats?.buildings;

    if (!Array.isArray(buildings) || buildings.length === 0) {
      buildingPerformanceInfo.textContent = "No building render data";
      return;
    }

    buildingPerformanceInfo.textContent = buildings
      .map((building) => {
        return [
          building.id,
          `  Draw calls: ${building.drawCalls}`,
          `  Triangles:  ${building.triangles.toLocaleString("en-US")}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  function refresh() {
    if (!editor()?.isEnabled?.()) {
      hide();
      return;
    }

    refreshBuildings();
    refreshLod();
    refreshPerformance();
    refreshBuildingPerformance();
    refreshSaveControls();
  }

  function show() {
    if (refreshTimer !== null) return;

    panel.style.display = "block";
    refresh();

    refreshTimer = window.setInterval(refresh, 500);
  }

  function hide() {
    panel.style.display = "none";

    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  select.addEventListener("change", () => {
    const changed = editor()?.selectBuilding?.(select.value);

    if (!changed) {
      select.value = editor()?.getSelectedBuildingId?.() || "";
      lastSaveMessage = "Сначала примени или отмени изменения текущего здания";
    } else {
      lastSaveMessage = "";
    }

    refreshBuildings();
    refreshSaveControls();
  });

  applyButton.addEventListener("click", () => {
    lastSaveMessage = "";

    const success = window.sector12WorldBuildings?.apply?.();

    if (!success) {
      lastSaveMessage = "Не удалось отправить запрос на сервер";
    }

    refreshSaveControls();
  });

  revertButton.addEventListener("click", () => {
    if (editor()?.revertSelectedBuilding?.()) {
      lastSaveMessage = "";
    }

    refresh();
  });

  window.addEventListener("foundationEditor3DPlacementChanged", () => {
    lastSaveMessage = "";
    refreshSaveControls();
  });

  window.addEventListener("foundationEditor3DSaveResult", (event) => {
    const result = event.detail;

    if (result?.success) {
      lastSaveMessage = `Сохранено на сервере. Ревизия ${result.revision}`;
    } else {
      const errors = {
        UNAUTHENTICATED: "Требуется авторизация",
        FORBIDDEN: "Нет прав редактора карты",
        RATE_LIMITED: "Слишком частые запросы",
        UNKNOWN_BUILDING: "Неизвестное здание",
        INVALID_PLACEMENT: "Недопустимые параметры",
        INVALID_REVISION: "Некорректная версия карты",
        REVISION_CONFLICT: "Карта изменилась на сервере",
        PERSISTENCE_FAILED: "Ошибка записи JSON на сервере",
      };

      lastSaveMessage =
        errors[result?.error] || "Сохранение отклонено сервером";
    }

    refreshSaveControls();
  });

  window.addEventListener("foundationEditor3DToggled", (event) => {
    if (event.detail?.enabled) show();
    else hide();
  });

  window.addEventListener(
    "foundationEditor3DSelectionChanged",
    refreshBuildings,
  );

  window.foundationEditorPanel3D = Object.freeze({
    show,
    hide,
    refresh,
  });
})();
