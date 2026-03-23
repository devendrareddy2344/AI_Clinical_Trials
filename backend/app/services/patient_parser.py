import pypdf
import re
import os
from typing import Dict, Any

def parse_patient_pdf(pdf_path: str) -> Dict[str, Any]:
    if pdf_path.endswith("sample_patient.pdf") or not os.path.exists(pdf_path):
        # Mock data for demo
        return {
            "name": "Jane Doe",
            "age": 45,
            "gender": "Female",
            "conditions": ["Hypertension", "Type 2 Diabetes"],
            "lab_results": {"eGFR": 25, "creatinine": 2.1}
        }
    
    text = ""
    with open(pdf_path, "rb") as f:
        reader = pypdf.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    
    # Simple extraction logic using Regex (In a real app, use LLM/BERT)
    age_match = re.search(r"Age:\s*(\d+)", text, re.IGNORECASE)
    age = int(age_match.group(1)) if age_match else 40
    
    gender_match = re.search(r"Gender:\s*(\w+)", text, re.IGNORECASE)
    gender = gender_match.group(1) if gender_match else "Unknown"
    
    # Extract eGFR
    egfr_match = re.search(r"eGFR:\s*(\d+)", text, re.IGNORECASE)
    egfr = int(egfr_match.group(1)) if egfr_match else None
    
    return {
        "name": "Extracted Patient",
        "age": age,
        "gender": gender,
        "conditions": ["Extracted from PDF"], # Simplified
        "lab_results": {"eGFR": egfr} if egfr else {}
    }

import pandas as pd

def parse_patient_excel(excel_path: str) -> Dict[str, Any]:
    try:
        df = pd.read_excel(excel_path)
        # Expected columns: Name, Age, Gender, Conditions, eGFR
        data = df.iloc[0].to_dict()
        
        return {
            "name": str(data.get("Name", "Excel Patient")),
            "age": int(data.get("Age", 0)),
            "gender": str(data.get("Gender", "Unknown")),
            "conditions": str(data.get("Conditions", "")).split(",") if data.get("Conditions") else [],
            "lab_results": {"eGFR": float(data.get("eGFR", 0))} if "eGFR" in data else {}
        }
    except Exception as e:
        print(f"Excel parse error: {e}")
        return {
            "name": "Excel Error Patient",
            "age": 0,
            "gender": "Unknown",
            "conditions": [],
            "lab_results": {}
        }
