"use client";
// ## ==========================================================================
// ## components/HelpWidget.tsx — Centro de ayuda flotante, visible en toda la
// ## app: FAQ rápida, acceso al chat ORAI, horario de atención humana y
// ## estado del sistema. El usuario nunca debe sentir que está solo.
// ## Solo consume el endpoint /chat/sugerencias que YA existía — ninguna
// ## lógica ni ruta nueva en el backend.
// ## ==========================================================================
import Link from "next/link";
import { useEffect, useState } from "react";
import { getChatSugerencias } from "@/lib/api";

const FAQ = [
  {
    q: "¿ODS Ratio ejecuta órdenes reales?",
    a: "No. Es un proyecto demostrativo: toda acción sensible queda como propuesta sujeta a la aprobación de un asesor humano autorizado.",
  },
  {
    q: "¿Cómo se calcula mi perfil de riesgo?",
    a: "Con reglas versionadas sobre tus 10 respuestas y un modelo bayesiano (Beta-Binomial) que estima qué tan confiable es esa clasificación.",
  },
  {
    q: "¿La IA puede inventar cifras?",
    a: "No. Un guardrail antialucinación descarta cualquier número que el modelo de lenguaje redacte y no exista ya en los datos calculados.",
  },
  {
    q: "¿Puedo hablar con una persona?",
    a: "Sí — el Chat ORAI siempre recomienda ayuda humana y muestra el horario de atención vigente.",
  },
];

export default function HelpWidget() {
  const [abierto, setAbierto] = useState(false);
  const [horario, setHorario] = useState("");
  const [estado, setEstado] = useState<"cargando" | "operativo" | "error">("cargando");

  useEffect(() => {
    getChatSugerencias()
      .then((s) => {
        setHorario(s.horario_atencion);
        setEstado("operativo");
      })
      .catch(() => setEstado("error"));
  }, []);

  return (
    <div className="fixed bottom-5 left-5 z-[90]">
      {abierto && (
        <div className="mb-3 w-80 max-w-[85vw] card-premium p-5 animate-rise">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-brand-900">Centro de ayuda</p>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar centro de ayuda"
              className="h-6 w-6 rounded-full bg-brand-50 text-brand-500 text-xs flex items-center justify-center hover:bg-brand-100"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs mb-4 bg-brand-50/70 border border-brand-100 rounded-xl px-3 py-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                estado === "operativo" ? "bg-success-500 animate-pulse" : estado === "error" ? "bg-red-400" : "bg-slate-300"
              }`}
            />
            <span className="text-slate-600">
              {estado === "operativo" && "Sistema operativo"}
              {estado === "error" && "No se pudo verificar el estado"}
              {estado === "cargando" && "Verificando estado…"}
            </span>
          </div>

          <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
            {FAQ.map((f) => (
              <div key={f.q}>
                <p className="text-xs font-bold text-brand-800">{f.q}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          {horario && (
            <p className="text-[11px] text-brand-600 bg-white/70 border border-brand-100 rounded-xl px-3 py-2 mt-4">
              📞 Atención humana: {horario}
            </p>
          )}

          <Link
            href="/chat"
            onClick={() => setAbierto(false)}
            className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-b from-brand-500 to-brand-700 rounded-xl py-2.5 hover:-translate-y-0.5 transition-transform"
          >
            💬 Hablar con ORAI ahora
          </Link>
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar centro de ayuda" : "Abrir centro de ayuda"}
        className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-accent text-white shadow-deep flex items-center justify-center text-lg hover:scale-105 active:scale-95 transition-transform"
      >
        {abierto ? "✕" : "❔"}
      </button>
    </div>
  );
}
