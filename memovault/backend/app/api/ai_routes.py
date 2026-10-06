"""
AI Lexical processing route handlers for live preview and classification.
"""

from fastapi import APIRouter, Depends
from app.models.memory import SuggestRequest, SuggestResponse
from app.models.user import User
from app.services.ai_service import AIService
from app.api.deps import get_current_user, memory_manager

router = APIRouter(prefix="/api/ai", tags=["Intelligent Layer"])


@router.post("/suggest", response_model=SuggestResponse)
def suggest_category_and_keywords(
    req: SuggestRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Live AI preview endpoint (no record saved):
    - Tokenizes text with stop-word elimination.
    - Classifies category using weighted lexicon model and returns confidence.
    - Previews TF-IDF keywords extracted against the user's current corpus.
    """
    category, confidence = AIService.classify(req.title, req.description)
    tokens = AIService.tokenize(f"{req.title} {req.description}")

    corpus_texts = memory_manager._get_user_corpus_texts(current_user.user_id)
    keywords_preview = AIService.extract_keywords(corpus_texts, req.title, req.description)

    return {
        "category": category,
        "confidence": confidence,
        "keywords_preview": keywords_preview,
        "tokens": tokens,
    }
