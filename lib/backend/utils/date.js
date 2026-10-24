const Holiday = require('../models/Holiday');

function isoDate(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function parseDate(s) {
  // returns Date at UTC midnight
  const [y, m, day] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function isWeekend(date, weekendDays) {
  return weekendDays.includes(date.getUTCDay());
}

async function isHoliday(date) {
  const holidays = await Holiday.find();
  const key = date.toISOString().slice(0, 10);
  return holidays.some((h) => {
    const hd = new Date(h.date);
    if (h.recurring) return hd.getUTCMonth() === date.getUTCMonth() && hd.getUTCDate() === date.getUTCDate();
    return hd.toISOString().slice(0, 10) === key;
  });
}

async function isWorkingDay(date, weekendDays) {
  if (isWeekend(date, weekendDays)) return false;
  if (await isHoliday(date)) return false;
  return true;
}

// count working days between two dates inclusive
async function countWorkingDays(start, end, weekendDays) {
  let count = 0;
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    if (await isWorkingDay(d, weekendDays)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// list working dates between
async function workingDates(start, end, weekendDays) {
  const out = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    if (await isWorkingDay(d, weekendDays)) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function minutesOfDay(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

module.exports = { isoDate, parseDate, isWeekend, isHoliday, isWorkingDay, countWorkingDays, workingDates, addDays, minutesOfDay };