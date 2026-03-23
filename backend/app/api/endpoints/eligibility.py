from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import EligibilityResult, Patient, Protocol
from pydantic import BaseModel
from typing import Dict, Any, List
from app.services.eligibility_engine import evaluate_eligibility
import pandas as pd
import io

router = APIRouter()

class EligibilityRequest(BaseModel):
    patient_id: str
    protocol_id: str
    patient_profile: Dict[str, Any]
    protocol_data: Dict[str, Any]

@router.get("/export")
async def export_results(db: Session = Depends(get_db)):
    results = db.query(EligibilityResult).all()
    
    data = []
    for r in results:
        data.append({
            "Result ID": r.id,
            "Patient ID": r.patient_id,
            "Protocol ID": r.protocol_id,
            "Eligible": "Yes" if r.is_eligible else "No",
            "Reason": r.explanation,
            "Matches": len(r.inclusion_matches or []),
            "Conflicts": len(r.exclusion_conflicts or []),
            "Silent Triggers": len(r.silent_triggers or []),
            "Timestamp": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Eligibility Results')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=eligibility_results.xlsx"}
    )

@router.post("/evaluate")
async def evaluate(request: EligibilityRequest, db: Session = Depends(get_db)):
    try:
        results = evaluate_eligibility(request.patient_profile, request.protocol_data)
        
        # Save analysis to DB
        db_result = EligibilityResult(
            patient_id=request.patient_id,
            protocol_id=request.protocol_id,
            is_eligible=results["is_eligible"],
            explanation=results["explanation"],
            inclusion_matches=results["inclusion_matches"],
            exclusion_conflicts=results["exclusion_conflicts"],
            silent_triggers=results["silent_triggers"]
        )
        db.add(db_result)
        db.commit()
        
        return results
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
