"""Tests del optimizador Markowitz (Teorema de Separación de Dos Fondos)."""
from app.bayes import portfolio_optimizer as po


def test_tangency_portfolio_pesos_suman_uno():
    tan = po.tangency_portfolio()
    total = sum(tan["pesos"].values())
    assert abs(total - 1.0) < 1e-6


def test_tangency_portfolio_no_incluye_efectivo():
    tan = po.tangency_portfolio()
    assert po.ACTIVO_LIBRE_DE_RIESGO not in tan["pesos"]


def test_pesos_no_negativos():
    tan = po.tangency_portfolio()
    assert all(w >= -1e-9 for w in tan["pesos"].values())


def test_optimize_for_profile_incluye_efectivo():
    r = po.optimize_for_profile("moderado")
    assert po.ACTIVO_LIBRE_DE_RIESGO in r["pesos"]


def test_optimize_for_profile_pesos_suman_100():
    for perfil in ("conservador", "moderado", "agresivo"):
        r = po.optimize_for_profile(perfil)
        assert abs(sum(r["pesos"].values()) - 100) < 0.5


def test_conservador_mas_efectivo_que_agresivo():
    """La aversión al riesgo (λ) debe reflejarse en la fracción de efectivo:
    conservador (λ alta) >> agresivo (λ baja)."""
    cons = po.optimize_for_profile("conservador")
    agre = po.optimize_for_profile("agresivo")
    assert cons["pesos"][po.ACTIVO_LIBRE_DE_RIESGO] > agre["pesos"][po.ACTIVO_LIBRE_DE_RIESGO]


def test_fraccion_riesgosa_creciente_con_perfil():
    cons = po.optimize_for_profile("conservador")["fraccion_riesgosa"]
    mod = po.optimize_for_profile("moderado")["fraccion_riesgosa"]
    agre = po.optimize_for_profile("agresivo")["fraccion_riesgosa"]
    assert cons <= mod <= agre


def test_version_presente():
    r = po.optimize_for_profile("moderado")
    assert r["version"] == po.OPTIMIZER_VERSION
