"""
General Chat Sessions API
Handles CRUD operations for general chat conversations and messages.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from app.db.models import GeneralChatSession, GeneralChatMessage
from app.db.database import get_db
from app.utils.auth import get_current_user
from app.services.chat_service import process_general_chat
from app.middleware.error_handler import get_request_id, ValidationException
from app.utils.logger import log_info, log_error

router = APIRouter()


# Pydantic schemas
class MessageCreate(BaseModel):
    content: str
    language: str = "Auto-detect"
    model: str = "Mistral"


class MessageResponse(BaseModel):
    id: int
    content: str
    is_user_message: bool
    created_at: datetime
    documents_used: Optional[int] = None

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = None

    class Config:
        from_attributes = True


class SessionWithMessages(SessionResponse):
    messages: List[MessageResponse] = []


# ============================================================================
# SESSION ENDPOINTS
# ============================================================================

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chat sessions for the current user, ordered by most recent"""
    sessions = db.query(GeneralChatSession).filter(
        GeneralChatSession.user_id == user_id
    ).order_by(desc(GeneralChatSession.updated_at)).all()
    
    # Add message count to each session
    result = []
    for session in sessions:
        session_dict = {
            "id": session.id,
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "message_count": len(session.messages)
        }
        result.append(session_dict)
    
    return result


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    title: str = Body(default="New Chat", embed=True),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat session"""
    session = GeneralChatSession(
        user_id=user_id,
        title=title
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    log_info(
        f"Created new general chat session",
        context="general_chat",
        user_id=user_id,
        session_id=session.id
    )
    
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "message_count": 0
    }


@router.get("/sessions/{session_id}", response_model=SessionWithMessages)
async def get_session(
    session_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific session with all its messages"""
    session = db.query(GeneralChatSession).filter(
        GeneralChatSession.id == session_id,
        GeneralChatSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "message_count": len(session.messages),
        "messages": [
            {
                "id": msg.id,
                "content": msg.content,
                "is_user_message": msg.is_user_message,
                "created_at": msg.created_at,
                "documents_used": msg.documents_used
            }
            for msg in session.messages
        ]
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session and all its messages"""
    session = db.query(GeneralChatSession).filter(
        GeneralChatSession.id == session_id,
        GeneralChatSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    
    log_info(
        f"Deleted general chat session",
        context="general_chat",
        user_id=user_id,
        session_id=session_id
    )
    
    return {"status": "deleted", "session_id": session_id}


@router.patch("/sessions/{session_id}")
async def update_session_title(
    session_id: int,
    title: str = Body(..., embed=True),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update session title"""
    session = db.query(GeneralChatSession).filter(
        GeneralChatSession.id == session_id,
        GeneralChatSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = title
    db.commit()
    
    return {"status": "updated", "title": title}


# ============================================================================
# MESSAGE ENDPOINTS
# ============================================================================

@router.post("/sessions/{session_id}/messages")
async def send_message(
    request: Request,
    session_id: int,
    message: MessageCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message in a session and get AI response"""
    request_id = get_request_id(request)
    
    # Verify session belongs to user
    session = db.query(GeneralChatSession).filter(
        GeneralChatSession.id == session_id,
        GeneralChatSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Save user message
    user_message = GeneralChatMessage(
        session_id=session_id,
        content=message.content,
        is_user_message=True
    )
    db.add(user_message)
    
    # Update session title if it's the first message
    if session.title == "New Chat" and len(session.messages) == 0:
        # Use first 50 chars of message as title
        session.title = message.content[:50] + ("..." if len(message.content) > 50 else "")
    
    db.commit()
    db.refresh(user_message)
    
    try:
        # Get AI response using existing general chat logic
        response = await process_general_chat(
            question=message.content,
            excluded_file_ids=[],
            user_id=user_id,
            db=db,
            language=message.language,
            request_id=request_id
        )
        
        # Save AI response
        ai_message = GeneralChatMessage(
            session_id=session_id,
            content=response.get("message", ""),
            is_user_message=False,
            documents_used=len(response.get("documents_used", []))
        )
        db.add(ai_message)
        
        # Update session timestamp
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ai_message)
        
        return {
            "user_message": {
                "id": user_message.id,
                "content": user_message.content,
                "is_user_message": True,
                "created_at": user_message.created_at
            },
            "ai_response": {
                "id": ai_message.id,
                "content": ai_message.content,
                "is_user_message": False,
                "created_at": ai_message.created_at,
                "documents_used": ai_message.documents_used
            }
        }
        
    except Exception as e:
        log_error(e, context="general_chat_message", session_id=session_id)
        # Still save an error message
        error_message = GeneralChatMessage(
            session_id=session_id,
            content=f"Error: {str(e)}",
            is_user_message=False
        )
        db.add(error_message)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
