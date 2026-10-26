/* 枕边 · 睡眠记录 — 与界面无关的时间计算 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SleepCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAY = 1440;
  var DEFAULT_BOUNDARY = 5 * 60;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function parseHM(value) {
    if (typeof value !== "string") return null;
    var match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function formatHM(totalMinutes) {
    var value = mod(Math.round(Number(totalMinutes) || 0), DAY);
    return pad2(Math.floor(value / 60)) + ":" + pad2(value % 60);
  }

  function toDateKey(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-");
  }

  function isDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    var date = dateFromKey(value);
    return toDateKey(date) === value;
  }

  function dateFromKey(key) {
    var parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function addDays(key, amount) {
    var date = dateFromKey(key);
    date.setDate(date.getDate() + amount);
    return toDateKey(date);
  }

  function daysBetween(fromKey, toKey) {
    var from = dateFromKey(fromKey);
    var to = dateFromKey(toKey);
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  function minutesOfDate(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  /** 此刻属于哪一晚：分界点之前，算作前一晚。 */
  function nightKeyForNow(date, boundary) {
    var key = toDateKey(date);
    return minutesOfDate(date) < boundary ? addDays(key, -1) : key;
  }

  /**
   * 入睡时刻实际发生在哪一天。
   * 选中的钟点最接近“此刻”的那一次，避免凌晨打开时误落到明天。
   */
  function bedtimeDateFor(now, bedtimeMinutes) {
    var base = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(bedtimeMinutes / 60),
      bedtimeMinutes % 60,
      0,
      0
    );
    var best = base;
    var bestDistance = Math.abs(base.getTime() - now.getTime());

    for (var offset = -1; offset <= 1; offset += 1) {
      if (offset === 0) continue;
      var candidate = new Date(base);
      candidate.setDate(base.getDate() + offset);
      var distance = Math.abs(candidate.getTime() - now.getTime());
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return toDateKey(best);
  }

  function sleepDateForBedtime(bedtimeDate, bedtimeMinutes, boundary) {
    return bedtimeMinutes < boundary
      ? addDays(bedtimeDate, -1)
      : bedtimeDate;
  }

  function resolveSleepDate(now, bedtimeMinutes, boundary) {
    var bedtimeDate = bedtimeDateFor(now, bedtimeMinutes);
    return {
      bedtimeDate: bedtimeDate,
      sleepDate: sleepDateForBedtime(
        bedtimeDate,
        bedtimeMinutes,
        boundary
      ),
    };
  }

  function signedCircularDiff(a, b) {
    return mod(a - b + DAY / 2, DAY) - DAY / 2;
  }

  function shortestDistance(a, b) {
    return Math.abs(signedCircularDiff(a, b));
  }

  function unwrapNear(value, center) {
    var result = value;
    while (result - center > DAY / 2) result -= DAY;
    while (result - center < -DAY / 2) result += DAY;
    return result;
  }

  function averageTimes(times) {
    if (!times.length) return null;

    var sinSum = 0;
    var cosSum = 0;
    times.forEach(function (minutes) {
      var angle = (mod(minutes, DAY) / DAY) * Math.PI * 2;
      sinSum += Math.sin(angle);
      cosSum += Math.cos(angle);
    });

    var angle = Math.atan2(sinSum, cosSum);
    var average = mod(Math.round((angle / (Math.PI * 2)) * DAY), DAY);

    var deltas = times.map(function (minutes) {
      return signedCircularDiff(minutes, average);
    });
    var variance =
      deltas.reduce(function (sum, delta) {
        return sum + delta * delta;
      }, 0) / times.length;
    var sd = Math.round(Math.sqrt(variance));

    var earliestIndex = 0;
    var latestIndex = 0;
    deltas.forEach(function (delta, index) {
      if (delta < deltas[earliestIndex]) earliestIndex = index;
      if (delta > deltas[latestIndex]) latestIndex = index;
    });

    return {
      count: times.length,
      average: average,
      sd: sd,
      earliest: mod(times[earliestIndex], DAY),
      latest: mod(times[latestIndex], DAY),
      spread: deltas[latestIndex] - deltas[earliestIndex],
    };
  }

  function averageRecords(records) {
    var times = (records || [])
      .map(function (record) {
        if (typeof record === "number") return mod(record, DAY);
        var parsed = parseHM(record && record.bedtime);
        return parsed === null ? null : parsed;
      })
      .filter(function (time) {
        return time !== null;
      });
    return averageTimes(times);
  }

  function periodOfDay(minutes) {
    var value = mod(minutes, DAY);
    if (value < 5 * 60) return "凌晨";
    if (value < 8 * 60) return "清晨";
    if (value < 11 * 60) return "上午";
    if (value < 13 * 60) return "中午";
    if (value < 18 * 60) return "下午";
    if (value < 23 * 60) return "晚上";
    return "深夜";
  }

  function formatDuration(totalMinutes) {
    var value = Math.max(0, Math.round(totalMinutes));
    if (value < 60) return value + " 分钟";
    var hours = Math.floor(value / 60);
    var minutes = value % 60;
    if (!minutes) return hours + " 小时";
    return hours + " 小时 " + minutes + " 分";
  }

  function formatDelta(totalMinutes) {
    var abs = Math.abs(totalMinutes);
    if (abs < 1) return "基本持平";
    return (totalMinutes > 0 ? "晚 " : "早 ") + formatDuration(abs);
  }

  function rangeNightKeys(currentNightKey, count) {
    var keys = [];
    for (var index = count - 1; index >= 0; index -= 1) {
      keys.push(addDays(currentNightKey, -index));
    }
    return keys;
  }

  function recordsInNights(records, currentNightKey, count) {
    var keys = rangeNightKeys(currentNightKey, count);
    var lookup = new Set(keys);
    return (records || []).filter(function (record) {
      return lookup.has(record.sleepDate);
    });
  }

  function recordsInPreviousNights(records, currentNightKey, count) {
    var end = addDays(currentNightKey, -count);
    return recordsInNights(records, end, count);
  }

  function averageOffsetFromBoundary(average, boundary) {
    return average === null || average === undefined
      ? null
      : mod(average - boundary, DAY);
  }

  return {
    DAY: DAY,
    DEFAULT_BOUNDARY: DEFAULT_BOUNDARY,
    pad2: pad2,
    mod: mod,
    parseHM: parseHM,
    formatHM: formatHM,
    toDateKey: toDateKey,
    isDateKey: isDateKey,
    dateFromKey: dateFromKey,
    addDays: addDays,
    daysBetween: daysBetween,
    minutesOfDate: minutesOfDate,
    nightKeyForNow: nightKeyForNow,
    bedtimeDateFor: bedtimeDateFor,
    sleepDateForBedtime: sleepDateForBedtime,
    resolveSleepDate: resolveSleepDate,
    signedCircularDiff: signedCircularDiff,
    shortestDistance: shortestDistance,
    unwrapNear: unwrapNear,
    averageTimes: averageTimes,
    averageRecords: averageRecords,
    periodOfDay: periodOfDay,
    formatDuration: formatDuration,
    formatDelta: formatDelta,
    rangeNightKeys: rangeNightKeys,
    recordsInNights: recordsInNights,
    recordsInPreviousNights: recordsInPreviousNights,
    averageOffsetFromBoundary: averageOffsetFromBoundary,
  };
});
