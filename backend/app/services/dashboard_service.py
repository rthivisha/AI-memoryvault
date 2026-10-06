"""
Dashboard Aggregation Service for AI MemoVault.
Calculates real-time metrics: streaks, storage quotas, monthly timelines,
category donut distributions, activity heatmaps, mood breakdowns, map coordinates, and "On this day" throwbacks.
"""

from datetime import datetime, date, timedelta
from typing import Optional
from collections import Counter

from app.storage.db_storage import DBStorage
from app.services.ai_service import AIService


class DashboardService:
    """Aggregates multi-dimensional statistics for the professional dashboard."""

    def __init__(self, db: DBStorage) -> None:
        self.db: DBStorage = db

    def get_dashboard_summary(self, owner_id: str, range_filter: str = "1Y") -> dict:
        """
        Returns consolidated metrics for dashboard widgets.
        range_filter: '6M', '1Y', 'ALL'
        """
        all_memories = self.db.list_memories(owner_id, limit=5000)
        today = date.today()
        today_str = today.isoformat()
        current_year = today.year
        current_month = today.strftime("%Y-%m")

        # 1. Total and This Month count
        total_memories = len(all_memories)
        this_month_count = sum(1 for m in all_memories if m["memory_date"].startswith(current_month))
        favorites_count = sum(1 for m in all_memories if m.get("is_favorite"))

        # 2. Storage used (from attachments)
        attachments = self.db.list_all_media_attachments(owner_id, mime_prefix="")
        storage_used_bytes = sum(a["file_size"] for a in attachments)
        storage_quota_bytes = 500 * 1024 * 1024  # 500 MB quota

        # 3. Streaks (consecutive days with at least one memory)
        memory_dates_set = {m["memory_date"] for m in all_memories if m.get("memory_date")}
        sorted_dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in memory_dates_set])

        current_streak = 0
        longest_streak = 0

        # Calculate current streak ending today or yesterday
        check_date = today
        if check_date not in sorted_dates:
            check_date = today - timedelta(days=1)

        while check_date in sorted_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        # Calculate longest streak
        if sorted_dates:
            temp_streak = 1
            longest_streak = 1
            for i in range(1, len(sorted_dates)):
                if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
                    temp_streak += 1
                    if temp_streak > longest_streak:
                        longest_streak = temp_streak
                elif sorted_dates[i] > sorted_dates[i - 1] + timedelta(days=1):
                    temp_streak = 1

        # 4. Reminders stats
        reminders = self.db.list_reminders(owner_id, include_completed=False)
        upcoming_reminders_count = len(reminders)
        now_iso = datetime.utcnow().isoformat()
        overdue_reminders = [r for r in reminders if r["due_at"] < now_iso]

        # 5. Timeline / Memories over time (monthly aggregation)
        # Determine cutoff based on range_filter
        if range_filter == "6M":
            cutoff_date = (today - timedelta(days=180)).strftime("%Y-%m")
        elif range_filter == "1Y":
            cutoff_date = (today - timedelta(days=365)).strftime("%Y-%m")
        else:
            cutoff_date = "1970-01"

        month_counts: dict[str, int] = {}
        for m in all_memories:
            m_date = m["memory_date"][:7]
            if m_date >= cutoff_date:
                month_counts[m_date] = month_counts.get(m_date, 0) + 1

        sorted_months = sorted(month_counts.keys())
        timeline_data = [{"month": m, "count": month_counts[m]} for m in sorted_months]

        # 6. Category breakdown
        category_counts: dict[str, int] = {}
        for m in all_memories:
            cat = m["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # 7. Mood distribution
        mood_counts: dict[str, int] = {
            "happy": 0, "proud": 0, "calm": 0, "excited": 0, "neutral": 0, "sad": 0
        }
        for m in all_memories:
            mood = m.get("mood") or "neutral"
            if mood in mood_counts:
                mood_counts[mood] += 1

        # 8. GitHub-style Activity Heatmap (last 365 days)
        one_year_ago = today - timedelta(days=365)
        heatmap_counts: dict[str, int] = {}
        for m in all_memories:
            d_str = m["memory_date"]
            if d_str >= one_year_ago.isoformat():
                heatmap_counts[d_str] = heatmap_counts.get(d_str, 0) + 1

        # 9. Top Keywords Word Cloud (TF-IDF from user corpus)
        corpus_keywords: list[str] = []
        for m in all_memories:
            corpus_keywords.extend(m.get("keywords") or [])
        keyword_freq = Counter(corpus_keywords).most_common(25)
        word_cloud = [{"text": k, "value": count} for k, count in keyword_freq]

        # 10. "On This Day" (memories from same month-day in previous years)
        current_md = today.strftime("%m-%d")
        on_this_day_memories = [
            m for m in all_memories
            if m["memory_date"].endswith(current_md) and not m["memory_date"].startswith(str(current_year))
        ]

        # 11. Geo-located Memories for Map Pins
        geo_memories = [
            {
                "id": m["id"],
                "title": m["title"],
                "category": m["category"],
                "date": m["memory_date"],
                "location_name": m["location_name"],
                "latitude": m["latitude"],
                "longitude": m["longitude"],
            }
            for m in all_memories
            if m.get("latitude") is not None and m.get("longitude") is not None
        ]

        return {
            "kpis": {
                "totalMemories": total_memories,
                "thisMonthCount": this_month_count,
                "currentStreak": current_streak,
                "longestStreak": longest_streak,
                "storageUsedBytes": storage_used_bytes,
                "storageQuotaBytes": storage_quota_bytes,
                "favoritesCount": favorites_count,
                "upcomingRemindersCount": upcoming_reminders_count,
                "overdueRemindersCount": len(overdue_reminders),
            },
            "timeline": timeline_data,
            "categoryBreakdown": [{"name": k, "value": v} for k, v in category_counts.items()],
            "moodDistribution": [{"mood": k, "count": v} for k, v in mood_counts.items()],
            "activityHeatmap": heatmap_counts,
            "wordCloud": word_cloud,
            "onThisDay": on_this_day_memories[:5],
            "geoPins": geo_memories,
            "upcomingReminders": reminders[:5],
            "overdueReminders": overdue_reminders[:5],
        }
