from app.core.database import SessionLocal, engine, Base
from app.models.models import Protocol, Patient
import uuid

def init_db():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if we already have data
    if db.query(Protocol).first():
        print("Database already initialized")
        return

    # 1. Add Sample Protocol
    sample_protocol = Protocol(
        id="TRIAL-001",
        title="Type 2 Diabetes Study",
        raw_text="Sample Trial Protocol...",
        inclusion_criteria=["Age 18-70 years", "Diagnosis of Type 2 Diabetes"],
        exclusion_criteria=["Severe renal impairment (eGFR < 30)", "History of heart failure"]
    )
    
    # 2. Add Sample Patient (Matches criteria but has silent eGFR trigger)
    sample_patient = Patient(
        id="P-8821",
        name="John Doe",
        age=69,
        gender="Male",
        conditions=["Mild Hypertension", "Type 2 Diabetes"],
        lab_results={"eGFR": 28, "creatinine": 1.8}
    )

    db.add(sample_protocol)
    db.add(sample_patient)
    db.commit()
    print("Sample data seeded successfully!")
    db.close()

if __name__ == "__main__":
    init_db()
