(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function interpolateRank(chapters) {
    const points = [
      { chapters: 0, air: 1500000 },
      { chapters: 10, air: 50000 },
      { chapters: 20, air: 45000 },
      { chapters: 30, air: 35000 },
      { chapters: 40, air: 25000 },
      { chapters: 50, air: 16000 },
      { chapters: 55, air: 10000 },
      { chapters: 60, air: 6000 },
      { chapters: 65, air: 2500 },
      { chapters: 70, air: 800 },
      { chapters: 73, air: 200 },
      { chapters: 75, air: 50 }
    ];

    if (chapters <= 0) return 1500000;
    if (chapters >= 75) return 50;

    for (let i = 0; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      if (chapters >= current.chapters && chapters <= next.chapters) {
        const ratio = (chapters - current.chapters) / (next.chapters - current.chapters);
        return Math.round(current.air + (next.air - current.air) * ratio);
      }
    }

    return points[points.length - 1].air;
  }

  function calculateRank(user) {
    if (!user) return 1500000;

    const chapters = clamp(Number(user.chaptersStudied || 0), 0, 75);
    const lecture = Number(user.timers?.lecture || 0);
    const practice = Number(user.timers?.practice || 0);
    const revision = Number(user.timers?.revision || 0);
    const totalMinutes = lecture + practice + revision;

    const chapterAIR = interpolateRank(chapters);
    const studyBoost = Math.min(0.35, totalMinutes / 22000);
    const timeAdjustedAIR = Math.max(1, Math.round(chapterAIR * (1 - studyBoost)));

    return timeAdjustedAIR;
  }

  function getRankDelta(user, baseRank = 1500000) {
    return Math.max(0, baseRank - calculateRank(user));
  }

  window.JEELogic = {
    calculateRank,
    getRankDelta,
    clamp,
    interpolateRank
  };
})();
