# src/helper.py - Clean Version (No Audio/Speech Recognition)
# Removed: record_audio_continuous, speech recognition, audio storage
# Core interview logic preserved

import os
from dotenv import load_dotenv
#import streamlit as st
from pymongo import MongoClient
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from groq import Groq
from pymongo import MongoClient
from langchain_core.output_parsers import JsonOutputParser
import time
import random
# from euriai import EuriaiLLM
from src.prompt import *
import gridfs
from datetime import datetime
from bson import ObjectId

load_dotenv()

# Read API keys from .env
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
api_key = os.getenv('EURON_API_KEY')

# Initialize LLM models
# llm = EuriaiLLM(api_key=api_key, model="gpt-4.1-nano")
llm = ChatGroq(model= 'llama-3.1-8b-instant',api_key=GROQ_API_KEY)

# MongoDB connection
client = MongoClient(MONGO_URI)
db = client["aieta"]
fs = gridfs.GridFS(db)
postprocessing_collection = db["interviews_results"]
preprocessing_collection = db['test_preprocessing']

# =========================
# 1. CANDIDATE INFORMATION EXTRACTION
# =========================

def extract_candidate_info(candidate_data):
    """Extract and format candidate information for question generation"""
    try:
        personal_info = candidate_data.get('personal_information', {})
        work_experience = candidate_data.get('work_experience', [])
        education = candidate_data.get('education', [])
        
        formatted_info = {
            'name': personal_info.get('name', 'Unknown'),
            'email': personal_info.get('email', 'Unknown'),
            'experience_years': len(work_experience),
            'latest_role': work_experience[0].get('title', 'Unknown') if work_experience else 'No experience',
            'education_level': education[0].get('degree', 'Unknown') if education else 'Unknown',
            'skills': candidate_data.get('skills', [])
        }
        
        return formatted_info
    except Exception as e:
        print(f"Error extracting candidate info: {e}")
        return None

# =========================
# 2. QUESTION GENERATION
# =========================

def generate_questions(candidate_data):
    """Generate interview questions and greeting for a candidate"""
    try:
        prompt_template = genearte_questions_prompt
        prompt_obj = PromptTemplate(template=prompt_template, input_variables=['candidate_data'])
        response = (prompt_obj | llm | JsonOutputParser()).invoke({'candidate_data': candidate_data})
        
        interview_data = response.get('interview', {})
        greeting_script = interview_data.get('greeting_script', '')
        questions = interview_data.get('questions', [])
        
        return response, questions, greeting_script
    except Exception as e:
        print(f"Error generating questions: {e}")
        return None, [], ""

def store_interview_template(candidate_data, greeting, questions):
    """Store interview template in MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['aieta']
        template_collection = db['interview_templates']
        
        template_doc = {
            "candidate_id": candidate_data['id'],
            'candidate_email': candidate_data['personal_information']['email'],
            "greeting_script": greeting,
            "questions": questions,
            "created_at": datetime.utcnow()
        }
        
        result = template_collection.insert_one(template_doc)
        print("✅ Stored interview template with ID:", result.inserted_id)
        return result.inserted_id
    except Exception as e:
        print(f"Error storing interview template: {e}")
        return None

# =========================
# 3. INTERVIEW TEMPLATE RETRIEVAL
# =========================

def get_stored_interview_template(candidate_id):
    """Get interview template from test_preprocessing collection"""
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['aieta']
        preprocessing_collection = db['test_preprocessing']
        
        doc = preprocessing_collection.find_one({"candidate_id": str(candidate_id)})
        if doc:
            greeting = doc.get("greetings_text", "")
            questions = [q.get("text", "") for q in doc.get("questions", [])]
            return greeting, questions
        else:
            # Fallback to interview_templates collection
            template_collection = db['interview_templates']
            template_doc = template_collection.find_one({"candidate_id": str(candidate_id)})
            if template_doc:
                greeting = template_doc.get("greeting_script", "")
                questions = template_doc.get("questions", [])
                return greeting, questions
            return None, None
    except Exception as e:
        print(f"Error getting stored interview template: {e}")
        return None, None

# =========================
# 4. ANSWER EVALUATION
# =========================

def evaluate_answer(question, answer, prompt=evaluation_prompt):
    """Evaluate a candidate's answer and provide score and feedback"""
    try:
        prompt_template = prompt
        prompt_obj = PromptTemplate(template=prompt_template, input_variables=['question', 'answer'])
        response = (prompt_obj | llm | JsonOutputParser()).invoke({'question': question, 'answer': answer})
        return response
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return {"evaluation": {"score": 0, "feedback": ["Error in evaluation"]}}

def generate_follow_up_question(question, answer, prompt=followup_questions_prompt):
    """Generate follow-up question based on original question and answer"""
    try:
        prompt_template = prompt
        prompt_obj = PromptTemplate(template=prompt_template, input_variables=['question', 'answer'])
        response = (prompt_obj | llm).invoke({'question': question, 'answer': answer})
        
        # Handle different response types
        if hasattr(response, 'content'):
            return str(response.content)  # LangChain AIMessage
        elif isinstance(response, str):
            return response  # Already a string
        else:
            return str(response)  # Convert to string
            
    except Exception as e:
        print(f"Error generating follow-up question: {e}")
        return "Can you provide more details about your experience with this?"

# =========================
# 5. SCORE CALCULATION
# =========================

def get_candidate_average_score(candidate_id):
    """Calculate candidate's average score from interview data"""
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['aieta']
        collection = db['interviews']
        
        interview = collection.find_one({'candidate_id': candidate_id})
        if not interview:
            return None
        
        scores = [
            interaction['score'] 
            for interaction in interview.get('interactions', []) 
            if 'score' in interaction
        ]
        
        if scores:
            total_scores = sum(scores)
            length_scores = len(scores)
            avg_score = total_scores / length_scores
            return avg_score, length_scores * 10, total_scores
        else:
            return None
    except Exception as e:
        print(f"Error calculating average score: {e}")
        return None

# =========================
# 6. PREPROCESSING FUNCTIONS
# =========================

def store_questions_in_mongo(candidate_id: str, questions: list):
    """Store questions in MongoDB preprocessing collection"""
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['aieta']
        preprocessing_collection = db['test_preprocessing']
        
        # Check if document already exists
        existing_doc = preprocessing_collection.find_one({"candidate_id": candidate_id})
        
        if existing_doc:
            # Update existing document
            result = preprocessing_collection.update_one(
                {"candidate_id": candidate_id},
                {"$set": {"questions": questions, "updated_at": datetime.utcnow()}}
            )
            print(f"✅ Updated questions for candidate {candidate_id}")
            return [existing_doc["_id"]]
        else:
            # Create new document
            doc = {
                "candidate_id": candidate_id,
                "questions": questions,
                "created_at": datetime.utcnow()
            }
            result = preprocessing_collection.insert_one(doc)
            print(f"✅ Created questions for candidate {candidate_id}")
            return [result.inserted_id]
    except Exception as e:
        print(f"Error storing questions: {e}")
        return []

# =========================
# 7. REPORT GENERATION
# =========================

def extract_info_for_generating_report(candidate_id):
    """Extract interview data for report generation"""
    try:
        report_data = postprocessing_collection.find_one({"candidate_id": candidate_id})
        
        if not report_data:
            print(f"No report data found for candidate {candidate_id}")
            return None
        
        def format_date(iso_string):
            """Format ISO date string into readable format"""
            if isinstance(iso_string, dict) and '$date' in iso_string:
                date_str = iso_string['$date']
            elif isinstance(iso_string, str):
                date_str = iso_string
            else:
                return ""

            try:
                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                return date_obj.strftime('%B %d, %Y, %I:%M %p')
            except ValueError:
                return ""
        
        # Extract key information
        candidate_id = report_data.get('candidate_id', 'N/A')
        position = report_data.get('metadata', {}).get('position', 'N/A')
        interview_date = format_date(report_data.get('interview_completed_at', {}))
        interviewer_name = report_data.get('metadata', {}).get('interviewer_name', 'N/A')

        # Overall Performance
        scores = report_data.get('scores', {})
        average_score = scores.get('average_score', 0)
        max_possible_score = scores.get('max_possible_score', 0)
        total_score = scores.get('total_score', 0)
        scored_interactions = scores.get('scored_interactions', 1)

        percentage_score = (average_score / 5) * 100 if 5 > 0 else 0

        # Format data for report
        formatted_data = {
            'candidate_id': candidate_id,
            'position': position,
            'interview_date': interview_date,
            'interviewer_name': interviewer_name,
            'scores': scores,
            'average_score': average_score,
            'max_possible_score': max_possible_score,
            'total_score': total_score,
            'scored_interactions': scored_interactions,
            'percentage_score': percentage_score,
            'interactions': report_data.get('interactions', []),
            'current_generation_date': datetime.now().strftime('%B %d, %Y, %I:%M %p')
        }
        
        return formatted_data
    except Exception as e:
        print(f"Error extracting report info: {e}")
        return None

def generate_html_report(report_raw_dict):
    """Generate HTML report from report data"""
    try:
        # Import report template
        from src.postprocessing import report_template
        
        # Build category averages HTML
        category_averages_html = ""
        category_averages = report_raw_dict.get("scores", {}).get('category_averages', {})
        for category, avg_score in category_averages.items():
            if avg_score > 0:
                category_name = category.replace('_', ' ').title()
                category_averages_html += f"""
                    <div class="card">
                        <p class="font-medium text-gray-500 text-sm">{category_name} Score:</p>
                        <p class="text-2xl font-bold text-indigo-600">{avg_score:.1f} / 5</p>
                    </div>
                """

        # Build interactions HTML
        interactions_html = ""
        for interaction in report_raw_dict.get('interactions', []):
            question = interaction.get('question', 'N/A')
            answer = interaction.get('answer', 'No answer provided.')
            score = interaction.get('score', 0)
            feedback_items = interaction.get('feedback', [])

            feedback_html = ""
            for fb in feedback_items:
                feedback_html += f"""
                    <div class="feedback-item">
                        <span class="feedback-icon text-blue-600">▪</span> {fb}
                    </div>
                """

            interactions_html += f"""
                <div class="interaction-card">
                    <p class="qa-question">{question}</p>
                    <p class="qa-answer">{answer}</p>
                    <div class="score-section">
                        <span class="score-badge">Score: {score}/5</span>
                    </div>
                    <div class="feedback-section">
                        <h5>Feedback:</h5>
                        {feedback_html}
                    </div>
                </div>
            """

        # Build improvement areas HTML
        improvement_areas_html = ""
        for imp in report_raw_dict.get("improvement_areas", []):
            txt = imp.get("question", "")
            score = imp.get("score", 0)
            improvement_areas_html += f"<li>{txt} (Score: {score})</li>"

        # Fill template
        html_report = report_template.format(
            candidate_id=report_raw_dict["candidate_id"],
            position=report_raw_dict["position"],
            interview_date=report_raw_dict["interview_date"],
            interviewer_name=report_raw_dict["interviewer_name"],
            scores=report_raw_dict["scores"],
            average_score=report_raw_dict["average_score"],
            max_possible_score=report_raw_dict["max_possible_score"],
            total_score=report_raw_dict["total_score"],
            scored_interactions=report_raw_dict["scored_interactions"],
            percentage_score=report_raw_dict["percentage_score"],
            category_averages_html=category_averages_html,
            interactions_html=interactions_html,
            improvement_areas_html=improvement_areas_html,
            current_generation_date=report_raw_dict["current_generation_date"]
        )
        return html_report
    except Exception as e:
        print(f"Error generating HTML report: {e}")
        return None

def build_candidate_report(candidate_id):
    """Build complete candidate report"""
    try:
        # Extract report data
        report_data = extract_info_for_generating_report(candidate_id)
        if not report_data:
            return None
        
        # Generate HTML report
        html_report = generate_html_report(report_data)
        if not html_report:
            return None
        
        # Save report to file
        reports_dir = "reports"
        os.makedirs(reports_dir, exist_ok=True)
        
        report_filename = f"interview_report_{candidate_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        report_filepath = os.path.join(reports_dir, report_filename)
        
        with open(report_filepath, 'w', encoding='utf-8') as f:
            f.write(html_report)
        
        print(f"✅ Report generated: {report_filepath}")
        return report_filepath
    except Exception as e:
        print(f"Error building candidate report: {e}")
        return None

# =========================
# 8. CODE EXECUTION (if needed)
# =========================

def code_executor(code):
    """Execute code and return result (basic implementation)"""
    try:
        # Basic code execution - add security measures in production
        import io
        import sys
        from contextlib import redirect_stdout
        
        output = io.StringIO()
        with redirect_stdout(output):
            exec(code)
        
        result = output.getvalue()
        return result if result else "Code executed successfully (no output)"
    except Exception as e:
        return f"Error executing code: {str(e)}"

# =========================
# 9. UTILITY FUNCTIONS
# =========================

def validate_candidate_id(candidate_id):
    """Validate candidate ID format"""
    if not candidate_id or len(candidate_id) < 3:
        return False
    return True

def format_score_percentage(score, max_score=5):
    """Format score as percentage"""
    try:
        percentage = (score / max_score) * 100
        return round(percentage, 1)
    except:
        return 0.0

def get_interview_statistics():
    """Get overall interview statistics"""
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['aieta']
        interaction_collection = db['interaction']
        
        total_interviews = interaction_collection.count_documents({})
        
        # Calculate average score across all interviews
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$scores.average_score"},
                "total_questions": {"$sum": "$metadata.total_questions"}
            }}
        ]
        
        stats = list(interaction_collection.aggregate(pipeline))
        
        return {
            "total_interviews": total_interviews,
            "average_score": stats[0]["avg_score"] if stats else 0,
            "total_questions_asked": stats[0]["total_questions"] if stats else 0
        }
    except Exception as e:
        print(f"Error getting interview statistics: {e}")
        return {"total_interviews": 0, "average_score": 0, "total_questions_asked": 0}

def cleanup_old_reports(days_old=30):
    """Clean up report files older than specified days"""
    try:
        reports_dir = "reports"
        if not os.path.exists(reports_dir):
            return 0
        
        import time
        current_time = time.time()
        cutoff_time = current_time - (days_old * 24 * 60 * 60)
        
        deleted_count = 0
        for filename in os.listdir(reports_dir):
            filepath = os.path.join(reports_dir, filename)
            if os.path.isfile(filepath):
                file_time = os.path.getctime(filepath)
                if file_time < cutoff_time:
                    os.remove(filepath)
                    deleted_count += 1
        
        print(f"✅ Cleaned up {deleted_count} old report files")
        return deleted_count
    except Exception as e:
        print(f"Error cleaning up reports: {e}")
        return 0
