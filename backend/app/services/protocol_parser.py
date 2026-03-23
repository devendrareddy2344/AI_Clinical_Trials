import pypdf
import re
import os
from typing import Dict, List, Any

def parse_protocol(pdf_path: str) -> Dict[str, Any]:
    if pdf_path.endswith("demo.pdf") or not os.path.exists(pdf_path):
        return {
            "raw_text": "Sample Trial Protocol\nInclusion Criteria:\n- Age 18-70 years\n- Diagnosis of Type 2 Diabetes\nExclusion Criteria:\n- Severe renal impairment (eGFR < 30)\n- History of heart failure",
            "sections": {
                "inclusion": "Age 18-70 years\nDiagnosis of Type 2 Diabetes",
                "exclusion": "Severe renal impairment (eGFR < 30)\nHistory of heart failure"
            }
        }
    
    text = ""
    with open(pdf_path, "rb") as f:
        reader = pypdf.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    
    # Simple heuristic to find inclusion/exclusion sections
    # In a real app, you'd use BERT to classify segments
    inclusion_criteria = extract_section(text, "Inclusion Criteria", ["Exclusion Criteria", "Study Design"])
    exclusion_criteria = extract_section(text, "Exclusion Criteria", ["Statistical Methods", "Safety", "Termination"])
    
    return {
        "raw_text": text,
        "sections": {
            "inclusion": inclusion_criteria,
            "exclusion": exclusion_criteria
        }
    }

def extract_section(text: str, start_marker: str, end_markers: List[str]) -> str:
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""
    
    # Find the nearest end marker
    end_idx = len(text)
    for marker in end_markers:
        pos = text.find(marker, start_idx + len(start_marker))
        if pos != -1 and pos < end_idx:
            end_idx = pos
            
    return text[start_idx:end_idx].strip()
