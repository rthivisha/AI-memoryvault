"""
Main FastAPI entry point for AI MemoVault backend.
Configures CORS, registers routes, exception handlers, and seeds demo data on startup.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS, SEED_DEMO
from app.exceptions import VaultException
from app.api.deps import storage, index_manager, auth_service, memory_manager
from app.api.auth_routes import router as auth_router
from app.api.memory_routes import router as memory_router
from app.api.ai_routes import router as ai_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("memovault.main")


def seed_demo_data_if_needed() -> None:
    """
    Seeds initial demo records if memories file is empty and SEED_DEMO is True.
    Demo user: 'Thivisha' / password: 'demo123'
    """
    if not SEED_DEMO:
        return

    users = storage.load_users()
    demo_user = next((u for u in users if u.username.lower() == "thivisha"), None)

    if not demo_user:
        logger.info("Seeding demo user 'Thivisha'...")
        demo_user = auth_service.register("Thivisha", "demo123")

    existing_memories = storage.load_memories()
    user_memories = [m for m in existing_memories if m.owner_id == demo_user.user_id]

    if not user_memories:
        logger.info("Seeding demo memories for user 'Thivisha'...")
        seed_records = [
            (
                "Started Java unit 3",
                "2025-08-04",
                "Began the third unit of the Java Programming course covering collections and exception handling.",
                "STUDY",
            ),
            (
                "Coding club build night",
                "2025-11-21",
                "Attended the coding club 24 hour build night event at college with the team.",
                "EVENT",
            ),
            (
                "SIH internal round",
                "2026-03-02",
                "Selected in the Smart India Hackathon internal college evaluation round among top teams.",
                "ACHIEVEMENT",
            ),
            (
                "Family trip to Thanjavur",
                "2026-06-18",
                "Visited the historic Brihadisvara temple and spent time exploring Thanjavur with family.",
                "TRAVEL",
            ),
            (
                "PBL review 2 submission",
                "2026-09-01",
                "Submit project-based learning review 2 documentation and presentation before the deadline tomorrow.",
                "REMINDER",
            ),
            (
                "First Hackathon",
                "2026-09-16",
                "Participated in an AI hackathon at CIT and presented a voice assistance project with my team.",
                "ACHIEVEMENT",
            ),
        ]

        for title, date_str, desc, cat in seed_records:
            memory_manager.create_memory(
                owner_id=demo_user.user_id,
                title=title,
                date_str=date_str,
                description=desc,
                category=cat,
            )
        logger.info("Demo data seeding completed successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context for initialization and cleanup."""
    seed_demo_data_if_needed()
    # Rebuild inverted index from persisted storage
    index_manager.rebuild(storage.load_memories())
    yield


app = FastAPI(
    title="AI MemoVault API",
    description="Secure Personal Digital Memory Management System with hand-crafted Lexical AI retrieval.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth_router)
app.include_router(memory_router)
app.include_router(ai_router)


# Global Exception Handlers
@app.exception_handler(VaultException)
async def vault_exception_handler(request: Request, exc: VaultException) -> JSONResponse:
    """Catches all domain VaultExceptions and returns unified JSON format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unexpected exceptions to prevent server crash."""
    logger.exception("Unexpected exception occurred:")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": f"Unexpected problem: {str(exc)}"},
    )


@app.get("/api/health", tags=["Health"])
def health_check() -> dict:
    """System health check endpoint."""
    return {
        "status": "ok",
        "app": "AI MemoVault",
        "version": "1.0.0",
        "storageWarnings": len(storage.warnings),
    }
