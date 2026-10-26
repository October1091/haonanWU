const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../sleep-core.js");

test("解析与格式化分钟", () => {
  assert.equal(core.parseHM("05:00"), 300);
  assert.equal(core.parseHM("5:07"), 307);
  assert.equal(core.parseHM("24:00"), null);
  assert.equal(core.parseHM("5:7"), null);
  assert.equal(core.formatHM(0), "00:00");
  assert.equal(core.formatHM(1440), "00:00");
  assert.equal(core.formatHM(1439), "23:59");
});

test("分界点决定此刻属于哪一晚", () => {
  const lateNight = new Date(2026, 9, 27, 1, 30);
  const morning = new Date(2026, 9, 27, 5, 1);
  const exactBoundary = new Date(2026, 9, 27, 5, 0);
  const afternoon = new Date(2026, 9, 27, 14, 0);
  assert.equal(core.nightKeyForNow(lateNight, 300), "2026-10-26");
  assert.equal(core.nightKeyForNow(morning, 300), "2026-10-27");
  assert.equal(core.nightKeyForNow(exactBoundary, 300), "2026-10-27");
  assert.equal(core.nightKeyForNow(afternoon, 300), "2026-10-27");
  assert.equal(core.nightKeyForNow(lateNight, 120), "2026-10-26");
});

test("分界点前后入睡的日期归属", () => {
  assert.equal(
    core.sleepDateForBedtime("2026-10-27", 4 * 60 + 59, 300),
    "2026-10-26"
  );
  assert.equal(
    core.sleepDateForBedtime("2026-10-27", 5 * 60, 300),
    "2026-10-27"
  );
  assert.equal(
    core.sleepDateForBedtime("2026-10-27", 2 * 60 + 30, 300),
    "2026-10-26"
  );
});

test("入睡时刻定位到最接近的日期", () => {
  const now = new Date(2026, 9, 27, 1, 10);
  assert.equal(core.bedtimeDateFor(now, 70), "2026-10-27");
  assert.equal(core.bedtimeDateFor(now, 23 * 60 + 40), "2026-10-26");
  assert.equal(
    core.resolveSleepDate(now, 70, 300).sleepDate,
    "2026-10-26"
  );
  assert.equal(
    core.resolveSleepDate(now, 23 * 60 + 40, 300).sleepDate,
    "2026-10-26"
  );
});

test("跨午夜的平均入睡时间", () => {
  const result = core.averageTimes([23 * 60 + 50, 10]);
  assert.equal(result.average, 0);
  assert.equal(core.formatHM(result.average), "00:00");
  assert.ok(result.sd >= 10 && result.sd <= 11);
  assert.equal(result.earliest, 23 * 60 + 50);
  assert.equal(result.latest, 10);
});

test("平均时间不会偏向两端", () => {
  const result = core.averageTimes([22 * 60, 2 * 60]);
  assert.equal(result.average, 0);
  assert.equal(result.sd, 120);
});

test("全部落在分界点之后很早的时间也能正确平均", () => {
  const result = core.averageTimes([5 * 60 + 10, 5 * 60 + 30]);
  assert.equal(result.average, 5 * 60 + 20);
  assert.equal(result.sd, 10);
});

test("分界点两侧的入睡时间平均到分界点", () => {
  const result = core.averageTimes([4 * 60 + 50, 5 * 60 + 10]);
  assert.equal(result.average, 5 * 60);
  assert.equal(result.sd, 10);
  assert.equal(result.earliest, 4 * 60 + 50);
  assert.equal(result.latest, 5 * 60 + 10);
  assert.equal(core.averageOffsetFromBoundary(result.average, 300), 0);
});

test("近 N 晚与上一周期筛选", () => {
  const records = [
    { sleepDate: "2026-10-26", bedtime: "23:30" },
    { sleepDate: "2026-10-25", bedtime: "00:10" },
    { sleepDate: "2026-10-20", bedtime: "22:50" },
    { sleepDate: "2026-10-18", bedtime: "01:10" },
  ];
  const current = core.recordsInNights(records, "2026-10-26", 7);
  assert.deepEqual(
    current.map((record) => record.sleepDate),
    ["2026-10-26", "2026-10-25", "2026-10-20"]
  );
  const previous = core.recordsInPreviousNights(
    records,
    "2026-10-26",
    7
  );
  assert.deepEqual(
    previous.map((record) => record.sleepDate),
    ["2026-10-18"]
  );
});

test("周期比较方向", () => {
  assert.equal(core.formatDelta(12), "晚 12 分钟");
  assert.equal(core.formatDelta(-65), "早 1 小时 5 分");
  assert.equal(core.formatDelta(0), "基本持平");
  assert.equal(
    core.signedCircularDiff(10, 23 * 60 + 50),
    20
  );
});

test("时刻氛围文案", () => {
  assert.equal(core.periodOfDay(0), "凌晨");
  assert.equal(core.periodOfDay(23 * 60 + 47), "深夜");
  assert.equal(core.periodOfDay(5 * 60), "清晨");
  assert.equal(core.periodOfDay(20 * 60), "晚上");
});

test("日期增减跨月", () => {
  assert.equal(core.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(core.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(core.daysBetween("2026-10-20", "2026-10-26"), 6);
});
