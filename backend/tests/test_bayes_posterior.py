"""Tests del posterior Beta-Binomial (risk_posterior)."""
from app.bayes import risk_posterior
from app.models import Client


def _crear_cliente(db):
    c = Client(nombre="Test", email="t@t.com")
    db.add(c)
    db.flush()
    return c.id


def test_prior_correcto(db):
    client_id = _crear_cliente(db)
    post = risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    assert post.alpha == risk_posterior.PRIOR_ALPHA
    assert post.beta == risk_posterior.PRIOR_BETA
    assert risk_posterior.confidence(post.alpha, post.beta) == 0.5


def test_actualizacion_approve(db):
    client_id = _crear_cliente(db)
    risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    post = risk_posterior.update_posterior(db, client_id, "moderado", "approve")
    assert post.alpha == risk_posterior.PRIOR_ALPHA + 1.0
    assert post.beta == risk_posterior.PRIOR_BETA


def test_actualizacion_reject(db):
    client_id = _crear_cliente(db)
    risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    post = risk_posterior.update_posterior(db, client_id, "moderado", "reject")
    assert post.beta == risk_posterior.PRIOR_BETA + 1.0
    assert post.alpha == risk_posterior.PRIOR_ALPHA


def test_actualizacion_edit(db):
    client_id = _crear_cliente(db)
    risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    post = risk_posterior.update_posterior(db, client_id, "moderado", "edit")
    assert post.alpha == risk_posterior.PRIOR_ALPHA + 0.5
    assert post.beta == risk_posterior.PRIOR_BETA + 0.5


def test_decision_invalida(db):
    import pytest

    client_id = _crear_cliente(db)
    with pytest.raises(ValueError):
        risk_posterior.update_posterior(db, client_id, "moderado", "decision_inexistente")


def test_intervalo_credibilidad_ordenado():
    lo, hi = risk_posterior.credible_interval(5, 5)
    assert 0.0 <= lo < hi <= 1.0


def test_intervalo_credibilidad_reproducible():
    a = risk_posterior.credible_interval(3, 7)
    b = risk_posterior.credible_interval(3, 7)
    assert a == b  # semilla fija -> mismo resultado


def test_posterior_summary_incluye_version(db):
    client_id = _crear_cliente(db)
    post = risk_posterior.get_or_create_posterior(db, client_id, "agresivo")
    resumen = risk_posterior.posterior_summary(post)
    assert resumen["version"] == risk_posterior.POSTERIOR_VERSION
    assert resumen["perfil"] == "agresivo"
    assert 0.0 <= resumen["confianza"] <= 1.0
    assert len(resumen["intervalo_credibilidad_90"]) == 2


def test_get_or_create_reutiliza_registro(db):
    client_id = _crear_cliente(db)
    p1 = risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    p1.alpha = 9.0
    db.flush()
    p2 = risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    assert p2.alpha == 9.0
    assert p1.id == p2.id


def test_confianza_sube_con_mas_aprobaciones(db):
    client_id = _crear_cliente(db)
    risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    antes = risk_posterior.confidence(
        *(lambda p: (p.alpha, p.beta))(
            risk_posterior.get_or_create_posterior(db, client_id, "moderado")
        )
    )
    for _ in range(3):
        risk_posterior.update_posterior(db, client_id, "moderado", "approve")
    post = risk_posterior.get_or_create_posterior(db, client_id, "moderado")
    despues = risk_posterior.confidence(post.alpha, post.beta)
    assert despues > antes
