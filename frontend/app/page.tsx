// ## ==========================================================================
// ## app/page.tsx — Landing page renovada: hero con gradiente, métricas del
// ## sistema, pilares técnicos y flujo de 3 pasos. Creativa pero formal.
// ## ==========================================================================
import Link from "next/link"; // ## navegación interna sin recargar
import RoiCalculator from "@/components/RoiCalculator"; // ## calculadora para CEOs

// ## Tarjeta de pilar técnico con hover elevado
function Pilar({ icono, titulo, texto }: { icono: string; titulo: string; texto: string }) {
  return (
    <div className="card-premium hover:-translate-y-1 p-6">
      {/* ## ícono en marco redondeado — como un app-icon */}
      <div className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl">{icono}</div>
      <h3 className="font-bold text-brand-900 mt-3.5">{titulo}</h3>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{texto}</p>
    </div>
  );
}

// ## Tarjeta de método estadístico (mapea cada técnica a una categoría de riesgo)
function MetodoEstadistico({
  icono,
  metodo,
  categoria,
  texto,
}: {
  icono: string;
  metodo: string;
  categoria: string;
  texto: string;
}) {
  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-lg shrink-0">
          {icono}
        </span>
        <div>
          <p className="font-bold text-brand-900 text-sm leading-tight">{metodo}</p>
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{categoria}</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">{texto}</p>
    </div>
  );
}

// ## Métrica destacada del sistema (credibilidad técnica de un vistazo)
function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold text-white tracking-tight">{valor}</p>
      <p className="text-xs text-brand-100/80 uppercase tracking-wider mt-1">{etiqueta}</p>
    </div>
  );
}

// ## Componente principal de la landing
export default function Home() {
  return (
    <div className="space-y-14">
      {/* ## ---------- Hero con gradiente y CTAs duales ---------- */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-950 via-brand-900 to-brand-500 text-white px-8 py-14 shadow-deep">
        {/* ## círculos decorativos de fondo (profundidad visual, estilo Apple) */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-sm" />
        <div className="absolute -bottom-24 -left-10 w-80 h-80 bg-white/5 rounded-full blur-sm" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-brand-300/10 rounded-full blur-xl" />

        <div className="relative max-w-3xl animate-rise">
          {/* ## Badge del hackathon — contexto inmediato para el jurado */}
          <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-semibold px-3.5 py-1.5 rounded-pill mb-5">
            🏆 Agentic Scale 2026 · Track 3 · Robo-Advisory
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight">
            La IA propone.<br />
            <span className="text-brand-300">Los humanos deciden.</span><br />
            La estadística respalda.
          </h1>
          <p className="mt-5 text-lg text-brand-100/90 max-w-xl leading-relaxed">
            Robo-advisory con inferencia bayesiana que aprende de cada decisión
            de tus asesores — y un LLM que jamás puede inventar una cifra.
          </p>
          {/* ## CTAs: cliente (perfil) y curioso (chat) */}
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/onboarding"
              className="bg-white text-brand-900 font-bold px-7 py-3 rounded-xl shadow-lift hover:scale-105 active:scale-100 transition-transform duration-300 ease-ios"
            >
              Crear mi perfil →
            </Link>
            <Link
              href="/chat"
              className="bg-white/10 backdrop-blur-sm border border-white/20 font-semibold px-7 py-3 rounded-xl hover:bg-white/20 active:scale-95 transition-all duration-200 ease-ios"
            >
              💬 Hablar con ORAI
            </Link>
          </div>
        </div>

        {/* ## Fila de métricas del sistema (evidencia técnica) */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10">
          <Metrica valor="8" etiqueta="Nodos LangGraph" />
          <Metrica valor="65" etiqueta="Tests automatizados" />
          <Metrica valor="4" etiqueta="Modelos estadísticos" />
          <Metrica valor="100%" etiqueta="Decisiones humanas" />
        </div>
      </section>

      {/* ## ---------- Pilares técnicos (lo que evalúa el jurado) ---------- */}
      <section>
        <h2 className="text-2xl font-extrabold text-brand-900 mb-5 text-center tracking-tight">
          Arquitectura pensada para banca regulada
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          <Pilar
            icono="🧠"
            titulo="Grafo agéntico"
            texto="8 nodos LangGraph con checkpoint humano persistente: el flujo se detiene hasta que un asesor autorizado decide."
          />
          <Pilar
            icono="📈"
            titulo="Bayes con feedback"
            texto="Posterior Beta-Binomial que se retroalimenta solo con cada decisión + priors anclados a cómo la banca reinvierte depósitos."
          />
          <Pilar
            icono="🛡️"
            titulo="Antialucinación activa"
            texto="Gemini solo redacta números ya calculados; un validador descarta cualquier cifra inventada — en propuestas y en el chat."
          />
          <Pilar
            icono="🔐"
            titulo="Control operativo"
            texto="Panel exclusivo para funcionarios: ranking bayesiano de clientes, revisión, auditoría append-only y supervisión del chat."
          />
        </div>
      </section>

      {/* ## ---------- Arquitectura de modelos: el "cómo" de la estandarización ---------- */}
      <section>
        <h2 className="text-2xl font-extrabold text-brand-900 mb-2 text-center tracking-tight">
          4 modelos estadísticos, un solo criterio estandarizado
        </h2>
        <p className="text-sm text-slate-500 text-center max-w-2xl mx-auto mb-6 leading-relaxed">
          Nuestro problema a resolver: estandarizar el perfilamiento de riesgo y la
          generación de propuestas de portafolio — sin que el criterio varíe de un
          asesor a otro, y sin que la IA decida por su cuenta. Cada modelo calcula
          datos reales y auditables; el asesor humano sigue siendo el responsable final.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <MetodoEstadistico
            icono="🎯"
            metodo="Beta-Binomial"
            categoria="Perfilamiento bayesiano"
            texto="Estandariza qué tan confiable es la clasificación de riesgo de cada cliente, y se retroalimenta solo con cada decisión del asesor — el mismo criterio para todos los casos."
          />
          <MetodoEstadistico
            icono="📊"
            metodo="Normal-Normal"
            categoria="Proyección bayesiana"
            texto="Estandariza la proyección del portafolio con bandas de credibilidad (nunca una única cifra), ancladas a cómo la banca reinvierte depósitos reales."
          />
          <MetodoEstadistico
            icono="📐"
            metodo="Markowitz (media-varianza)"
            categoria="Optimización de cartera"
            texto="Valida la asignación por reglas contra la teoría moderna de carteras: separa el activo libre de riesgo del resto y ajusta la mezcla según la aversión al riesgo del perfil."
          />
          <MetodoEstadistico
            icono="📏"
            metodo="Alfa de Cronbach"
            categoria="Calidad del cuestionario"
            texto="Mide la consistencia interna real de las 10 preguntas obligatorias sobre los datos ya recolectados — sin eso, ninguna métrica agregada sería confiable."
          />
        </div>

        {/* ## Capa de lenguaje y orquestación — complementan los modelos, no calculan cifras */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <MetodoEstadistico
            icono="💬"
            metodo="Gemini (NLP financiero)"
            categoria="Explicación en lenguaje natural"
            texto="Redacta en español lo que los modelos ya calcularon — nunca genera una cifra propia. Un guardrail descarta cualquier número que no exista en los datos de entrada."
          />
          <MetodoEstadistico
            icono="🕸️"
            metodo="LangGraph"
            categoria="Arquitectura multiagente"
            texto="8 nodos orquestan perfilamiento, propuesta, proyección y auditoría con un checkpoint que detiene el flujo hasta que un asesor humano decide."
          />
        </div>

        {/* ## Por qué NO usamos LSTM/ARIMA/XGBoost/redes — la pregunta que todo jurado técnico hace */}
        <div className="card-premium p-6 mt-4 bg-gradient-to-br from-brand-50 to-white">
          <p className="font-bold text-brand-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-base">🤔</span>
            ¿Por qué no LSTM, ARIMA, XGBoost o redes neuronales?
          </p>
          <p className="text-sm text-slate-600 mt-2.5 leading-relaxed ml-10">
            Son excelentes para predecir precios o detectar patrones de mercado —
            pero son <b>cajas negras</b>: no se puede reconstruir a mano por qué
            un modelo entregó tal cifra. En asesoría financiera <b>regulada</b>,
            cada recomendación individual debe ser auditable ante un regulador o
            un cliente. Bayes y Markowitz son matemáticamente transparentes: cada
            número de este sistema se puede recalcular con lápiz y papel. Por eso
            elegimos interpretabilidad sobre capacidad predictiva bruta.
          </p>
        </div>
      </section>

      {/* ## ---------- Calculadora ROI: el pitch para directivos ---------- */}
      <RoiCalculator />

      {/* ## ---------- Cómo funciona: los 3 pasos ---------- */}
      <section className="card-premium p-8">
        <h2 className="text-2xl font-extrabold text-brand-900 mb-6 tracking-tight">¿Cómo funciona?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* ## Paso 1: perfilamiento transparente */}
          <div className="relative pl-4 border-l-[3px] border-brand-500">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-wide">Paso 1</span>
            <h3 className="font-bold text-brand-900 mt-1">Perfil transparente</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              10 preguntas evaluadas con reglas versionadas, más una pregunta
              opcional de retroalimentación. Cada respuesta te explica cuánto
              influyó — cero cajas negras.
            </p>
          </div>
          {/* ## Paso 2: propuesta con fan chart */}
          <div className="relative pl-4 border-l-[3px] border-sky-400">
            <span className="text-xs font-bold text-sky-500 uppercase tracking-wide">Paso 2</span>
            <h3 className="font-bold text-brand-900 mt-1">Propuesta explicable</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Distribución de activos + fan chart bayesiano con bandas de
              credibilidad. Gemini lo explica en tu idioma, sin inventar nada.
            </p>
          </div>
          {/* ## Paso 3: decisión humana */}
          <div className="relative pl-4 border-l-[3px] border-success-400">
            <span className="text-xs font-bold text-success-500 uppercase tracking-wide">Paso 3</span>
            <h3 className="font-bold text-brand-900 mt-1">Decisión humana</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Un asesor autorizado aprueba, edita o rechaza. Su decisión queda
              auditada y retroalimenta el modelo bayesiano del sistema.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
