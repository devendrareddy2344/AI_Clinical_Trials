from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Clinical Trial Eligibility Engine"
    API_V1_STR: str = "/api"
    
    MODEL_NAME: str = os.getenv("MODEL_NAME", "all-mpnet-base-v2")
    HUGGINGFACE_TOKEN: str = os.getenv("HUGGINGFACE_TOKEN", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret")
    
    class Config:
        case_sensitive = True

settings = Settings()
