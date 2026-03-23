from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Patient
from app.services.patient_parser import parse_patient_pdf
import shutil
import os
from pydantic import BaseModel
from typing import Dict, Any, List
import uuid

router = APIRouter()

@router.get("/")
async def list_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).all()
    return patients

@router.post("/upload")
async def upload_patient_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only PDF and Excel files are allowed")
    
    temp_path = f"temp_patient_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        if file.filename.endswith(".pdf"):
            data = parse_patient_pdf(temp_path)
        else:
            data = parse_patient_excel(temp_path)
            
        data["id"] = str(uuid.uuid4())[:8]
        
        new_patient = Patient(
            id=data["id"],
            name=data["name"],
            age=data["age"],
            gender=data["gender"],
            conditions=data["conditions"],
            lab_results=data["lab_results"]
        )
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
        
        return data
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/normalize")
async def normalize_patient(profile: Dict[str, Any], db: Session = Depends(get_db)):
    # In a real scenario, this would normalize the data using some logic or AI
    patient_id = profile.get("id") or str(uuid.uuid4())[:8]
    
    new_patient = Patient(
        id=patient_id,
        name=profile.get("name", "Unknown"),
        age=profile.get("age", 0),
        gender=profile.get("gender", "Unknown"),
        conditions=profile.get("conditions", []),
        lab_results=profile.get("lab_results", {})
    )
    
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    
    return {
        "id": new_patient.id,
        "name": new_patient.name,
        "age": new_patient.age,
        "gender": new_patient.gender,
        "conditions": new_patient.conditions,
        "lab_results": new_patient.lab_results
    }
