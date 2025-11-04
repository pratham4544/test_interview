# src/schemas.py - Clean Version (No Audio/Monitoring)
# Removed: TTS, STT, Monitoring, Audio Recording schemas
# Frontend now handles all audio/video functionality

from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# =========================
# CORE INTERVIEW MODELS
# =========================

class CandidateResponse(BaseModel):
    id: str
    name: str

class InterviewSetupRequest(BaseModel):
    candidate_id: str

class InterviewSetupResponse(BaseModel):
    candidate_id: str
    greeting: str
    questions: List[str]
    message: str

class AnswerSubmissionRequest(BaseModel):
    candidate_id: str
    question_index: int
    question: str
    answer: str

class AnswerEvaluationResponse(BaseModel):
    score: int
    feedback: List[str]
    needs_followup: bool
    follow_up_question: Optional[str] = None

class FollowUpRequest(BaseModel):
    candidate_id: str
    original_question: str
    original_answer: str
    follow_up_question: str
    follow_up_answer: str
    follow_up_level: int

class InterviewDataRequest(BaseModel):
    candidate_id: str
    interactions: List[Dict[str, Any]]

class CandidateScoreResponse(BaseModel):
    candidate_id: str
    average_score: float
    total_questions: int
    total_score: float
    interview_details: Optional[Dict[str, Any]] = None

# =========================
# CODING ROUND MODELS
# =========================

class CodingSubmissionRequest(BaseModel):
    candidate_id: str
    code: str

class CodingSubmissionResponse(BaseModel):
    execution_result: str
    submission_id: Optional[str]

# =========================
# PREPROCESSING MODELS
# =========================

class QuestionRequest(BaseModel):
    candidate_id: str
    questions: List[str]

class PreprocessingResponse(BaseModel):
    candidate_id: str
    message: str
    questions_count: int
    success: bool

# =========================
# REPORT GENERATION MODELS
# =========================

class ReportRequest(BaseModel):
    candidate_id: str
    format: str = "html"  # html, pdf

class ReportResponse(BaseModel):
    candidate_id: str
    report_path: str
    format: str
    generated_at: str

# =========================
# SYSTEM HEALTH MODELS
# =========================

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    services: Dict[str, str]

class SystemInfoResponse(BaseModel):
    message: str
    status: str
    features: List[str]
    frontend_features: List[str]

# =========================
# ERROR RESPONSE MODELS
# =========================

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
    timestamp: Optional[str] = None

class ValidationErrorResponse(BaseModel):
    detail: List[Dict[str, Any]]
    error_type: str = "validation_error"

# =========================
# SUCCESS RESPONSE MODELS
# =========================

class SuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class BulkOperationResponse(BaseModel):
    success: bool
    processed_count: int
    failed_count: int
    errors: List[str] = []

# =========================
# CANDIDATE MANAGEMENT MODELS
# =========================

class CandidateCreateRequest(BaseModel):
    personal_information: Dict[str, Any]
    work_experience: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    skills: List[str] = []

class CandidateUpdateRequest(BaseModel):
    personal_information: Optional[Dict[str, Any]] = None
    work_experience: Optional[List[Dict[str, Any]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None

class CandidateListResponse(BaseModel):
    candidates: List[CandidateResponse]
    total_count: int
    page: int = 1
    page_size: int = 50

# =========================
# INTERVIEW SESSION MODELS
# =========================

class InterviewSessionInfo(BaseModel):
    session_id: str
    candidate_id: str
    status: str  # not_started, in_progress, completed, cancelled
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    current_question_index: int = 0
    total_questions: int = 0

class InterviewProgress(BaseModel):
    candidate_id: str
    session_id: str
    current_question: int
    total_questions: int
    answered_questions: int
    average_score: float
    time_elapsed: int  # seconds

# =========================
# QUESTION MANAGEMENT MODELS
# =========================

class QuestionInfo(BaseModel):
    question_id: str
    text: str
    category: str  # behavioral, technical, situational
    difficulty: str  # easy, medium, hard
    expected_duration: int  # seconds

class QuestionSetRequest(BaseModel):
    candidate_id: str
    category_weights: Dict[str, float] = {"behavioral": 0.4, "technical": 0.4, "situational": 0.2}
    difficulty_preference: str = "mixed"  # easy, medium, hard, mixed
    total_questions: int = 5

# =========================
# SCORING AND EVALUATION MODELS
# =========================

class EvaluationCriteria(BaseModel):
    technical_accuracy: float = 0.3
    communication_clarity: float = 0.3
    problem_solving: float = 0.2
    relevance: float = 0.2

class ScoreBreakdown(BaseModel):
    technical_accuracy: float
    communication_clarity: float
    problem_solving: float
    relevance: float
    overall_score: float
    feedback: List[str]

class InterviewAnalytics(BaseModel):
    candidate_id: str
    total_interviews: int
    average_score: float
    score_trend: List[float]
    strengths: List[str]
    improvement_areas: List[str]

# =========================
# EXPORT/IMPORT MODELS
# =========================

class ExportRequest(BaseModel):
    candidate_ids: List[str]
    format: str = "json"  # json, csv, xlsx
    include_scores: bool = True
    include_feedback: bool = True

class ImportRequest(BaseModel):
    data_format: str = "json"
    overwrite_existing: bool = False
    validate_only: bool = False

# =========================
# NOTIFICATION MODELS
# =========================

class NotificationRequest(BaseModel):
    candidate_id: str
    message: str
    notification_type: str = "info"  # info, warning, error, success

class NotificationResponse(BaseModel):
    notification_id: str
    sent_at: str
    status: str  # sent, failed, pending