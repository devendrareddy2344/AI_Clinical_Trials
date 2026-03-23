from fastapi import APIRouter
from app.api.endpoints import auth, protocols, patients, eligibility

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["authentication"])
router.include_router(protocols.router, prefix="/protocols", tags=["protocols"])
router.include_router(patients.router, prefix="/patients", tags=["patients"])
router.include_router(eligibility.router, prefix="/eligibility", tags=["eligibility"])
