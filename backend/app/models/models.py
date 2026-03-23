from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Protocol(Base):
    __tablename__ = "protocols"

    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    raw_text = Column(String)
    inclusion_criteria = Column(JSON) # Stored as list of strings
    exclusion_criteria = Column(JSON) # Stored as list of strings
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("EligibilityResult", back_populates="protocol")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)
    conditions = Column(JSON)
    lab_results = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("EligibilityResult", back_populates="patient")

class EligibilityResult(Base):
    __tablename__ = "eligibility_results"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    protocol_id = Column(String, ForeignKey("protocols.id"))
    is_eligible = Column(Boolean)
    explanation = Column(String)
    inclusion_matches = Column(JSON)
    exclusion_conflicts = Column(JSON)
    silent_triggers = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="results")
    protocol = relationship("Protocol", back_populates="results")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
