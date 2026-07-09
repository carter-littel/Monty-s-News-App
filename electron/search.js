const {
  deleteSavedSearch,
  querySearch,
  recentSearches,
  rebuildSearchIndex,
  relatedArticles,
  saveSearch,
  savedSearches,
  searchStats,
} = require("./repositories/searchRepo");

function createSearchService(db) {
  function withErrorBoundary(operation) {
    try {
      return operation();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search operation failed",
      };
    }
  }

  return {
    query(input) {
      return querySearch(db, input);
    },
    relatedArticles(articleId) {
      return relatedArticles(db, articleId);
    },
    recent() {
      return recentSearches(db);
    },
    saveSearch(payload) {
      return withErrorBoundary(() => saveSearch(db, payload));
    },
    savedSearches() {
      return savedSearches(db);
    },
    deleteSavedSearch(id) {
      return withErrorBoundary(() => deleteSavedSearch(db, id));
    },
    rebuildIndex() {
      return withErrorBoundary(() => {
        const count = rebuildSearchIndex(db);
        return { success: true, count };
      });
    },
    stats() {
      return searchStats(db);
    },
  };
}

module.exports = {
  createSearchService,
};
