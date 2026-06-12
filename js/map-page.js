(function () {
  "use strict";

  const DATA = window.UniMatchData;
  const UI = window.UniMatch;
  const MAP_CFG = window.UNIMATCH_MAP || { provider: "vietmap", apiKey: "", style: "tm" };

  let map;
  let markers = {};
  let activeFilter = "all";
  let recommendedIds = [];
  let mapReady = false;
  let planRegion = "all";
  const MAP_BLOCK_HEIGHT_RATIO = 0.5;

  const REGION_CENTERS = {
    north: { city: "Hà Nội", lat: 21.0285, lng: 105.8342 },
    central: { city: "Đà Nẵng", lat: 16.0544, lng: 108.2022 },
    south: { city: "TP.HCM", lat: 10.8231, lng: 106.6297 }
  };

  const MULTI_CAMPUS_COORDS = {
    rmit: {
      north: { city: "Hà Nội", lat: 21.0318, lng: 105.7465 },
      south: { city: "TP.HCM", lat: 10.73, lng: 106.6946 }
    },
    fptu: {
      north: { city: "Hà Nội", lat: 21.0135, lng: 105.5273 },
      central: { city: "Đà Nẵng", lat: 16.0544, lng: 108.214 },
      south: { city: "TP.HCM", lat: 10.8411, lng: 106.8099 }
    },
    ftu: {
      north: { city: "Hà Nội", lat: 21.0233, lng: 105.8056 },
      south: { city: "TP.HCM", lat: 10.7772, lng: 106.6958 }
    }
  };

  const REGION_KEYWORDS = {
    north: ["hà nội", "hanoi", "thái nguyên", "nghệ an", "vinh", "bắc ninh", "hải phòng"],
    central: ["đà nẵng", "huế", "khánh hòa", "nha trang", "quảng nam", "thanh hóa", "quy nhơn"],
    south: ["hồ chí minh", "tp.hcm", "hcm", "cần thơ", "bình dương", "đồng nai", "vũng tàu", "long an"]
  };

  function isMultiCampusText(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes("&") || lower.includes(" và ") || lower.includes("nhiều cơ sở") || lower.includes("toàn quốc");
  }

  function getMentionedRegions(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    const regions = [];
    Object.entries(REGION_KEYWORDS).forEach(([region, keywords]) => {
      if (keywords.some((kw) => lower.includes(kw))) regions.push(region);
    });
    return regions;
  }

  function resolveUniversityCampus(uni, preferredRegion = "all") {
    const cityText = [uni.city, uni.location, uni.name].filter(Boolean).join(" ");
    const uniId = (uni.id || uni.shortName || "").toLowerCase();
    const registry = MULTI_CAMPUS_COORDS[uniId] || {};
    const mentioned = getMentionedRegions(cityText);
    const isMulti = isMultiCampusText(cityText) || mentioned.length > 1 || uni.region === "all";

    if (!isMulti) {
      return { lat: uni.lat, lng: uni.lng, city: uni.city, region: uni.region };
    }

    if (preferredRegion && preferredRegion !== "all" && isMulti) {
      const campus = registry[preferredRegion] || REGION_CENTERS[preferredRegion];
      return { ...campus, region: preferredRegion };
    }

    const fallbackRegion = mentioned[0] || uni.region || "south";
    const campus = registry[fallbackRegion] || REGION_CENTERS[fallbackRegion];
    return { ...campus, region: fallbackRegion };
  }

  function applyCampusToUniversity(uni, preferredRegion = "all") {
    const campus = resolveUniversityCampus(uni, preferredRegion);
    return { ...uni, lat: campus.lat, lng: campus.lng, city: campus.city, campus_region: campus.region };
  }

  function getVisibleUniversities() {
    const query = UI.$("#mapSearch").value.trim().toLowerCase();
    return DATA.universities
      .filter((uni) => {
        if (recommendedIds.length && !recommendedIds.includes(uni.id)) return false;
        if (activeFilter !== "all" && uni.type !== activeFilter) return false;
        if (query) {
          const text = `${uni.name} ${uni.shortName} ${uni.city}`.toLowerCase();
          if (!text.includes(query)) return false;
        }
        return true;
      })
      .map((uni) => markers[uni.id]?.uni || applyCampusToUniversity(uni, planRegion));
  }

  function resizeMap() {
    if (map && mapReady && typeof map.resize === "function") {
      map.resize();
    }
  }

  function syncMapViewport() {
    const header = document.querySelector(".site-header");
    const top = header?.offsetHeight || 0;
    document.documentElement.style.setProperty("--map-chrome-top", `${top}px`);

    const layout = document.querySelector(".map-layout");
    const mapWrap = document.querySelector(".map-canvas-wrap");
    if (!layout || !mapWrap) {
      resizeMap();
      return;
    }

    const isStacked = window.matchMedia("(max-width: 768px)").matches;

    requestAnimationFrame(() => {
      const mapWidth = Math.round(mapWrap.getBoundingClientRect().width);
      if (mapWidth <= 0) {
        resizeMap();
        return;
      }

      if (isStacked) {
        layout.style.height = "";
        layout.style.minHeight = "";
        document.documentElement.style.removeProperty("--map-block-height");
      } else {
        const blockHeight = `${Math.round(mapWidth * MAP_BLOCK_HEIGHT_RATIO)}px`;
        document.documentElement.style.setProperty("--map-block-height", blockHeight);
        layout.style.height = blockHeight;
        layout.style.minHeight = blockHeight;
      }

      resizeMap();
    });
  }

  function showMapSetupMessage(message) {
    const el = UI.$("#map");
    if (!el) return;
    el.innerHTML = `<div class="empty-state" style="height:100%;min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">${message}</div>`;
  }

  function createMarkerElement(uni) {
    const el = document.createElement("div");
    const bg = uni.type === "private" ? "#97CADB" : "#018ABE";
    const textCol = uni.type === "private" ? "#000" : "#fff";
    el.className = "map-marker-pin";
    el.innerHTML = `<span style="display:grid;place-items:center;width:38px;height:38px;background:${bg};color:${textCol};font-size:9px;font-weight:800;font-family:system-ui,sans-serif;border:2px solid #000;border-radius:4px;box-shadow:3px 3px 0 #000;cursor:pointer">${uni.shortName}</span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectUniversity(uni.id, false);
    });
    return el;
  }

  function buildStyleUrl() {
    const key = (MAP_CFG.apiKey || "").trim();
    const style = MAP_CFG.style || "tm";
    return `https://maps.vietmap.vn/maps/styles/${style}/style.json?apikey=${encodeURIComponent(key)}`;
  }

  function initMap() {
    const key = (MAP_CFG.apiKey || "").trim();
    if (!key) {
      showMapSetupMessage(
        "<strong>Chưa cấu hình API bản đồ.</strong><br><br>" +
        "Mở <code>js/map-config.js</code> và điền <code>apiKey</code> VietMap " +
        "(miễn phí: <a href='https://maps.vietmap.vn/console/register' target='_blank' rel='noopener'>đăng ký tại đây</a>).<br><br>" +
        "UniMatch dùng <strong>VietMap</strong> thay OpenStreetMap để hiển thị đúng chủ quyền <strong>Hoàng Sa, Trường Sa thuộc Việt Nam</strong>."
      );
      return;
    }

    if (!window.vietmapgl) {
      showMapSetupMessage("Không tải được VietMap GL JS. Kiểm tra kết nối mạng.");
      return;
    }

    map = new vietmapgl.Map({
      container: "map",
      style: buildStyleUrl(),
      center: [108.2022, 16.0544],
      zoom: 6,
      minZoom: 5,
      maxZoom: 18
    });

    map.addControl(new vietmapgl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapReady = true;

      DATA.universities.forEach((uni) => {
        const resolved = applyCampusToUniversity(uni, planRegion);
        const marker = new vietmapgl.Marker({ element: createMarkerElement(resolved), anchor: "bottom" })
          .setLngLat([resolved.lng, resolved.lat]);
        markers[uni.id] = { marker, uni: resolved };
      });

      render();
      requestAnimationFrame(() => {
        requestAnimationFrame(syncMapViewport);
      });
    });

    map.on("error", (e) => {
      console.error("VietMap error:", e);
      if (!mapReady) {
        showMapSetupMessage(
          "Không tải được bản đồ VietMap. Kiểm tra <code>apiKey</code> và giới hạn domain trong VietMap Console."
        );
      }
    });
  }

  function setMarkerVisibility(visible) {
    if (!mapReady) return;
    const visibleIds = new Set(visible.map((u) => u.id));
    DATA.universities.forEach((uni) => {
      const entry = markers[uni.id];
      if (!entry) return;
      if (visibleIds.has(uni.id)) {
        entry.marker.addTo(map);
      } else {
        entry.marker.remove();
      }
    });
  }

  function render() {
    if (!mapReady) return;

    const visible = getVisibleUniversities();
    setMarkerVisibility(visible);

    UI.$("#mapCount").textContent = `${visible.length} trường`;
    UI.$("#mapList").innerHTML = visible.length
      ? visible
          .map(
            (uni, index) => `
      <button type="button" class="map-list-item fade-in" data-id="${uni.id}" style="animation-delay: ${Math.min(index, 8) * 0.04}s">
        <strong>${uni.name}</strong>
        <div class="meta-row">
          <span class="pill ${uni.type}">${uni.type === "public" ? "Công lập" : "Tư thục"}</span>
          <span class="pill">${uni.city}</span>
          <span class="pill">${DATA.money(uni.tuition)}</span>
        </div>
      </button>
    `
          )
          .join("")
      : `<div class="empty-state">Không có trường phù hợp để hiển thị.</div>`;

    UI.$all(".map-list-item[data-id]").forEach((item) => {
      item.addEventListener("click", () => selectUniversity(item.dataset.id, true));
    });

    if (visible.length) {
      const bounds = new vietmapgl.LngLatBounds();
      visible.forEach((uni) => bounds.extend([uni.lng, uni.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 600 });
    }

    requestAnimationFrame(syncMapViewport);
  }

  function deselectUniversity() {
    UI.$all(".map-list-item").forEach((item) => {
      item.classList.remove("is-active");
    });

    UI.$("#infoPanel").innerHTML = `
      <h3>Chọn trường</h3>
      <p>Nhấn marker hoặc tên trong list.</p>
    `;

    const visible = getVisibleUniversities();
    if (visible.length && mapReady) {
      const bounds = new vietmapgl.LngLatBounds();
      visible.forEach((uni) => bounds.extend([uni.lng, uni.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 600 });
    }
  }

  function selectUniversity(id, fly) {
    const base = DATA.universities.find((item) => item.id === id);
    if (!base || !mapReady) return;
    const uni = markers[id]?.uni || applyCampusToUniversity(base, planRegion);

    UI.$all(".map-list-item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.id === id);
    });

    UI.$("#infoPanel").innerHTML = `
      <button class="close-info-btn" id="closeInfo" type="button" aria-label="Quay lại">✕</button>
      <h3 style="padding-right: 28px;">${uni.name}</h3>
      <p>${uni.city} — ${uni.type === "public" ? "Công lập" : "Tư thục"}</p>
      <div class="summary-list">
        <div class="summary-item"><span>Học phí</span><strong>${DATA.money(uni.tuition)}</strong></div>
        <div class="summary-item"><span>Sinh viên</span><strong>${uni.students}</strong></div>
        <div class="summary-item"><span>Số ngành</span><strong>${uni.majorsCount}</strong></div>
        <div class="summary-item"><span>Nhóm mạnh</span><strong>${uni.categories.map((cat) => DATA.getCategory(cat)?.name || cat).join(", ")}</strong></div>
      </div>
      <div class="row-actions">
        <a class="btn-primary" href="${uni.website}" target="_blank" rel="noopener">Website</a>
      </div>
    `;

    const closeBtn = UI.$("#closeInfo");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deselectUniversity();
      });
    }

    if (fly) {
      map.flyTo({
        center: [uni.lng, uni.lat],
        zoom: 14,
        duration: 800
      });
    }
  }

  function loadPlan() {
    const plan = UI.getPlan();
    if (!plan?.matches?.length) return;
    planRegion = plan.profile?.region || "all";
    recommendedIds = Array.from(new Set(plan.matches.slice(0, 10).map((match) => match.university.id)));
    UI.$("#recommendBox").style.display = "block";
    UI.$("#recommendText").textContent = `Đang hiển thị ${recommendedIds.length} trường từ kết quả tư vấn ${plan.totalScore.toFixed(1)} điểm.`;
    requestAnimationFrame(syncMapViewport);
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncMapViewport();
    loadPlan();
    initMap();

    UI.$all("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        UI.$all("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
        render();
      });
    });

    UI.$("#mapSearch")?.addEventListener("input", render);
    UI.$("#clearRecommendation")?.addEventListener("click", () => {
      recommendedIds = [];
      UI.$("#recommendBox").style.display = "none";
      render();
      syncMapViewport();
    });

    const pageHeader = document.querySelector(".page-header");
    const recommendBox = UI.$("#recommendBox");
    const mapLayout = document.querySelector(".map-layout");
    if (pageHeader) {
      new ResizeObserver(() => syncMapViewport()).observe(pageHeader);
    }
    if (recommendBox) {
      new ResizeObserver(() => syncMapViewport()).observe(recommendBox);
    }
    if (mapLayout) {
      new ResizeObserver(() => syncMapViewport()).observe(mapLayout);
    }

    window.addEventListener("load", syncMapViewport);

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncMapViewport, 150);
    });

    const params = new URLSearchParams(window.location.search);
    const target = params.get("university");
    if (target) {
      setTimeout(() => selectUniversity(target, true), 800);
    }
  });
})();
