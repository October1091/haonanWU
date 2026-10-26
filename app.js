/* 枕边 · 睡眠记录 — 界面与交互 */
(function () {
  "use strict";

  const C = window.SleepCore;
  if (!C) {
    console.error("SleepCore 未加载");
    return;
  }

  const STORAGE_KEY = "pillow-sleep-tracker-v1";
  const DEFAULT_BOUNDARY = C.DEFAULT_BOUNDARY;
  const ITEM_HEIGHT = 44;
  const WHEEL_CYCLES = 5;
  const MIDDLE_CYCLE = 2;
  const HISTORY_PAGE_SIZE = 8;
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const els = {
    liveClock: document.getElementById("liveClock"),
    recordEyebrow: document.getElementById("recordEyebrow"),
    nightBadge: document.getElementById("nightBadge"),
    mainTimePicker: document.getElementById("mainTimePicker"),
    syncNowBtn: document.getElementById("syncNowBtn"),
    boundaryChipBtn: document.getElementById("boundaryChipBtn"),
    boundaryChipValue: document.getElementById("boundaryChipValue"),
    recordNote: document.getElementById("recordNote"),
    saveBtn: document.getElementById("saveBtn"),
    saveBtnLabel: document.getElementById("saveBtnLabel"),
    averagePeriod: document.getElementById("averagePeriod"),
    averageTime: document.getElementById("averageTime"),
    regularityPill: document.getElementById("regularityPill"),
    regularityText: document.getElementById("regularityText"),
    averageCopy: document.getElementById("averageCopy"),
    comparison: document.getElementById("comparison"),
    comparisonText: document.getElementById("comparisonText"),
    statCount: document.getElementById("statCount"),
    statCountSub: document.getElementById("statCountSub"),
    statSd: document.getElementById("statSd"),
    statEarliest: document.getElementById("statEarliest"),
    statLatest: document.getElementById("statLatest"),
    chartWrap: document.getElementById("chartWrap"),
    chartFootNote: document.getElementById("chartFootNote"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    historyCount: document.getElementById("historyCount"),
    historyMore: document.getElementById("historyMore"),
    rangeSwitch: document.querySelector(".range-switch"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    settingsDialog: document.getElementById("settingsDialog"),
    settingsTimePicker: document.getElementById("settingsTimePicker"),
    boundaryExampleText: document.getElementById("boundaryExampleText"),
    resetBoundaryBtn: document.getElementById("resetBoundaryBtn"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    editDialog: document.getElementById("editDialog"),
    editEyebrow: document.getElementById("editEyebrow"),
    editCopy: document.getElementById("editCopy"),
    editTimePicker: document.getElementById("editTimePicker"),
    saveEditBtn: document.getElementById("saveEditBtn"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmActionBtn: document.getElementById("confirmActionBtn"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
  };

  const EDIT_ICON =
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12.8 4.2 3 3M4.4 15.6l.8-3.8 7.4-7.4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-7.4 7.4-3.8.8Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TRASH_ICON =
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 6h11.6M8 6V4.5h4V6m-6 0 .6 9.2c0 .5.4.8.9.8h5c.5 0 .9-.3.9-.8L15 6M8.5 9v4M11.5 9v4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const state = {
    data: createDefaultData(),
    range: 7,
    followsNow: true,
    selected: { hours: 0, minutes: 0 },
    nightKey: null,
    mainWheel: null,
    settingsWheel: null,
    editWheel: null,
    editingId: null,
    pendingDeleteId: null,
    historyExpanded: false,
    toastTimer: 0,
    chartFrame: 0,
    lastMinute: null,
  };

  let wheelSerial = 0;

  /* ------------------------------------------------------------------ *
   * 数据
   * ------------------------------------------------------------------ */

  function createDefaultData() {
    return {
      version: 1,
      settings: { boundary: DEFAULT_BOUNDARY },
      records: [],
    };
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return (
      "r-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function isIsoDate(value) {
    return (
      typeof value === "string" &&
      !Number.isNaN(Date.parse(value))
    );
  }

  function normalizeData(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const rawBoundary = C.parseHM(
      source.settings && source.settings.boundary
    );
    const boundary = rawBoundary === null ? DEFAULT_BOUNDARY : rawBoundary;
    const rawRecords = Array.isArray(source.records) ? source.records : [];
    const byNight = new Map();

    rawRecords.forEach(function (rawRecord) {
      if (!rawRecord || typeof rawRecord !== "object") return;
      const bedtimeMinutes = C.parseHM(rawRecord.bedtime);
      if (bedtimeMinutes === null) return;

      let bedtimeDate = C.isDateKey(rawRecord.bedtimeDate)
        ? rawRecord.bedtimeDate
        : null;

      if (!bedtimeDate && C.isDateKey(rawRecord.sleepDate)) {
        bedtimeDate =
          bedtimeMinutes < boundary
            ? C.addDays(rawRecord.sleepDate, 1)
            : rawRecord.sleepDate;
      }
      if (!bedtimeDate) return;

      const sleepDate = C.sleepDateForBedtime(
        bedtimeDate,
        bedtimeMinutes,
        boundary
      );
      const createdAt = isIsoDate(rawRecord.createdAt)
        ? rawRecord.createdAt
        : new Date().toISOString();
      const updatedAt = isIsoDate(rawRecord.updatedAt)
        ? rawRecord.updatedAt
        : createdAt;
      const record = {
        id:
          typeof rawRecord.id === "string" && rawRecord.id
            ? rawRecord.id
            : makeId(),
        bedtime: C.formatHM(bedtimeMinutes),
        bedtimeDate: bedtimeDate,
        sleepDate: sleepDate,
        createdAt: createdAt,
        updatedAt: updatedAt,
      };

      const existing = byNight.get(sleepDate);
      if (
        !existing ||
        Date.parse(record.updatedAt) >= Date.parse(existing.updatedAt)
      ) {
        byNight.set(sleepDate, record);
      }
    });

    const ids = new Set();
    const records = Array.from(byNight.values())
      .sort(function (a, b) {
        return b.sleepDate.localeCompare(a.sleepDate);
      })
      .map(function (record) {
        let id = record.id;
        while (ids.has(id)) id = makeId();
        ids.add(id);
        return { ...record, id: id };
      });

    return {
      version: 1,
      settings: { boundary: boundary },
      records: records,
    };
  }

  function loadData() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return createDefaultData();
      return normalizeData(JSON.parse(saved));
    } catch (error) {
      console.warn("读取本地记录失败", error);
      return createDefaultData();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          settings: { boundary: C.formatHM(state.data.settings.boundary) },
          records: state.data.records,
        })
      );
      return true;
    } catch (error) {
      console.warn("保存本地记录失败", error);
      toast("浏览器存储不可用，记录未能保存");
      return false;
    }
  }

  function findRecordBySleepDate(sleepDate) {
    return state.data.records.find(function (record) {
      return record.sleepDate === sleepDate;
    });
  }

  function findRecordById(id) {
    return state.data.records.find(function (record) {
      return record.id === id;
    });
  }

  function currentBoundary() {
    return state.data.settings.boundary;
  }

  /* ------------------------------------------------------------------ *
   * 翻动式时间选择器
   * ------------------------------------------------------------------ */

  class TimeWheel {
    constructor(root, options) {
      const opts = options || {};
      const value = opts.value || { hours: 0, minutes: 0 };
      this.root = root;
      this.onChange = typeof opts.onChange === "function" ? opts.onChange : null;
      this.uid = ++wheelSerial;
      this.value = {
        hours: clamp(Math.round(value.hours || 0), 0, 23),
        minutes: clamp(Math.round(value.minutes || 0), 0, 59),
      };
      this._suppressUntil = 0;
      this._clickBlockUntil = 0;
      this._raf = 0;
      this._recenterTimers = { hours: 0, minutes: 0 };

      this._build();
      this._bind();
      this.setValue(this.value, { animate: false });
    }

    _build() {
      const hourItems = [];
      for (let cycle = 0; cycle < WHEEL_CYCLES; cycle += 1) {
        for (let index = 0; index < 24; index += 1) {
          hourItems.push(this._itemHtml("hours", index, 24, cycle));
        }
      }
      const minuteItems = [];
      for (let cycle = 0; cycle < WHEEL_CYCLES; cycle += 1) {
        for (let index = 0; index < 60; index += 1) {
          minuteItems.push(this._itemHtml("minutes", index, 60, cycle));
        }
      }

      this.root.classList.add("time-picker");
      this.root.innerHTML =
        '<div class="dial-head" aria-hidden="true"><span>时</span><span>分</span></div>' +
        '<div class="dial-body">' +
        '<div class="wheel-highlight" aria-hidden="true"></div>' +
        '<div class="wheel" data-kind="hours" role="listbox" tabindex="0" aria-label="小时，上下方向键调整">' +
        '<div class="wheel-inner"><div class="wheel-pad" aria-hidden="true"></div>' +
        hourItems.join("") +
        '<div class="wheel-pad" aria-hidden="true"></div></div>' +
        "</div>" +
        '<span class="dial-colon" aria-hidden="true">:</span>' +
        '<div class="wheel" data-kind="minutes" role="listbox" tabindex="0" aria-label="分钟，上下方向键调整">' +
        '<div class="wheel-inner"><div class="wheel-pad" aria-hidden="true"></div>' +
        minuteItems.join("") +
        '<div class="wheel-pad" aria-hidden="true"></div></div>' +
        "</div>" +
        "</div>";

      this.hourWheel = this.root.querySelector('[data-kind="hours"]');
      this.minuteWheel = this.root.querySelector('[data-kind="minutes"]');
      this.hourItems = Array.from(
        this.hourWheel.querySelectorAll(".wheel-item")
      );
      this.minuteItems = Array.from(
        this.minuteWheel.querySelectorAll(".wheel-item")
      );
    }

    _itemHtml(kind, value, total, cycle) {
      const absolute = cycle * total + value;
      const id = "tw" + this.uid + "-" + kind + "-" + absolute;
      return (
        '<div class="wheel-item" role="option" id="' +
        id +
        '" data-value="' +
        value +
        '" data-absolute="' +
        absolute +
        '" aria-selected="false" aria-posinset="' +
        (value + 1) +
        '" aria-setsize="' +
        total +
        '">' +
        C.pad2(value) +
        "</div>"
      );
    }

    _bind() {
      const self = this;
      [
        ["hours", this.hourWheel, 24, this.hourItems],
        ["minutes", this.minuteWheel, 60, this.minuteItems],
      ].forEach(function (entry) {
        const kind = entry[0];
        const wheel = entry[1];
        const total = entry[2];

        wheel.addEventListener(
          "scroll",
          function () {
            self._schedulePaint();
            self._scheduleRecenter(kind, wheel, total);
          },
          { passive: true }
        );

        wheel.addEventListener("keydown", function (event) {
          self._onKeyDown(event, kind, total);
        });

        wheel.addEventListener("click", function (event) {
          if (performance.now() < self._clickBlockUntil) return;
          const item = event.target.closest(".wheel-item");
          if (!item) return;
          const index = Number(item.dataset.value);
          if (Number.isFinite(index)) {
            self._select(kind, index, true);
          }
        });

        wheel.addEventListener("wheel", function () {
          self._suppressUntil = 0;
        }, { passive: true });

        wheel.addEventListener(
          "touchstart",
          function () {
            self._suppressUntil = 0;
          },
          { passive: true }
        );

        wheel.addEventListener("pointerdown", function (event) {
          self._startDrag(event, wheel, kind, total);
        });
      });
    }

    _startDrag(event, wheel, kind, total) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;

      const self = this;
      const startY = event.clientY;
      const startTop = wheel.scrollTop;
      let moved = false;

      this._suppressUntil = 0;
      wheel.classList.add("is-dragging");
      wheel.focus({ preventScroll: true });
      try {
        wheel.setPointerCapture(event.pointerId);
      } catch (error) {
        /* ignore */
      }

      function onMove(moveEvent) {
        const distance = moveEvent.clientY - startY;
        if (Math.abs(distance) > 3) moved = true;
        wheel.scrollTop = startTop - distance;
        moveEvent.preventDefault();
      }

      function finish(upEvent) {
        wheel.removeEventListener("pointermove", onMove);
        wheel.removeEventListener("pointerup", finish);
        wheel.removeEventListener("pointercancel", finish);
        wheel.classList.remove("is-dragging");
        try {
          wheel.releasePointerCapture(upEvent.pointerId);
        } catch (error) {
          /* ignore */
        }

        const absolute = self._nearest(wheel, total);
        const index = C.mod(absolute, total);
        if (kind === "hours") {
          self.value.hours = index;
        } else {
          self.value.minutes = index;
        }
        self._paint();
        wheel.scrollTo({
          top: absolute * ITEM_HEIGHT,
          behavior: "smooth",
        });
        self._suppressUntil = performance.now() + 620;
        if (moved) {
          self._clickBlockUntil = performance.now() + 280;
          self._emitChange();
        }
        self._scheduleRecenter(kind, wheel, total);
      }

      wheel.addEventListener("pointermove", onMove);
      wheel.addEventListener("pointerup", finish);
      wheel.addEventListener("pointercancel", finish);
    }

    _onKeyDown(event, kind, total) {
      const key = event.key;
      const current = this.value[kind];
      let next = null;

      if (key === "ArrowUp" || key === "ArrowLeft") next = current - 1;
      if (key === "ArrowDown" || key === "ArrowRight") next = current + 1;
      if (key === "PageUp") next = current - 5;
      if (key === "PageDown") next = current + 5;
      if (key === "Home") next = 0;
      if (key === "End") next = total - 1;

      if (next === null) return;
      event.preventDefault();
      this._select(kind, C.mod(next, total), true);
    }

    _select(kind, index, animate) {
      const total = kind === "hours" ? 24 : 60;
      const wheel = kind === "hours" ? this.hourWheel : this.minuteWheel;
      const current = this._nearest(wheel, total);
      const cycleStart = Math.floor(current / total) * total;
      let target = cycleStart + index;

      if (target - current > total / 2) target -= total;
      if (current - target > total / 2) target += total;
      target = clamp(target, 0, total * WHEEL_CYCLES - 1);

      this.value[kind] = index;
      this._suppressUntil = performance.now() + (animate ? 620 : 80);
      this._scrollTo(kind, target, animate);
      this._paint();
      this._emitChange();
      this._scheduleRecenter(kind, wheel, total);
    }

    _emitChange() {
      if (typeof this.onChange === "function") {
        this.onChange(
          { hours: this.value.hours, minutes: this.value.minutes },
          "user"
        );
      }
    }

    _schedulePaint() {
      if (this._raf) return;
      const self = this;
      this._raf = window.requestAnimationFrame(function () {
        self._raf = 0;
        self._paint();
        if (performance.now() < self._suppressUntil) return;

        const hours = C.mod(self._nearest(self.hourWheel, 24), 24);
        const minutes = C.mod(self._nearest(self.minuteWheel, 60), 60);
        if (
          hours !== self.value.hours ||
          minutes !== self.value.minutes
        ) {
          self.value.hours = hours;
          self.value.minutes = minutes;
          self._paint();
          self._emitChange();
        }
      });
    }

    _scheduleRecenter(kind, wheel, total) {
      window.clearTimeout(this._recenterTimers[kind]);
      const self = this;
      const delay = Math.max(
        220,
        this._suppressUntil - performance.now() + 40
      );
      this._recenterTimers[kind] = window.setTimeout(function () {
        if (wheel.classList.contains("is-dragging")) {
          self._scheduleRecenter(kind, wheel, total);
          return;
        }
        if (performance.now() < self._suppressUntil) {
          self._scheduleRecenter(kind, wheel, total);
          return;
        }

        const absolute = self._nearest(wheel, total);
        if (
          absolute >= MIDDLE_CYCLE * total &&
          absolute < (MIDDLE_CYCLE + 1) * total
        ) {
          return;
        }

        const logical = C.mod(absolute, total);
        wheel.classList.add("is-recentering");
        wheel.scrollTop = (MIDDLE_CYCLE * total + logical) * ITEM_HEIGHT;
        window.requestAnimationFrame(function () {
          wheel.classList.remove("is-recentering");
        });
      }, delay);
    }

    _nearest(wheel, total) {
      return clamp(
        Math.round(wheel.scrollTop / ITEM_HEIGHT),
        0,
        total * WHEEL_CYCLES - 1
      );
    }

    _paint() {
      this._paintWheel(
        this.hourWheel,
        this.hourItems,
        this.hourWheel.scrollTop / ITEM_HEIGHT,
        24
      );
      this._paintWheel(
        this.minuteWheel,
        this.minuteItems,
        this.minuteWheel.scrollTop / ITEM_HEIGHT,
        60
      );
    }

    _paintWheel(wheel, items, center, total) {
      const activeAbsolute = clamp(
        Math.round(center),
        0,
        items.length - 1
      );
      const from = Math.max(0, activeAbsolute - 4);
      const to = Math.min(items.length - 1, activeAbsolute + 4);
      const previous = wheel._paintedRange;

      if (previous) {
        for (let index = previous.from; index <= previous.to; index += 1) {
          if (index >= from && index <= to) continue;
          const item = items[index];
          if (!item) continue;
          item.style.removeProperty("transform");
          item.style.removeProperty("opacity");
          item.classList.remove("is-active");
          item.setAttribute("aria-selected", "false");
        }
      }

      for (let index = from; index <= to; index += 1) {
        const item = items[index];
        const distance = Math.abs(index - center);
        const capped = Math.min(distance, 3);
        const scale = 1.24 - capped * 0.1;
        const opacity = 1 - capped * 0.27;
        item.style.transform = "scale(" + scale.toFixed(3) + ")";
        item.style.opacity = opacity.toFixed(3);
        const active = distance < 0.5;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      }
      wheel._paintedRange = { from: from, to: to };

      const activeItem = items[activeAbsolute];
      if (activeItem) {
        wheel.setAttribute("aria-activedescendant", activeItem.id);
      }
    }

    _scrollTo(kind, absolute, animate) {
      const wheel = kind === "hours" ? this.hourWheel : this.minuteWheel;
      const top = absolute * ITEM_HEIGHT;
      if (animate && typeof wheel.scrollTo === "function") {
        wheel.scrollTo({ top: top, behavior: "smooth" });
      } else {
        wheel.scrollTop = top;
      }
    }

    setValue(value, options) {
      const opts = options || {};
      this.value = {
        hours: clamp(Math.round(value.hours || 0), 0, 23),
        minutes: clamp(Math.round(value.minutes || 0), 0, 59),
      };
      this._scrollTo(
        "hours",
        MIDDLE_CYCLE * 24 + this.value.hours,
        Boolean(opts.animate)
      );
      this._scrollTo(
        "minutes",
        MIDDLE_CYCLE * 60 + this.value.minutes,
        Boolean(opts.animate)
      );
      this._suppressUntil =
        performance.now() + (opts.animate ? 620 : 100);
      this._paint();
    }

    getValue() {
      return { hours: this.value.hours, minutes: this.value.minutes };
    }

    getMinutes() {
      return this.value.hours * 60 + this.value.minutes;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /* ------------------------------------------------------------------ *
   * 文案与日期
   * ------------------------------------------------------------------ */

  function formatMonthDay(dateKey, includeYear) {
    const date = C.dateFromKey(dateKey);
    const now = new Date();
    const yearPrefix =
      includeYear && date.getFullYear() !== now.getFullYear()
        ? date.getFullYear() + "年"
        : "";
    return (
      yearPrefix +
      (date.getMonth() + 1) +
      "月" +
      date.getDate() +
      "日"
    );
  }

  function weekdayOf(dateKey) {
    return WEEKDAYS[C.dateFromKey(dateKey).getDay()];
  }

  function formatBadge(dateKey, isCurrent) {
    const prefix = isCurrent ? "今晚 · " : "";
    return (
      prefix +
      formatMonthDay(dateKey, true) +
      " " +
      weekdayOf(dateKey)
    );
  }

  function relativeNight(nightKey, currentNightKey) {
    const difference = C.daysBetween(nightKey, currentNightKey);
    if (difference === 0) return "今晚";
    if (difference === 1) return "昨晚";
    if (difference === 2) return "前晚";
    if (difference > 2) return difference + " 晚前";
    if (difference === -1) return "明晚";
    return Math.abs(difference) + " 晚后";
  }

  function boundaryPeriod(boundary) {
    return boundary < 6 * 60 ? "凌晨" : C.periodOfDay(boundary);
  }

  function rangeLabel(range) {
    if (range === "all") return "全部记录";
    return "近 " + range + " 晚";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  function renderAll() {
    renderSelection();
    renderStats();
    renderHistory();
    scheduleChartRender();
  }

  function renderSelection() {
    const now = new Date();
    const boundary = currentBoundary();
    const selectedMinutes =
      state.selected.hours * 60 + state.selected.minutes;
    const resolved = C.resolveSleepDate(now, selectedMinutes, boundary);
    const currentNight = C.nightKeyForNow(now, boundary);
    const isCurrent = resolved.sleepDate === currentNight;
    const existing = findRecordBySleepDate(resolved.sleepDate);
    const selectedLabel = C.formatHM(selectedMinutes);

    els.nightBadge.textContent = formatBadge(resolved.sleepDate, isCurrent);
    els.recordEyebrow.textContent = isCurrent ? "今晚入睡" : "这一晚入睡";
    els.boundaryChipValue.textContent = C.formatHM(boundary);
    els.syncNowBtn.classList.toggle("is-active", state.followsNow);
    els.syncNowBtn.setAttribute(
      "aria-pressed",
      state.followsNow ? "true" : "false"
    );

    if (existing) {
      els.saveBtnLabel.textContent = isCurrent
        ? "更新今晚记录"
        : "更新这晚记录";
      if (selectedLabel === existing.bedtime) {
        els.recordNote.textContent = "已记录 " + existing.bedtime;
      } else {
        els.recordNote.textContent =
          "将更新 " + existing.bedtime + " → " + selectedLabel;
      }
    } else {
      els.saveBtnLabel.textContent = "记录上床";
      els.recordNote.textContent = state.followsNow
        ? "已对准打开 App 的时间"
        : "翻动到准确的上床时间";
    }
  }

  function renderStats() {
    const boundary = currentBoundary();
    const currentNight = state.nightKey;
    const range = state.range;
    const records =
      range === "all"
        ? state.data.records
        : C.recordsInNights(state.data.records, currentNight, range);
    const summary = C.averageRecords(records);
    const rangeText = rangeLabel(range);

    document.querySelectorAll(".range-switch button").forEach(function (button) {
      const value = button.dataset.range;
      button.classList.toggle(
        "is-active",
        value === String(state.range)
      );
      button.setAttribute(
        "aria-pressed",
        value === String(state.range) ? "true" : "false"
      );
    });

    if (!summary) {
      els.averagePeriod.textContent = "平均";
      els.averageTime.textContent = "—";
      els.averageTime.classList.add("is-empty");
      setRegularity("empty", "等待记录");
      els.averageCopy.textContent =
        "记录几晚后，就能看见你的平均入睡时间。";
      els.comparison.hidden = true;
      els.statCount.textContent = "0";
      els.statCountSub.textContent =
        range === "all" ? "全部记录" : "/ " + range + " 晚";
      els.statSd.textContent = "—";
      els.statEarliest.textContent = "—";
      els.statLatest.textContent = "—";
      return;
    }

    const timeText = C.formatHM(summary.average);
    const period = C.periodOfDay(summary.average);
    els.averagePeriod.textContent = period;
    els.averageTime.textContent = timeText;
    els.averageTime.classList.remove("is-empty");
    els.statCount.textContent = String(summary.count);
    els.statCountSub.textContent =
      range === "all"
        ? "全部记录"
        : "/ " + range + " 晚";
    els.statSd.textContent = String(summary.sd);
    els.statEarliest.textContent = C.formatHM(summary.earliest);
    els.statLatest.textContent = C.formatHM(summary.latest);

    if (summary.count === 1) {
      els.statSd.textContent = "—";
      setRegularity("one", "再记一晚");
      els.averageCopy.textContent =
        "第一晚在" +
        period +
        " " +
        timeText +
        " 入睡。再记录一晚，就能看见波动。";
    } else {
      const regularity = getRegularity(summary.sd);
      setRegularity(regularity.level, regularity.text);
      els.averageCopy.textContent =
        rangeText +
        "平均在" +
        period +
        " " +
        timeText +
        " 入睡，波动约 " +
        summary.sd +
        " 分钟。";
    }

    const comparison = getComparison(range, summary);
    if (comparison) {
      els.comparison.hidden = false;
      els.comparisonText.textContent = comparison;
    } else {
      els.comparison.hidden = true;
    }
  }

  function setRegularity(level, text) {
    els.regularityPill.dataset.level = level;
    els.regularityText.textContent = text;
  }

  function getRegularity(sd) {
    if (sd <= 20) return { level: "steady", text: "很规律" };
    if (sd <= 45) return { level: "good", text: "较规律" };
    if (sd <= 90) return { level: "wobble", text: "略有波动" };
    return { level: "loose", text: "波动较大" };
  }

  function getComparison(range, summary) {
    if (range === "all" || summary.count < 2) return null;
    const previousRecords = C.recordsInPreviousNights(
      state.data.records,
      state.nightKey,
      range
    );
    const previous = C.averageRecords(previousRecords);
    if (!previous || previous.count < 2) return null;

    const difference = C.signedCircularDiff(
      summary.average,
      previous.average
    );
    const scale = range === 30 ? "30 晚" : "7 晚";
    if (Math.abs(difference) < 2) {
      return "与前 " + scale + " 基本持平";
    }
    return (
      "较前 " +
      scale +
      (difference > 0 ? "推迟 " : "提前 ") +
      C.formatDuration(Math.abs(difference))
    );
  }

  function scheduleChartRender() {
    if (state.chartFrame) {
      window.cancelAnimationFrame(state.chartFrame);
    }
    state.chartFrame = window.requestAnimationFrame(function () {
      state.chartFrame = 0;
      renderChart();
    });
  }

  function renderChart() {
    const width = Math.max(
      280,
      Math.round(els.chartWrap.clientWidth || 520)
    );
    const height = Math.max(
      196,
      Math.round(els.chartWrap.clientHeight || 220)
    );
    const margin = { left: 38, right: 10, top: 18, bottom: 27 };
    const plotWidth = Math.max(160, width - margin.left - margin.right);
    const plotHeight = Math.max(120, height - margin.top - margin.bottom);
    const bottom = margin.top + plotHeight;
    const boundary = currentBoundary();
    const nights = C.rangeNightKeys(state.nightKey, 7);
    const recordsByNight = new Map(
      state.data.records.map(function (record) {
        return [record.sleepDate, record];
      })
    );
    const weekRecords = nights
      .map(function (night) {
        return recordsByNight.get(night);
      })
      .filter(Boolean);
    const summary = C.averageRecords(weekRecords);
    const center = summary
      ? C.averageOffsetFromBoundary(summary.average, boundary)
      : 18 * 60;

    const points = nights.map(function (night, index) {
      const record = recordsByNight.get(night) || null;
      const minutes = record ? C.parseHM(record.bedtime) : null;
      const offset =
        minutes === null ? null : C.mod(minutes - boundary, C.DAY);
      return {
        night: night,
        record: record,
        minutes: minutes,
        offset: offset,
        value:
          offset === null ? null : C.unwrapNear(offset, center),
        x:
          margin.left +
          (index / Math.max(1, nights.length - 1)) * plotWidth,
      };
    });

    const values = points
      .filter(function (point) {
        return point.value !== null;
      })
      .map(function (point) {
        return point.value;
      });
    const domain = chartDomain(values, center);
    const span = domain.max - domain.min;
    let tickStep = 60;
    if (span > 420) tickStep = 120;
    if (span > 780) tickStep = 180;
    if (span > 1080) tickStep = 240;

    function yFor(value) {
      return (
        margin.top +
        ((domain.max - value) / (domain.max - domain.min)) * plotHeight
      );
    }

    points.forEach(function (point) {
      point.y = point.value === null ? null : yFor(point.value);
    });

    const averageValue = summary
      ? C.unwrapNear(
          C.averageOffsetFromBoundary(summary.average, boundary),
          center
        )
      : null;
    const averageY =
      averageValue === null ? null : yFor(averageValue);

    let grid = "";
    const firstTick = Math.ceil(domain.min / tickStep) * tickStep;
    for (let tick = firstTick; tick <= domain.max + 1; tick += tickStep) {
      const y = yFor(tick);
      grid +=
        '<line class="chart-grid-line" x1="' +
        margin.left +
        '" y1="' +
        y.toFixed(1) +
        '" x2="' +
        (width - margin.right) +
        '" y2="' +
        y.toFixed(1) +
        '"/>';
      grid +=
        '<text class="chart-tick" x="' +
        (margin.left - 7) +
        '" y="' +
        (y + 3.2).toFixed(1) +
        '" text-anchor="end">' +
        C.formatHM(boundary + tick) +
        "</text>";
    }

    let verticalGrid = "";
    points.forEach(function (point) {
      verticalGrid +=
        '<line class="chart-grid-line" x1="' +
        point.x.toFixed(1) +
        '" y1="' +
        margin.top +
        '" x2="' +
        point.x.toFixed(1) +
        '" y2="' +
        bottom +
        '" opacity=".35"/>';
    });

    const segments = [];
    let segment = [];
    points.forEach(function (point) {
      if (point.value !== null) {
        segment.push(point);
      } else if (segment.length) {
        segments.push(segment);
        segment = [];
      }
    });
    if (segment.length) segments.push(segment);

    let linePath = "";
    let areaPath = "";
    segments.forEach(function (part) {
      if (part.length < 2) return;
      linePath +=
        "M" +
        part
          .map(function (point) {
            return point.x.toFixed(1) + "," + point.y.toFixed(1);
          })
          .join(" L");
      const first = part[0];
      const last = part[part.length - 1];
      areaPath +=
        "M" +
        first.x.toFixed(1) +
        "," +
        bottom +
        " L" +
        part
          .map(function (point) {
            return point.x.toFixed(1) + "," + point.y.toFixed(1);
          })
          .join(" L") +
        " L" +
        last.x.toFixed(1) +
        "," +
        bottom +
        " Z";
    });

    let dots = "";
    points.forEach(function (point) {
      if (point.value === null) return;
      const isToday = point.night === state.nightKey;
      if (isToday) {
        dots +=
          '<circle class="chart-dot-ring" cx="' +
          point.x.toFixed(1) +
          '" cy="' +
          point.y.toFixed(1) +
          '" r="8"/>';
      }
      dots +=
        '<circle class="chart-dot' +
        (isToday ? " is-today" : "") +
        '" cx="' +
        point.x.toFixed(1) +
        '" cy="' +
        point.y.toFixed(1) +
        '" r="' +
        (isToday ? "4.2" : "3.6") +
        '"><title>' +
        formatMonthDay(point.night, true) +
        " · " +
        point.record.bedtime +
        "</title></circle>";
    });

    let xLabels = "";
    points.forEach(function (point) {
      xLabels +=
        '<text class="chart-day' +
        (point.night === state.nightKey ? " is-today" : "") +
        '" x="' +
        point.x.toFixed(1) +
        '" y="' +
        (height - 7) +
        '" text-anchor="middle">' +
        (C.dateFromKey(point.night).getMonth() + 1) +
        "/" +
        C.dateFromKey(point.night).getDate() +
        "</text>";
    });

    let latestLabel = "";
    const recordedPoints = points.filter(function (point) {
      return point.value !== null;
    });
    if (recordedPoints.length) {
      const latest = recordedPoints[recordedPoints.length - 1];
      const anchor = latest.x > width - 58 ? "end" : "start";
      const labelX = latest.x + (anchor === "end" ? -7 : 7);
      const labelY =
        latest.y < margin.top + 18 ? latest.y + 17 : latest.y - 9;
      latestLabel =
        '<text class="chart-latest-label" x="' +
        labelX.toFixed(1) +
        '" y="' +
        labelY.toFixed(1) +
        '" text-anchor="' +
        anchor +
        '">' +
        latest.record.bedtime +
        "</text>";
    }

    let averageLine = "";
    if (averageY !== null) {
      averageLine =
        '<line class="chart-average" x1="' +
        margin.left +
        '" y1="' +
        averageY.toFixed(1) +
        '" x2="' +
        (width - margin.right) +
        '" y2="' +
        averageY.toFixed(1) +
        '"/>';
    }

    let empty = "";
    if (!recordedPoints.length) {
      const middle = margin.top + plotHeight / 2;
      empty =
        '<path class="chart-empty-wave" d="M' +
        (margin.left + 18) +
        " " +
        (middle + 8) +
        " C" +
        (margin.left + 74) +
        " " +
        (middle - 25) +
        " " +
        (width - margin.right - 90) +
        " " +
        (middle + 40) +
        " " +
        (width - margin.right - 18) +
        " " +
        (middle - 2) +
        '"/>' +
        '<text class="chart-empty-text" x="' +
        (width / 2) +
        '" y="' +
        (middle - 5) +
        '" text-anchor="middle">还没有入睡轨迹</text>' +
        '<text class="chart-empty-sub" x="' +
        (width / 2) +
        '" y="' +
        (middle + 15) +
        '" text-anchor="middle">记录一晚，曲线就会亮起</text>';
    }

    const ariaLabel = summary
      ? "最近 7 晚入睡轨迹，平均 " +
        C.formatHM(summary.average) +
        "，共记录 " +
        summary.count +
        " 晚。"
      : "最近 7 晚入睡轨迹，暂无记录。";

    els.chartWrap.innerHTML =
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      ariaLabel +
      '">' +
      "<defs>" +
      '<linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f3cb93" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="#f3cb93" stop-opacity="0"/>' +
      "</linearGradient>" +
      "</defs>" +
      verticalGrid +
      grid +
      (areaPath
        ? '<path class="chart-area" d="' + areaPath + '"/>'
        : "") +
      (linePath ? '<path class="chart-line" d="' + linePath + '"/>' : "") +
      averageLine +
      dots +
      latestLabel +
      empty +
      xLabels +
      "</svg>";

    els.chartFootNote.textContent = summary
      ? "平均 " + C.formatHM(summary.average)
      : "虚线为平均值";
  }

  function chartDomain(values, center) {
    let min;
    let max;

    if (!values.length) {
      min = center - 180;
      max = center + 180;
    } else {
      min = Math.min.apply(null, values);
      max = Math.max.apply(null, values);
      if (max - min < 24) {
        min -= 45;
        max += 45;
      }
      min -= 40;
      max += 40;
    }

    const minimumSpan = 300;
    if (max - min < minimumSpan) {
      const middle = (min + max) / 2;
      min = middle - minimumSpan / 2;
      max = middle + minimumSpan / 2;
    }

    min = Math.floor(min / 30) * 30;
    max = Math.ceil(max / 30) * 30;
    return { min: min, max: max };
  }

  function renderHistory() {
    const records = state.data.records;
    const currentNight = state.nightKey;
    const currentYear = new Date().getFullYear();
    els.historyCount.textContent = records.length + " 晚";
    els.historyEmpty.hidden = records.length > 0;
    els.historyList.hidden = records.length === 0;

    const visible =
      state.historyExpanded || records.length <= HISTORY_PAGE_SIZE
        ? records
        : records.slice(0, HISTORY_PAGE_SIZE);

    els.historyList.innerHTML = visible
      .map(function (record) {
        const date = C.dateFromKey(record.sleepDate);
        const yearPrefix =
          date.getFullYear() !== currentYear
            ? date.getFullYear() + "年"
            : "";
        const relative = relativeNight(record.sleepDate, currentNight);
        const isLatest = record === records[0];
        return (
          '<article class="history-row' +
          (isLatest ? " is-latest" : "") +
          '">' +
          '<div class="history-date"><strong>' +
          yearPrefix +
          (date.getMonth() + 1) +
          "月" +
          date.getDate() +
          "日</strong><span>" +
          weekdayOf(record.sleepDate) +
          " · " +
          relative +
          '</span></div>' +
          '<div class="history-rail" aria-hidden="true"><i></i></div>' +
          '<div class="history-time"><strong>' +
          record.bedtime +
          "</strong><span>上床</span></div>" +
          '<div class="history-actions">' +
          '<button class="row-action" type="button" data-action="edit" data-id="' +
          escapeHtml(record.id) +
          '" aria-label="修改 ' +
          formatMonthDay(record.sleepDate, true) +
          " 的入睡时间\" title=\"修改\">" +
          EDIT_ICON +
          "</button>" +
          '<button class="row-action" type="button" data-action="delete" data-id="' +
          escapeHtml(record.id) +
          '" aria-label="删除 ' +
          formatMonthDay(record.sleepDate, true) +
          " 的记录\" title=\"删除\">" +
          TRASH_ICON +
          "</button>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (records.length > HISTORY_PAGE_SIZE) {
      els.historyMore.hidden = false;
      els.historyMore.textContent = state.historyExpanded
        ? "收起更早记录"
        : "展开更早记录（" + (records.length - HISTORY_PAGE_SIZE) + " 晚）";
    } else {
      els.historyMore.hidden = true;
    }
  }

  function updateLiveClock() {
    const now = new Date();
    const text = C.formatHM(C.minutesOfDate(now));
    if (els.liveClock.textContent !== text) {
      els.liveClock.textContent = text;
    }
  }

  /* ------------------------------------------------------------------ *
   * 操作
   * ------------------------------------------------------------------ */

  function syncToNow(options) {
    const opts = options || {};
    const now = new Date();
    const minutes = C.minutesOfDate(now);
    state.followsNow = true;
    state.selected = {
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    };
    if (state.mainWheel) {
      state.mainWheel.setValue(state.selected, { animate: false });
    }
    renderSelection();
    if (opts.announce) {
      toast("已对准此刻 " + C.formatHM(minutes));
    }
  }

  function stopFollowing() {
    if (!state.followsNow) return;
    state.followsNow = false;
    renderSelection();
  }

  function onMainWheelChange(value) {
    state.selected = {
      hours: value.hours,
      minutes: value.minutes,
    };
    state.followsNow = false;
    renderSelection();
  }

  function saveSelected() {
    const now = new Date();
    const boundary = currentBoundary();
    const minutes = state.followsNow
      ? C.minutesOfDate(now)
      : state.selected.hours * 60 + state.selected.minutes;
    const bedtime = C.formatHM(minutes);
    const resolved = C.resolveSleepDate(now, minutes, boundary);
    const existingIndex = state.data.records.findIndex(function (record) {
      return record.sleepDate === resolved.sleepDate;
    });
    const timestamp = now.toISOString();
    let updated = false;

    if (existingIndex >= 0) {
      const existing = state.data.records[existingIndex];
      state.data.records[existingIndex] = {
        ...existing,
        bedtime: bedtime,
        bedtimeDate: resolved.bedtimeDate,
        sleepDate: resolved.sleepDate,
        updatedAt: timestamp,
      };
      updated = true;
    } else {
      state.data.records.push({
        id: makeId(),
        bedtime: bedtime,
        bedtimeDate: resolved.bedtimeDate,
        sleepDate: resolved.sleepDate,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    state.data.records.sort(function (a, b) {
      return b.sleepDate.localeCompare(a.sleepDate);
    });
    state.nightKey = C.nightKeyForNow(now, boundary);
    state.selected = {
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    };
    state.followsNow = false;
    if (state.mainWheel) {
      state.mainWheel.setValue(state.selected, { animate: false });
    }

    persist();
    renderAll();
    els.saveBtn.classList.remove("is-pulsing");
    void els.saveBtn.offsetWidth;
    els.saveBtn.classList.add("is-pulsing");
    toast(
      (updated ? "已更新 " : "已记录 ") +
        formatMonthDay(resolved.sleepDate, true) +
        " · " +
        bedtime
    );
  }

  function openSettings() {
    const boundary = currentBoundary();
    openDialog(els.settingsDialog);
    window.requestAnimationFrame(function () {
      if (!state.settingsWheel) {
        state.settingsWheel = new TimeWheel(els.settingsTimePicker, {
          value: {
            hours: Math.floor(boundary / 60),
            minutes: boundary % 60,
          },
          onChange: updateBoundaryHint,
        });
      } else {
        state.settingsWheel.setValue(
          {
            hours: Math.floor(boundary / 60),
            minutes: boundary % 60,
          },
          { animate: false }
        );
      }
      updateBoundaryHint();
    });
  }

  function updateBoundaryHint() {
    const value = state.settingsWheel
      ? state.settingsWheel.getValue()
      : { hours: 5, minutes: 0 };
    const minutes = value.hours * 60 + value.minutes;
    els.boundaryExampleText.textContent =
      boundaryPeriod(minutes) +
      " " +
      C.formatHM(minutes) +
      " 前入睡 → 记在前一晚";
  }

  function saveSettings() {
    if (!state.settingsWheel) return;
    const newBoundary = state.settingsWheel.getMinutes();
    const oldBoundary = currentBoundary();
    if (newBoundary === oldBoundary) {
      els.settingsDialog.close();
      return;
    }

    state.data.settings.boundary = newBoundary;
    const byNight = new Map();
    state.data.records.forEach(function (record) {
      const bedtimeMinutes = C.parseHM(record.bedtime);
      if (bedtimeMinutes === null) return;
      const bedtimeDate = C.isDateKey(record.bedtimeDate)
        ? record.bedtimeDate
        : record.sleepDate;
      const sleepDate = C.sleepDateForBedtime(
        bedtimeDate,
        bedtimeMinutes,
        newBoundary
      );
      const next = {
        ...record,
        sleepDate: sleepDate,
        bedtimeDate: bedtimeDate,
      };
      const existing = byNight.get(sleepDate);
      if (
        !existing ||
        Date.parse(next.updatedAt) >= Date.parse(existing.updatedAt)
      ) {
        byNight.set(sleepDate, next);
      }
    });
    state.data.records = Array.from(byNight.values()).sort(function (a, b) {
      return b.sleepDate.localeCompare(a.sleepDate);
    });
    state.nightKey = C.nightKeyForNow(new Date(), newBoundary);
    if (state.followsNow) {
      syncToNow();
    }
    persist();
    renderAll();
    els.settingsDialog.close();
    toast(
      "睡眠分界点已设为 " +
        boundaryPeriod(newBoundary) +
        " " +
        C.formatHM(newBoundary)
    );
  }

  function openEdit(recordId) {
    const record = findRecordById(recordId);
    if (!record) return;
    const minutes = C.parseHM(record.bedtime);
    if (minutes === null) return;
    state.editingId = recordId;
    els.editEyebrow.textContent =
      formatMonthDay(record.sleepDate, true) +
      " · " +
      weekdayOf(record.sleepDate);
    els.editCopy.textContent = "只调整这一晚的入睡时间，不改变记录日期。";
    openDialog(els.editDialog);
    window.requestAnimationFrame(function () {
      const value = {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      };
      if (!state.editWheel) {
        state.editWheel = new TimeWheel(els.editTimePicker, {
          value: value,
        });
      } else {
        state.editWheel.setValue(value, { animate: false });
      }
    });
  }

  function saveEdit() {
    const record = findRecordById(state.editingId);
    if (!record || !state.editWheel) return;
    const minutes = state.editWheel.getMinutes();
    const bedtime = C.formatHM(minutes);
    const boundary = currentBoundary();
    record.bedtime = bedtime;
    record.bedtimeDate =
      minutes < boundary
        ? C.addDays(record.sleepDate, 1)
        : record.sleepDate;
    record.updatedAt = new Date().toISOString();

    const selectedNight = C.resolveSleepDate(
      new Date(),
      state.selected.hours * 60 + state.selected.minutes,
      boundary
    ).sleepDate;
    if (!state.followsNow && selectedNight === record.sleepDate) {
      state.selected = {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      };
      if (state.mainWheel) {
        state.mainWheel.setValue(state.selected, { animate: false });
      }
    }

    persist();
    renderAll();
    els.editDialog.close();
    toast(
      "已更新 " +
        formatMonthDay(record.sleepDate, true) +
        " · " +
        bedtime
    );
  }

  function askDelete(recordId) {
    const record = findRecordById(recordId);
    if (!record) return;
    state.pendingDeleteId = recordId;
    els.confirmTitle.textContent = "删除这晚记录？";
    els.confirmMessage.textContent =
      formatMonthDay(record.sleepDate, true) +
      " · " +
      record.bedtime +
      " 的记录将被永久删除，无法恢复。";
    openDialog(els.confirmDialog);
  }

  function deletePendingRecord() {
    const record = findRecordById(state.pendingDeleteId);
    if (!record) {
      els.confirmDialog.close();
      return;
    }
    state.data.records = state.data.records.filter(function (item) {
      return item.id !== record.id;
    });
    state.pendingDeleteId = null;
    persist();
    renderAll();
    els.confirmDialog.close();
    toast("已删除 " + formatMonthDay(record.sleepDate, true) + " 的记录");
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function toast(message) {
    els.toastText.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 2600);
  }

  /* ------------------------------------------------------------------ *
   * 事件与启动
   * ------------------------------------------------------------------ */

  function bindEvents() {
    els.saveBtn.addEventListener("click", saveSelected);

    els.syncNowBtn.addEventListener("click", function () {
      syncToNow({ announce: true });
    });

    els.mainTimePicker.addEventListener("pointerdown", stopFollowing);
    els.mainTimePicker.addEventListener("wheel", stopFollowing, {
      passive: true,
    });
    els.mainTimePicker.addEventListener("keydown", function (event) {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        stopFollowing();
      }
    });

    els.openSettingsBtn.addEventListener("click", openSettings);
    els.boundaryChipBtn.addEventListener("click", openSettings);
    els.saveSettingsBtn.addEventListener("click", saveSettings);
    els.resetBoundaryBtn.addEventListener("click", function () {
      if (!state.settingsWheel) return;
      state.settingsWheel.setValue(
        { hours: 5, minutes: 0 },
        { animate: true }
      );
      updateBoundaryHint();
    });

    els.saveEditBtn.addEventListener("click", saveEdit);
    els.confirmActionBtn.addEventListener("click", deletePendingRecord);

    els.rangeSwitch.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-range]");
      if (!button) return;
      const value = button.dataset.range;
      state.range = value === "all" ? "all" : Number(value);
      renderStats();
    });

    els.historyList.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "edit") openEdit(id);
      if (button.dataset.action === "delete") askDelete(id);
    });

    els.historyMore.addEventListener("click", function () {
      state.historyExpanded = !state.historyExpanded;
      renderHistory();
    });

    document
      .querySelectorAll("[data-close-dialog]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          const dialog = document.getElementById(
            button.dataset.closeDialog
          );
          if (dialog) dialog.close();
        });
      });

    document.querySelectorAll("dialog").forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) dialog.close();
      });
    });

    els.editDialog.addEventListener("close", function () {
      state.editingId = null;
    });

    els.confirmDialog.addEventListener("close", function () {
      state.pendingDeleteId = null;
    });

    window.addEventListener("resize", scheduleChartRender);

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(function () {
        scheduleChartRender();
      });
      observer.observe(els.chartWrap);
    }

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tick();
    });
  }

  function tick() {
    const now = new Date();
    const minutes = C.minutesOfDate(now);
    updateLiveClock();

    if (state.followsNow) {
      if (
        minutes !==
        state.selected.hours * 60 + state.selected.minutes
      ) {
        state.selected = {
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
        };
        if (state.mainWheel) {
          state.mainWheel.setValue(state.selected, { animate: false });
        }
        renderSelection();
      }
    } else if (state.lastMinute !== minutes) {
      renderSelection();
    }

    const nightKey = C.nightKeyForNow(now, currentBoundary());
    if (nightKey !== state.nightKey) {
      state.nightKey = nightKey;
      renderSelection();
      renderStats();
      renderHistory();
      scheduleChartRender();
    }
    state.lastMinute = minutes;
  }

  function init() {
    state.data = loadData();
    const now = new Date();
    const minutes = C.minutesOfDate(now);
    const boundary = currentBoundary();
    state.nightKey = C.nightKeyForNow(now, boundary);

    const existing = findRecordBySleepDate(state.nightKey);
    if (existing) {
      const existingMinutes = C.parseHM(existing.bedtime);
      state.selected = {
        hours: Math.floor((existingMinutes || minutes) / 60),
        minutes: (existingMinutes || minutes) % 60,
      };
      state.followsNow = false;
    } else {
      state.selected = {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      };
      state.followsNow = true;
    }

    state.mainWheel = new TimeWheel(els.mainTimePicker, {
      value: state.selected,
      onChange: onMainWheelChange,
    });

    bindEvents();
    updateLiveClock();
    renderAll();
    window.setInterval(tick, 1000);

    if (
      "serviceWorker" in navigator &&
      (location.protocol === "https:" || location.protocol === "http:")
    ) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function () {
          /* 离线缓存不可用时仍可正常使用 */
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
