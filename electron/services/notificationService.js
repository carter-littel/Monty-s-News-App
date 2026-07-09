function createNotificationService(Notification) {
  const notifiedUrls = new Set();

  function requestStatus() {
    return {
      supported: Boolean(Notification?.isSupported?.()),
    };
  }

  function shouldNotify(article, preferences) {
    if (!preferences.notificationsEnabled || !Notification?.isSupported?.()) {
      return false;
    }

    const key = article.url ?? article.id;
    if (notifiedUrls.has(key)) {
      return false;
    }

    const threshold = Number(preferences.notificationImportanceThreshold ?? 5);
    const personalizedScore = Number(article.personalized_score ?? 0);

    return Number(article.importance ?? 0) >= threshold || personalizedScore >= threshold;
  }

  function notifyImportantArticles(articles, preferences) {
    const candidates = articles.filter((article) => shouldNotify(article, preferences)).slice(0, 3);

    for (const article of candidates) {
      try {
        const key = article.url ?? article.id;
        notifiedUrls.add(key);
        const notification = new Notification({
          title: "High-signal tech story",
          body: article.headline,
          silent: false,
        });
        notification.show();
      } catch {
        // Notification failures should never break refresh.
      }
    }

    return candidates.length;
  }

  return {
    notifyImportantArticles,
    requestStatus,
  };
}

module.exports = {
  createNotificationService,
};
