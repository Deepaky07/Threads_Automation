export const getAnalyticsData = async () => {
  return {
    stats: {
      totalReach: 12540,
      totalEngagement: 4823,
      totalPosts: 367,
      averageEngagementRate: 5.6,
    },
    weeklyActivity: [
      { day: 'Mon', posts: 12, engagement: 540, reach: 1080 },
      { day: 'Tue', posts: 15, engagement: 610, reach: 1220 },
      { day: 'Wed', posts: 10, engagement: 480, reach: 960 },
      { day: 'Thu', posts: 18, engagement: 780, reach: 1560 },
      { day: 'Fri', posts: 14, engagement: 650, reach: 1300 },
      { day: 'Sat', posts: 8, engagement: 410, reach: 820 },
      { day: 'Sun', posts: 6, engagement: 320, reach: 640 },
    ],
    engagementByType: [
      { name: 'Likes', value: 2400, percentage: 49.8 },
      { name: 'Comments', value: 1280, percentage: 26.6 },
      { name: 'Shares', value: 720, percentage: 14.9 },
      { name: 'Saves', value: 423, percentage: 8.7 },
    ],
    reachData: [
      { date: '2025-10-21', reach: 420, impressions: 640 },
      { date: '2025-10-22', reach: 580, impressions: 760 },
      { date: '2025-10-23', reach: 690, impressions: 890 },
      { date: '2025-10-24', reach: 870, impressions: 1080 },
      { date: '2025-10-25', reach: 760, impressions: 940 },
      { date: '2025-10-26', reach: 630, impressions: 780 },
      { date: '2025-10-27', reach: 540, impressions: 710 },
    ],
  };
};
