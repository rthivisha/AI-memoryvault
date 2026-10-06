"""
Dashboard API route handlers.
Provides aggregated KPIs, timelines, heatmaps, and throwbacks.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.api.deps import dashboard_service, get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Aggregations"])


@router.get("/summary")
def get_dashboard_summary(
    range: str = Query("1Y", description="'6M', '1Y', or 'ALL'"),
    current_user: dict = Depends(get_current_user),
):
    return dashboard_service.get_dashboard_summary(current_user["id"], range_filter=range)
