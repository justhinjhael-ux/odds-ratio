"""Workflow de Asesoría — arranca y reanuda el grafo LangGraph, y sincroniza
sus resultados con las tablas relacionales (Proposal, RiskProfileRecord).

El grafo mantiene su propio estado vía checkpointer SQLite; este módulo es el
puente entre ese estado y las tablas que consulta el resto de la API/UI.
"""
import uuid

from sqlalchemy.orm import Session

from app.graph.build_graph import get_graph, thread_config
from app.models import Client, Proposal, RiskProfileRecord
from app.rules.estratos import compute_estratos


def start_advisory(
    db: Session,
    cliente: dict,
    respuestas: dict[str, str],
    horizonte_meses: int = 60,
    monto_inicial: float = 10_000.0,
    respuestas_meta: list[dict] | None = None,
    test_metadata: dict | None = None,
    retroalimentacion_general: str = "",
) -> dict:
    """Crea cliente + propuesta, ejecuta el grafo hasta el checkpoint humano
    (nodos 1-6) y persiste los resultados. Devuelve el resumen para la API.
    """
    client = Client(nombre=cliente.get("nombre", ""), email=cliente.get("email", ""))
    db.add(client)
    db.flush()

    thread_id = f"thread-{client.id}-{uuid.uuid4().hex[:8]}"
    proposal = Proposal(client_id=client.id, thread_id=thread_id, estado="pendiente")
    db.add(proposal)
    db.flush()
    db.commit()

    graph = get_graph()
    estado_inicial = {
        "client_id": client.id,
        "proposal_id": proposal.id,
        "respuestas": respuestas,
        "horizonte_meses": horizonte_meses,
        "monto_inicial": monto_inicial,
    }
    resultado = graph.invoke(estado_inicial, thread_config(thread_id))

    # Sincroniza la propuesta con lo que produjo el grafo (nodos 1-6)
    proposal.perfil = resultado["perfil_final"]
    proposal.confianza = resultado["confianza"]
    proposal.distribucion = resultado["propuesta"]["distribucion"]
    proposal.proyeccion = resultado["proyeccion"]
    proposal.explicacion = resultado["explicacion"]
    proposal.rules_version = resultado["perfil_reglas"]["rules_version"]
    proposal.posterior_version = resultado["posterior"]["version"]
    proposal.guardrail_activado = resultado.get("guardrail_activado", False)
    proposal.llm_provider = resultado.get("llm_provider", "n/d")
    proposal.alerta_cumplimiento = resultado.get("alerta_cumplimiento", {})

    perfil_reglas = resultado["perfil_reglas"]
    registro = RiskProfileRecord(
        client_id=client.id,
        proposal_id=proposal.id,
        rules_version=perfil_reglas["rules_version"],
        score=perfil_reglas["score"],
        perfil=perfil_reglas["perfil"],
        detalle=perfil_reglas,
        estratos=compute_estratos(respuestas),
        test_metadata=test_metadata or {},
        respuestas_meta=[m for m in (respuestas_meta or [])],
        retroalimentacion_general=retroalimentacion_general,
    )
    db.add(registro)
    db.commit()

    # Autopiloto: intenta auto-aprobar si la confianza/umbral/Cumplimiento lo permiten
    from app.workflows import autopilot  # import tardío evita ciclos

    auto = autopilot.maybe_auto_approve(db, proposal)
    if auto is not None:
        db.refresh(proposal)

    return {
        "proposal_id": proposal.id,
        "client_id": client.id,
        "thread_id": thread_id,
        "perfil": proposal.perfil,
        "confianza": proposal.confianza,
        "distribucion": proposal.distribucion,
        "proyeccion": proposal.proyeccion,
        "explicacion": proposal.explicacion,
        "estado": proposal.estado,
        "guardrail_activado": proposal.guardrail_activado,
        "alerta_cumplimiento": proposal.alerta_cumplimiento,
        "autopilot_aplicado": auto is not None,
    }


def resume_advisory(db: Session, proposal: Proposal, decision: dict) -> dict:
    """Reanuda el grafo interrumpido con la decisión del asesor (Historia 3):
    ejecuta revision_humana + auditoria, y sincroniza el estado final."""
    if proposal.estado != "pendiente":
        raise RuntimeError(
            f"La propuesta {proposal.id} ya fue decidida (estado='{proposal.estado}'); "
            "no se puede procesar una segunda decisión sobre el mismo hilo."
        )
    graph = get_graph()
    cfg = thread_config(proposal.thread_id)
    graph.update_state(cfg, {"decision": decision})
    resultado = graph.invoke(None, cfg)

    db.expire(proposal)
    proposal_actualizada = db.get(Proposal, proposal.id)

    return {
        "proposal_id": proposal_actualizada.id,
        "estado": proposal_actualizada.estado,
        "estado_final": resultado["estado_final"],
        "audit_id": resultado["audit_id"],
        "posterior_actualizado": resultado["posterior_actualizado"],
    }
