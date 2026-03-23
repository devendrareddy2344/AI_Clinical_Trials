from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Protocol
from app.services.protocol_parser import parse_protocol
import shutil
import os
import uuid

router = APIRouter()

@router.get("/")
async def list_protocols(db: Session = Depends(get_db)):
    protocols = db.query(Protocol).all()
    return protocols

@router.post("/upload")
async def upload_protocol(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Save file temporarily
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Parse protocol
        protocol_data = parse_protocol(temp_path)
        
        # Save to DB
        protocol_id = str(uuid.uuid4())[:8]
        new_protocol = Protocol(
            id=protocol_id,
            title=file.filename,
            raw_text=protocol_data["raw_text"],
            inclusion_criteria=protocol_data["sections"]["inclusion"],
            exclusion_criteria=protocol_data["sections"]["exclusion"]
        )
        db.add(new_protocol)
        db.commit()
        db.refresh(new_protocol)
        
        return {
            "id": new_protocol.id,
            "sections": {
                "inclusion": new_protocol.inclusion_criteria,
                "exclusion": new_protocol.exclusion_criteria
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
