function getCustomSources(db) {
  return db
    .prepare("SELECT name, url, category FROM custom_sources ORDER BY id ASC")
    .all();
}

function listCustomSources(db) {
  return db
    .prepare("SELECT id, name, url, category, created_at FROM custom_sources ORDER BY id ASC")
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      category: row.category,
      createdAt: row.created_at,
    }));
}

function addCustomSource(db, { name, url, category }) {
  try {
    const createdAt = new Date().toISOString();
    const result = db
      .prepare(
        "INSERT INTO custom_sources (name, url, category, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(name, url, category, createdAt);
    return {
      success: true,
      source: { id: result.lastInsertRowid, name, url, category, createdAt },
    };
  } catch (error) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.code === "SQLITE_CONSTRAINT") {
      return { success: false, error: "This feed is already added." };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not add source",
    };
  }
}

function removeCustomSource(db, id) {
  const result = db.prepare("DELETE FROM custom_sources WHERE id = ?").run(id);
  return { success: result.changes > 0 };
}

module.exports = {
  getCustomSources,
  listCustomSources,
  addCustomSource,
  removeCustomSource,
};
