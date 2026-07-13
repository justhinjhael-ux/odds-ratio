"""FastAPI — Odds Ratio. Solo capa API: toda la lógica vive en el grafo
LangGraph y los módulos versionados (rules/bayes/workflows)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base
from app.routers import chat, clients, forecast, profiling, proposals, review

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Odds Ratio API",
    description="Robo-Advisory agéntico — Track 3, Agentic Scale 2026.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiling.router)
app.include_router(proposals.router)
app.include_router(forecast.router)
app.include_router(review.router)   # protegido: solo operadores
app.include_router(chat.router)     # chat público + logs protegidos
app.include_router(clients.router)  # login + ranking protegido


@app.get("/")
def root():
    return {"servicio": "Odds Ratio API", "estado": "ok"}
