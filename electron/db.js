const fs = require("node:fs");
const Database = require("better-sqlite3");
const { runMigrations } = require("./migrations");
const { getDesktopPaths } = require("./paths");

let db = null;
let paths = null;

function initDb(app) {
  if (db) {
    return db;
  }

  paths = getDesktopPaths(app);
  fs.mkdirSync(paths.userData, { recursive: true });

  db = new Database(paths.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Desktop database has not been initialized");
  }

  return db;
}

function getDbPath() {
  if (!paths) {
    throw new Error("Desktop paths have not been initialized");
  }

  return paths.dbPath;
}

function getUserDataPath() {
  if (!paths) {
    throw new Error("Desktop paths have not been initialized");
  }

  return paths.userData;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  closeDb,
  getDb,
  getDbPath,
  getUserDataPath,
  initDb,
};
