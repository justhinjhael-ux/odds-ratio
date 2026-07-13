# Guion del video (3:00) — Odds Ratio
### 3 integrantes, un tema cada uno. Simple, directo, cronometrado.

> Graben la pantalla con la app corriendo (`docker compose up` o local).
> Cada persona habla solo en su bloque — el que no habla se queda en silencio.
> Practiquen una vez completos antes de la toma final; el guion tiene margen.

---

## Integrante 1 — El problema y la arquitectura (0:00 – 1:00)

*(Cámara o slide con el logo de Odds Ratio)*

> "Hola, somos el equipo **Odds Ratio**, del Dataclub de ESPOL — Track 3:
> Robo-Advisory. El problema que resolvemos: estandarizar el perfilamiento de
> riesgo y la generación de propuestas de portafolio, sin que el criterio
> cambie de un asesor a otro, y sin que una IA decida sola algo tan sensible
> como el dinero de un cliente.
>
> Nuestra solución es un **agente construido con LangGraph**: un grafo de 8
> pasos que perfila al cliente, calcula una propuesta con modelos
> estadísticos, la explica con Google Gemini, y luego **se detiene** — literal,
> se pausa — hasta que un asesor humano autorizado decide. La IA propone, la
> estadística respalda, el humano decide."

*(Mostrar el diagrama de arquitectura del documento explicativo, 5 segundos)*

---

## Integrante 2 — Demo: perfilamiento y modelos estadísticos (1:00 – 2:10)

*(Pantalla: `/onboarding` → llenar el cuestionario en vivo, avanzar rápido)*

> "El cliente responde un cuestionario de 10 preguntas con reglas versionadas
> en YAML — cada respuesta explica cuánto influyó, cero cajas negras.
>
> Con esas respuestas corren **tres modelos estadísticos que se retroalimentan
> entre sí**: primero, un modelo **Beta-Binomial** calcula qué tan confiable es
> la clasificación de ese perfil — y esa confianza se actualiza cada vez que
> un asesor aprueba o corrige una propuesta, así que el sistema aprende con el
> tiempo. Segundo, un modelo **Normal-Normal** proyecta el portafolio con un
> *fan chart*: nunca una promesa de rentabilidad, siempre un abanico de
> escenarios con sus percentiles. Y tercero, comparamos esa propuesta contra
> la optimización clásica de **Markowitz**, para validar que la asignación
> tiene sentido matemático."

*(Mostrar la propuesta generada: distribución + fan chart)*

> "Todo esto lo redacta Gemini en lenguaje natural — pero con un guardrail:
> si el texto tiene un solo número que no viene de estos modelos, se descarta
> automáticamente. La IA nunca inventa una cifra."

---

## Integrante 3 — Demo: decisión humana y cierre (2:10 – 3:00)

*(Pantalla: `/asesor` → clic en Aprobar una propuesta pendiente)*

> "Acá está el corazón regulatorio: el **panel del asesor**. La propuesta
> estaba en pausa, esperando a un humano. Al aprobar, tres cosas pasan: se
> guarda una auditoría completa e inalterable, la propuesta queda aprobada, y
> — miren arriba — la **confianza bayesiana sube en vivo**. Esa es la
> retroalimentación: cada decisión humana hace más inteligente al modelo del
> siguiente cliente.
>
> Y cuando esa confianza es suficientemente alta, activamos el **Modo
> Autopiloto**: el sistema se gana la autonomía estadísticamente y aprueba
> solo los casos rutinarios, firmando la auditoría a su nombre — mientras el
> asesor humano se concentra en los casos que realmente importan.
>
> Odds Ratio: estadística que respalda, IA que explica, y el humano que
> siempre toma la última decisión. Gracias."

---

### Checklist antes de grabar

- [ ] Backend y frontend corriendo, base de datos limpia (borrar `*.db` para empezar de cero)
- [ ] `GEMINI_API_KEY` configurada (o demo con mock — el flujo se ve igual)
- [ ] Zoom del navegador al 110–125 % para legibilidad en el video
- [ ] Definir de antemano quién es Integrante 1, 2 y 3, y ensayar la transición entre bloques
- [ ] Cronometrar un ensayo completo antes de la toma final (meta: 3:00 exactos)
