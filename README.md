# AI Clinical Trial Eligibility & Exclusion Contradiction Engine

## Overview
This system automates the evaluation of patient eligibility for clinical trials. It parses complex trial protocols (PDF), compares them against patient profiles, and identifies both explicit and "silent" exclusion triggers using BERT-based clinical text understanding and RAG patterns.

## Tech Stack
- **Frontend**: React.js, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Python, FastAPI
- **NLP/ML**: BERT (Clinical), Sentence Transformers, FAISS Vector Search
- **Memory/DB**: Mem0 (AI Memory Layer), Redis, PostgreSQL
- **Auth**: JWT-based authentication

## System Flow
1. **Raw Ingestion**: The FastAPI backend receives a Clinical Trial Protocol PDF and saves it to the SQLite/PostgreSQL database.
2. **Medical Parsing**: `pypdf` extracts text, and a BERT-based matcher identifies the Inclusion/Exclusion sections.
3. **Patient Persistence**: Patient profiles are normalized and stored in the database.
4. **Semantic Analysis**: Patient conditions are mapped to MPNet vector embeddings and compared against exclusion criteria.
5. **Trigger Detection & Recording**: Lab results (like eGFR) are parsed for contradictions, and all results are logged in the `eligibility_results` table.

## Setup Instructions

### Docker Setup (Recommended)
The easiest way to run the entire application locally is using Docker Compose. Which sets up both the backend and frontend simultaneously.
1. Ensure [Docker](https://www.docker.com/) is installed on your machine.
2. From the root directory, simply run:
   ```bash
   docker-compose up --build
   ```
3. The Vite frontend will be available at `http://localhost:5173`
4. The FastAPI backend will be available at `http://localhost:8000`

### Backend
1. Navigate to `/backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Initialize Database: `python init_db.py` (Creates `clinical_trial.db` and seeds sample data)
4. Start the server: `python -m uvicorn app.main:app --reload`

### Backend (Render)
1. Link your GitHub repo to Render.
2. Create a "Web Service".
3. Build Command: `pip install -r backend/requirements.txt`
4. Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)
1. Link your GitHub repo to Vercel.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Environment Variable: `VITE_API_URL` pointing to your Render URL.

## Contact
Assignment completed for AI Clinical Trial Eligibility & Exclusion Contradiction Engine.
Deadline: 12th Feb 2026 (Submitted Feb 2026)
