"""Router /review — Panel Operativo: las 3 Historias, decisión y auditoría.

Historia 1 (perfil transparente) + Historia 2 (propuesta explicable) +
Historia 3 (revisión del asesor) se consolidan aquí para que el asesor vea,
en un solo lugar, todo lo que necesita para tomar la decisión final.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.analytics import quality_report
from app.auth import require_operator
from app.database import get_db
from app.models import AdvisorDecision, Proposal, RiskProfileRecord
from app.schemas import DecisionIn
from app.workflows.asesoria_workflow import resume_advisory

router = APIRouter(prefix="/review", tags=["review"], dependencies=[Depends(require_operator)])


@router.get("/pending")
def pending(db: Session = Depends(get_db)):
    props = db.query(Proposal).filter_by(estado="pendiente").order_by(Proposal.id.desc()).all()
    return [
        {
            "proposal_id": p.id,
            "client_id": p.client_id,
            "perfil": p.perfil,
            "confianza": p.confianza,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in props
    ]


@router.get("/history")
def history(db: Session = Depends(get_db)):
    """Las 3 Historias por cliente/propuesta, en un solo objeto."""
    registros = db.query(RiskProfileRecord).order_by(RiskProfileRecord.id.desc()).all()
    resultado = []
    for r in registros:
        proposal = db.get(Proposal, r.proposal_id) if r.proposal_id else None
        decision = (
            db.query(AdvisorDecision)
            .filter_by(proposal_id=r.proposal_id)
            .order_by(AdvisorDecision.id.desc())
            .first()
            if r.proposal_id
            else None
        )
        resultado.append(
            {
                "client_id": r.client_id,
                "perfil": {
                    "score": r.score,
                    "perfil": r.perfil,
                    "influencias": r.detalle.get("influencias", []),
                    "rules_version": r.rules_version,
                    "estratos": r.estratos,
                    "es_muestra_piloto": (r.test_metadata or {}).get("is_pilot_sample", False),
                },
                "propuesta": {
                    "proposal_id": proposal.id if proposal else None,
                    "distribucion": proposal.distribucion if proposal else None,
                    "proyeccion": proposal.proyeccion if proposal else None,
                    "explicacion": proposal.explicacion if proposal else None,
                }
                if proposal
                else None,
                "revision": {
                    "estado": proposal.estado if proposal else "sin_propuesta",
                    "asesor": decision.asesor if decision else None,
                    "decision": decision.decision if decision else None,
                    "comentario": decision.comentario if decision else None,
                    "created_at": decision.created_at.isoformat() if decision else None,
                },
            }
        )
    return resultado


@router.get("/quality-report")
def get_quality_report(db: Session = Depends(get_db)):
    return quality_report.full_report(db)


@router.post("/{proposal_id}/decision")
def decide(proposal_id: int, payload: DecisionIn, db: Session = Depends(get_db)):
    proposal = db.get(Proposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    if proposal.estado != "pendiente":
        raise HTTPException(status_code=409, detail="Esta propuesta ya fue decidida")
    try:
        return resume_advisory(db, proposal, payload.model_dump())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/audit")
def audit(db: Session = Depends(get_db)):
    registros = db.query(AdvisorDecision).order_by(AdvisorDecision.id.desc()).all()
    return [
        {
            "id": a.id,
            "proposal_id": a.proposal_id,
            "decision": a.decision,
            "asesor": a.asesor,
            "comentario": a.comentario,
            "edits": a.edits,
            "rules_version": a.rules_version,
            "posterior_version": a.posterior_version,
            "snapshot": a.snapshot,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in registros
    ]
