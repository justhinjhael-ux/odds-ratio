"use client";
// ## ==========================================================================
// ## app/chat/page.tsx — ORAI: asistente de atención general (call center).
// ## Guardrails duros: nunca cifras, escala a humano si detecta solicitud de
// ## inversión. NOTA: el avatar ilustrado original se perdió junto con el
// ## resto de assets binarios — placeholder con inicial mientras se reemplaza.
// ## ==========================================================================
import { useState } from "react";
import { sendChatMessage } from "@/lib/api";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
  escalado?: boolean;
}

const SESSION_ID = `sess-${Math.random().toString(36).slice(2, 10)}`;

export default function ChatPage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { role: "assistant", content: "¡Hola! Soy ORAI, el asistente de Odds Ratio. ¿En qué puedo ayudarte hoy?" },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) return;
    const mensajeUsuario = texto.trim();
    setMensajes((prev) => [...prev, { role: "user", content: mensajeUsuario }]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await sendChatMessage(SESSION_ID, mensajeUsuario);
      setMensajes((prev) => [...prev, { role: "assistant", content: r.respuesta, escalado: r.escalado }]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: "No pude conectarme al servidor. Intenta de nuevo en un momento." },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[70vh]">
      <div className="flex items-center gap-3 pb-4 border-b border-brand-100">
        <span className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white font-extrabold flex items-center justify-center">
          OR
        </span>
        <div>
          <p className="font-bold text-brand-900">ORAI</p>
          <p className="text-xs text-slate-400">Asistente de atención general — sin cifras, con guardrails</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                m.role === "user" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-900"
              }`}
            >
              {m.content}
              {m.escalado && (
                <p className="text-[10px] mt-1 uppercase tracking-wide font-bold text-amber-500">
                  Escalado a asesor humano
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-3 border-t border-brand-100">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu mensaje…"
          className="flex-1 rounded-xl border border-brand-100 px-3.5 py-2.5 text-sm"
        />
        <button onClick={enviar} disabled={enviando} className="btn-primary disabled:opacity-50">
          Enviar
        </button>
      </div>
    </div>
  );
}
