# main.py - AEITA AI Interviewer Clean Version v4.0
# Removed: MSS monitoring, Speech Recognition, Audio Recording
# Frontend now handles: Audio recording, Screen capture, Speech-to-text

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from datetime import datetime
from pymongo import MongoClient
import os
import time
import tempfile
import io
import base64
import json
from dotenv import load_dotenv
from gtts import gTTS
import logging
from typing import Dict, Any, List, Optional
from bson import ObjectId
import gridfs

# Import helper functions (cleaned)
from src.helper import (
    extract_candidate_info, 
    generate_questions, 
    store_interview_template,
    get_stored_interview_template, 
    evaluate_answer, 
    generate_follow_up_question
)

# Import schemas (cleaned)
from src.schemas import *

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="AEITA AI Interviewer Clean", version="4.0.0")

# CORS middleware - Allow your React app to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://d2t7uo64djqs88.cloudfront.net",  # Your CloudFront URL
        "http://3.110.184.172:8000",  # Your backend IP
        "http://3.110.184.172",
        "https://neo-in-matrix.duckdns.org",
        "*"  # For future custom domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
# MongoDB connection
MONGO_URI = os.environ.get('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client['aieta']
candidates_collection = db['candidates']
interviews_collection = db['interviews']
interaction_collection = db['interaction']

# GridFS for TTS audio files only (no recording storage)
tts_fs = gridfs.GridFS(db, collection="tts_files")

# =========================
# CANDIDATE MANAGEMENT ENDPOINTS
# =========================

@app.get("/candidates")
async def get_candidates():
    """Get all candidates"""
    try:
        candidates = list(candidates_collection.find({}, {"_id": 0}))
        return candidates
    except Exception as e:
        logger.error(f"Error fetching candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/candidate/{candidate_id}")
async def get_candidate(candidate_id: str):
    """Get specific candidate"""
    try:
        candidate = candidates_collection.find_one({"id": candidate_id}, {"_id": 0})
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return candidate
    except Exception as e:
        logger.error(f"Error fetching candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# INTERVIEW SETUP ENDPOINTS
# =========================

@app.post("/interview/setup", response_model=InterviewSetupResponse)
async def setup_interview(request: InterviewSetupRequest):
    """Setup interview for a candidate"""
    try:
        candidate_data = candidates_collection.find_one({"id": request.candidate_id})
        if not candidate_data:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Get stored interview template
        greeting, questions = get_stored_interview_template(request.candidate_id)
        
        if not greeting or not questions:
            # Generate new interview if not found
            logger.info(f"Generating new interview for candidate {request.candidate_id}")
            response, questions, greeting = generate_questions(candidate_data)
            store_interview_template(candidate_data, greeting, questions)
        
        return InterviewSetupResponse(
            candidate_id=request.candidate_id,
            greeting=greeting,
            questions=questions,
            message="Interview setup completed successfully"
        )
    except Exception as e:
        logger.error(f"Interview setup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# INTERVIEW INTERACTION ENDPOINTS
# =========================

@app.post("/answer/submit", response_model=AnswerEvaluationResponse)
async def submit_answer(request: AnswerSubmissionRequest):
    """Submit and evaluate an answer"""
    try:
        evaluation = evaluate_answer(request.question, request.answer)
        
        needs_followup = evaluation["evaluation"]["score"] < 7
        follow_up_question = None
        
        if needs_followup:
            follow_up_question = generate_follow_up_question(request.question, request.answer)
        
        return AnswerEvaluationResponse(
            score=evaluation["evaluation"]["score"],
            feedback=evaluation["evaluation"]["feedback"],
            needs_followup=needs_followup,
            follow_up_question=follow_up_question
        )
    except Exception as e:
        logger.error(f"Answer evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/answer/follow-up")
async def submit_follow_up_answer(request: FollowUpRequest):
    """Submit follow-up answer"""
    try:
        evaluation = evaluate_answer(request.follow_up_question, request.follow_up_answer)
        return {
            "score": evaluation["evaluation"]["score"],
            "feedback": evaluation["evaluation"]["feedback"],
            "follow_up_level": request.follow_up_level
        }
    except Exception as e:
        logger.error(f"Follow-up evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# INTERVIEW DATA STORAGE ENDPOINTS
# =========================

@app.post("/interview/complete-and-save")
async def complete_interview_and_save(request: dict):
    """Complete interview and save all data (no audio/screenshots)"""
    try:
        candidate_id = request.get("candidate_id")
        if not candidate_id:
            raise HTTPException(status_code=400, detail="candidate_id is required")
        
        session_id = request.get("session_id", datetime.now().strftime("%Y%m%d_%H%M%S"))
        interactions = request.get("interactions", [])
        
        if not interactions:
            raise HTTPException(status_code=400, detail="No interactions provided")
        
        # Calculate scores
        total_score = 0
        scored_interactions = 0
        for interaction in interactions:
            if "score" in interaction and interaction["score"] is not None:
                total_score += interaction["score"]
                scored_interactions += 1
        
        average_score = total_score / scored_interactions if scored_interactions > 0 else 0
        
        # Create interview document
        interview_document = {
            "candidate_id": candidate_id,
            "session_id": session_id,
            "interactions": interactions,
            "scores": {
                "total_score": total_score,
                "average_score": round(average_score, 2),
                "scored_interactions": scored_interactions,
                "max_possible_score": scored_interactions * 5
            },
            "metadata": {
                "total_questions": len(interactions),
                "interview_completed_at": datetime.utcnow(),
                "platform": "web",
                "version": "4.0.0"
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Check if interview already exists
        existing_interview = interaction_collection.find_one({"candidate_id": candidate_id})
        
        if existing_interview:
            # Update existing interview
            result = interaction_collection.update_one(
                {"candidate_id": candidate_id},
                {"$set": interview_document}
            )
            operation = "updated"
            document_id = existing_interview["_id"]
        else:
            # Create new interview
            result = interaction_collection.insert_one(interview_document)
            operation = "created"
            document_id = result.inserted_id
        
        logger.info(f"✅ Interview data {operation} for candidate {candidate_id}")
        
        return {
            "success": True,
            "message": f"Interview data {operation} successfully",
            "candidate_id": candidate_id,
            "document_id": str(document_id),
            "operation": operation,
            "total_interactions_saved": len(interactions),
            "average_score": interview_document["scores"]["average_score"],
            "collection": "aieta.interaction"
        }
        
    except Exception as e:
        logger.error(f"Error saving interview data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save interview data: {str(e)}")

@app.get("/candidate/{candidate_id}/score", response_model=CandidateScoreResponse)
async def get_candidate_score(candidate_id: str):
    """Get candidate's interview score"""
    try:
        # Get from interaction collection
        interview_data = interaction_collection.find_one({"candidate_id": candidate_id})
        
        if interview_data:
            scores = interview_data.get("scores", {})
            return CandidateScoreResponse(
                candidate_id=candidate_id,
                average_score=scores.get("average_score", 0),
                total_questions=interview_data.get("metadata", {}).get("total_questions", 0),
                total_score=scores.get("total_score", 0),
                interview_details=interview_data
            )
        
        # Fallback to old collection
        interview_data = interviews_collection.find_one({"candidate_id": candidate_id})
        
        if not interview_data:
            raise HTTPException(status_code=404, detail="No interview data found for candidate")
        
        # Calculate scores from interactions (old method)
        total_score = 0
        total_questions = len(interview_data["interactions"])
        
        for interaction in interview_data["interactions"]:
            total_score += interaction.get("score", 0)
        
        average_score = total_score / total_questions if total_questions > 0 else 0
        
        return CandidateScoreResponse(
            candidate_id=candidate_id,
            average_score=average_score,
            total_questions=total_questions,
            total_score=total_score,
            interview_details=interview_data
        )
    except Exception as e:
        logger.error(f"Error getting candidate score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/interview/{candidate_id}")
async def delete_interview_data(candidate_id: str):
    """Delete interview data for a candidate"""
    try:
        # Delete from interaction collection
        result = interaction_collection.delete_one({"candidate_id": candidate_id})
        
        return {
            "success": True,
            "candidate_id": candidate_id,
            "deleted_count": result.deleted_count,
            "message": "Interview data deleted successfully" if result.deleted_count > 0 else "No interview data found to delete",
            "collection": "aieta.interaction"
        }
        
    except Exception as e:
        logger.error(f"Error deleting interview data for {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete interview data: {str(e)}")

# =========================
# TEXT-TO-SPEECH ENDPOINTS (Pre-generated audio only)
# =========================

@app.post("/tts/speak-base64")
async def fetch_tts_base64(request: dict = Body(...)):
    """Fetch pre-generated TTS audio from MongoDB or generate with gTTS as fallback"""
    try:
        candidate_id = request.get("candidate_id")
        text = request.get("text", "")
        language = request.get("language", "en")
        slow = request.get("slow", False)
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="text is required")
        
        # Try to use pre-generated audio if candidate_id provided
        if candidate_id:
            try:
                preprocessing_collection = db['test_preprocessing']
                
                # Find the document for this candidate
                doc = preprocessing_collection.find_one({"candidate_id": candidate_id})
                
                if doc:
                    audio_id = None
                    
                    # Check if text matches greeting
                    if text == doc.get("greetings_text", ""):
                        audio_id = doc.get("audio_file_greetings")
                    else:
                        # Clean the text for matching
                        import re
                        clean_text = re.sub(r'^Question \d+\.\s*', '', text)
                        
                        # Find matching question
                        for q in doc.get("questions", []):
                            question_text = q.get("text", "")
                            if clean_text == question_text or text == question_text:
                                audio_id = q.get("audio_file_question_number")
                                break
                    
                    # If we found pre-generated audio, use it
                    if audio_id:
                        fs = gridfs.GridFS(db)
                        grid_out = fs.get(audio_id)
                        audio_bytes = grid_out.read()
                        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                        
                        logger.info(f"✅ Using pre-generated audio for candidate {candidate_id}")
                        return {
                            "success": True,
                            "audio_base64": audio_base64,
                            "text": text,
                            "language": language,
                            "format": "mp3",
                            "source": "pre_generated"
                        }
            except Exception as e:
                logger.warning(f"Failed to fetch pre-generated audio: {e}")
        
        # Fallback to gTTS generation
        logger.info(f"Generating TTS with gTTS for text: {text[:50]}...")
        tts = gTTS(text=text, lang=language, slow=slow)
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)
        audio_base64 = base64.b64encode(mp3_buffer.getvalue()).decode("utf-8")
        
        return {
            "success": True,
            "audio_base64": audio_base64,
            "text": text,
            "language": language,
            "format": "mp3",
            "source": "generated"
        }
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")

@app.get("/tts/speak/{candidate_id}/{question_number}")
async def fetch_tts_file(candidate_id: str, question_number: int):
    """Fetch pre-generated TTS audio file"""
    try:
        preprocessing_collection = db['test_preprocessing']
        
        doc = preprocessing_collection.find_one({"candidate_id": candidate_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Candidate not found")

        if question_number == 0:  # Greeting
            audio_id = doc.get("audio_file_greetings")
        else:
            q = next((q for q in doc["questions"] if q["question_number"] == question_number), None)
            if not q:
                raise HTTPException(status_code=404, detail=f"Question {question_number} not found")
            audio_id = q["audio_file_question_number"]

        if not audio_id:
            raise HTTPException(status_code=404, detail="Audio file not found")

        fs = gridfs.GridFS(db)
        grid_out = fs.get(audio_id)

        return StreamingResponse(
            io.BytesIO(grid_out.read()),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f'inline; filename="tts_{candidate_id}_{question_number}.mp3"'}
        )

    except Exception as e:
        logger.error(f"TTS fetch file error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS fetch file failed: {str(e)}")

# =========================
# CODING ROUND ENDPOINTS (if needed)
# =========================

@app.post("/coding/submit", response_model=CodingSubmissionResponse)
async def submit_code(request: CodingSubmissionRequest):
    """Submit coding solution"""
    try:
        # Your existing coding submission logic
        from src.helper import code_executor
        
        execution_result = code_executor(request.code)
        
        coding_db = client['ai_interviewer']
        coding_collection = coding_db['coding_submissions']
        
        submission_doc = {
            "candidate_id": request.candidate_id,
            "code": request.code,
            "execution_result": execution_result,
            "submitted_at": datetime.utcnow()
        }
        
        result = coding_collection.insert_one(submission_doc)
        
        return CodingSubmissionResponse(
            execution_result=execution_result,
            submission_id=str(result.inserted_id)
        )
    except Exception as e:
        logger.error(f"Code submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# PREPROCESSING ENDPOINTS
# =========================

@app.post("/store-questions")
async def store_questions(payload: dict):
    """Store interview questions"""
    try:
        candidate_id = payload.get("candidate_id")
        questions = payload.get("questions", [])
        
        if not candidate_id or not questions:
            raise HTTPException(status_code=400, detail="candidate_id and questions are required")

        from src.helper import store_questions_in_mongo
        inserted_ids = store_questions_in_mongo(candidate_id, questions)
        
        return {
            "candidate_id": candidate_id,
            "inserted_ids": [str(x) for x in inserted_ids] if inserted_ids else [],
            "message": f"{len(questions)} questions stored successfully ✅",
        }
    except Exception as e:
        logger.error(f"Store questions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# REPORT GENERATION ENDPOINTS
# =========================

@app.get("/report/{candidate_id}")
def get_candidate_report(candidate_id: str):
    """Generate candidate report"""
    try:
        from src.helper import build_candidate_report
        filepath = build_candidate_report(candidate_id)
        if not filepath:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return FileResponse(filepath, media_type="text/html", filename=os.path.basename(filepath))
    except Exception as e:
        logger.error(f"Report generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# HEALTH CHECK ENDPOINTS
# =========================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "4.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": "connected",
            "tts": "available"
        }
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AEITA AI Interviewer Clean v4.0.0",
        "status": "running",
        "features": [
            "Interview Management",
            "Answer Evaluation", 
            "Text-to-Speech",
            "Report Generation"
        ],
        "frontend_features": [
            "Audio Recording",
            "Speech Recognition", 
            "Screen Monitoring"
        ]
    }

# =========================
# ERROR HANDLERS
# =========================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred"}
    )

# =========================
# STARTUP/SHUTDOWN EVENTS
# =========================

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 AEITA AI Interviewer Clean v4.0.0 started")
    logger.info("✅ Frontend handles: Audio recording, Speech recognition, Screen monitoring")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 AEITA AI Interviewer Clean v4.0.0 shutdown")

# =========================
# MAIN APPLICATION ENTRY POINT
# =========================

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*80)
    print("🎯 AEITA AI INTERVIEWER CLEAN v4.0.0")
    print("="*80)
    print(f"🌐 FastAPI Server: http://localhost:8000")
    print(f"📊 API Documentation: http://localhost:8000/docs")
    print(f"🎙️ Audio Recording: Frontend (Web Audio API)")
    print(f"🗣️ Speech Recognition: Frontend (Web Speech API)")
    print(f"📸 Screen Monitoring: Frontend (Screen Capture API)")
    print(f"💻 Platform: Clean Backend")
    print("="*80 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
