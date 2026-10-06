"""
Main FastAPI entry point for AI MemoVault backend.
Configures CORS, registers all routes, exception handlers, health/ready probes, and seeds demo data.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS, SEED_DEMO
from app.exceptions import VaultException
from app.api.deps import db_storage, index_manager, auth_service, memory_manager
from app.api.auth_routes import router as auth_router
from app.api.memory_routes import router as memory_router
from app.api.attachment_routes import router as attachment_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.feature_routes import router as feature_router
from app.api.ai_routes import router as ai_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("memovault.main")


def seed_demo_data_if_needed() -> None:
    """Seeds initial demo records into SQLite DB if empty and SEED_DEMO is True."""
    if not SEED_DEMO:
        return

    demo_user = db_storage.get_user_by_username("Thivisha")
    if not demo_user:
        logger.info("Seeding demo user 'Thivisha' in database...")
        demo_user = auth_service.register("Thivisha", "demo123", display_name="Thivisha R")

    user_memories = db_storage.list_memories(demo_user["id"], limit=10)
    if not user_memories:
        logger.info("Seeding demo memories for user 'Thivisha' in database...")
        seed_records = [
            (
                "Started Java unit 3",
                "2025-08-04",
                "Began the third unit of the Java Programming course covering collections and exception handling.",
                "STUDY",
                "calm",
                "College Campus",
                ["java", "college"],
            ),
            (
                "Coding club build night",
                "2025-11-21",
                "Attended the coding club 24 hour build night event at college with the team.",
                "EVENT",
                "excited",
                "Innovation Lab",
                ["coding", "team", "hackathon"],
            ),
            (
                "SIH internal round",
                "2026-03-02",
                "Selected in the Smart India Hackathon internal college evaluation round among top teams.",
                "ACHIEVEMENT",
                "proud",
                "Auditorium",
                ["hackathon", "sih", "competition"],
            ),
            (
                "Family trip to Thanjavur",
                "2026-06-18",
                "Visited the historic Brihadisvara temple and spent time exploring Thanjavur with family.",
                "TRAVEL",
                "happy",
                "Brihadisvara Temple, Thanjavur",
                ["travel", "family", "temple"],
            ),
            (
                "PBL review 2 submission",
                "2026-09-01",
                "Submit project-based learning review 2 documentation and presentation before the deadline tomorrow.",
                "REMINDER",
                "neutral",
                "Classroom B302",
                ["pbl", "deadline", "submission"],
            ),
            (
                "First Hackathon",
                "2026-09-16",
                "Participated in an AI hackathon at CIT and presented a voice assistance project with my team.",
                "ACHIEVEMENT",
                "excited",
                "CIT Chennai",
                ["hackathon", "ai", "presentation"],
            ),
        ]

        for title, date_str, desc, cat, mood, loc, tags in seed_records:
            memory_manager.create_memory(
                owner_id=demo_user["id"],
                title=title,
                date_str=date_str,
                description=desc,
                category=cat,
                mood=mood,
                location_name=loc,
                tags=tags,
            )
        logger.info("Demo database seeding completed successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    seed_demo_data_if_needed()
    yield


app = FastAPI(
    title="AI MemoVault API",
    description="Professional Personal Memory Platform with BM25 Lexical AI, Attachments, and Database Storage.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(memory_router)
app.include_router(attachment_router)
app.include_router(dashboard_router)
app.include_router(feature_router)
app.include_router(ai_router)


# Global Exception Handlers
@app.exception_handler(VaultException)
async def vault_exception_handler(request: Request, exc: VaultException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unexpected exception occurred:")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": f"Unexpected problem: {str(exc)}"},
    )


@app.get("/api/health", tags=["Health"])
def health_check() -> dict:
    """Liveness probe."""
    return {
        "status": "ok",
        "app": "AI MemoVault",
        "version": "2.0.0",
        "database": "SQLite (memovault.db)",
    }


@app.get("/api/ready", tags=["Health"])
def readiness_check() -> dict:
    """Readiness probe checking database connectivity."""
    try:
        with db_storage.get_db_cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()
        return {"ready": True, "database_connected": True}
    except Exception as e:
        return JSONResponse(status_code=503, content={"ready": False, "error": str(e)})
