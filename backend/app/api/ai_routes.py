"""
AI Intelligence API route handlers.
Provides live classification, auto-title generation, extractive auto-summary,
synonym management, and optional Google Gemini memory recap summaries.
"""

from typing import Optional, List, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user, memory_manager, db_storage
from app.services.ai_service import AIService, DEFAULT_SYNONYMS

router = APIRouter(prefix="/api/ai", tags=["AI & NLP"])


class TextPayloadDTO(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""


class SynonymsUpdateDTO(BaseModel):
    synonyms: Dict[str, List[str]]


@router.post("/suggest")
def suggest_category_and_keywords(
    req: TextPayloadDTO,
    current_user: dict = Depends(get_current_user),
):
    category, confidence = AIService.classify(req.title or "", req.description or "")
    tokens = AIService.tokenize(f"{req.title} {req.description}")
    corpus = memory_manager._get_user_corpus_texts(current_user["id"])
    keywords = AIService.extract_keywords(corpus, req.title or "", req.description or "")

    return {
        "category": category,
        "confidence": confidence,
        "keywords_preview": keywords,
        "tokens": tokens,
    }


@router.post("/auto-title")
def generate_auto_title(
    req: TextPayloadDTO,
    current_user: dict = Depends(get_current_user),
):
    text = req.description or req.title or ""
    title = AIService.generate_auto_title(text)
    return {"suggestedTitle": title}


@router.post("/auto-summary")
def generate_auto_summary(
    req: TextPayloadDTO,
    current_user: dict = Depends(get_current_user),
):
    text = req.description or ""
    summary = AIService.extract_auto_summary(text)
    return {"summary": summary}


@router.get("/synonyms")
def get_synonyms(current_user: dict = Depends(get_current_user)):
    user = db_storage.get_user_by_id(current_user["id"])
    settings = {}
    if user and user.get("settings"):
        import json
        try:
            settings = json.loads(user["settings"])
        except Exception:
            pass
    custom = settings.get("synonyms", {})
    return {"default": DEFAULT_SYNONYMS, "custom": custom}


@router.post("/synonyms")
def update_synonyms(
    req: SynonymsUpdateDTO,
    current_user: dict = Depends(get_current_user),
):
    user = db_storage.get_user_by_id(current_user["id"])
    settings = {}
    if user and user.get("settings"):
        import json
        try:
            settings = json.loads(user["settings"])
        except Exception:
            pass
    settings["synonyms"] = req.synonyms
    db_storage.update_user_settings(current_user["id"], settings)
    return {"message": "Custom synonyms saved successfully."}


@router.post("/recap")
def generate_memory_recap(
    current_user: dict = Depends(get_current_user),
):
    """Generates an intelligent narrative recap of recent memories using Gemini if configured, or extractive lexical recap."""
    memories = memory_manager.get_memories_for_user(current_user["id"], limit=10)
    if not memories:
        return {"recap": "No memories recorded yet to recap."}

    combined_text = "\n".join([f"- [{m['category']}] {m['title']}: {m['description']}" for m in memories])

    # Try Gemini LLM provider if GEMINI_API_KEY is available
    llm_recap = AIService.query_gemini_recap(combined_text)
    if llm_recap:
        return {"recap": llm_recap, "source": "gemini"}

    # Fallback to lexical extractive summary
    lexical_summaries = [AIService.extract_auto_summary(m["description"]) for m in memories[:3]]
    fallback = f"Your recent highlights include: {' '.join(s for s in lexical_summaries if s)}."
    return {"recap": fallback, "source": "lexical"}
