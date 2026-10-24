const Settings = require('../models/Settings');

async function getSettings() {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
}

module.exports = { getSettings };
