"use client";
// ## ==========================================================================
// ## RoiCalculator.tsx — Calculadora de ahorro operativo para directivos.
// ## Compara el costo de N asesores humanos contra 1 supervisor + Odds Ratio
// ## en Modo Autopiloto. Puramente ilustrativo (declarado en el propio texto).
// ## ==========================================================================
import { useState } from "react";

// ## Hidration-safety: forzar locale fijo evita mismatch servidor/cliente
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function RoiCalculator() {
  const [asesores, setAsesores] = useState(10);
  const [salarioMensual, setSalarioMensual] = useState(2000);
  const [porcentajeAutomatizable, setPorcentajeAutomatizable] = useState(80);

  const costoActual = asesores * salarioMensual;
  const costoSupervisor = salarioMensual * 1.3; // ## un supervisor senior, algo mejor pagado
  const ahorroMensual = Math.max(costoActual * (porcentajeAutomatizable / 100) - costoSupervisor, 0);
  const ahorroAnual = ahorroMensual * 12;

  return (
    <section className="card-premium p-8">
      <h2 className="text-2xl font-extrabold text-brand-900 mb-2 tracking-tight">
        Calculadora de ahorro operativo
      </h2>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Estimación ilustrativa para directivos: cuánto costaría hoy tu equipo de asesoría
        de rutina, frente a 1 supervisor humano + Odds Ratio en Modo Autopiloto.
      </p>

      <div className="grid md:grid-cols-3 gap-5 mb-6">
        <label className="text-sm font-semibold text-brand-800">
          Asesores actuales
          <input
            type="number"
            min={1}
            value={asesores}
            onChange={(e) => setAsesores(Math.max(1, Number(e.target.value)))}
            className="mt-1.5 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal text-slate-700"
          />
        </label>
        <label className="text-sm font-semibold text-brand-800">
          Salario mensual por asesor (USD)
          <input
            type="number"
            min={0}
            value={salarioMensual}
            onChange={(e) => setSalarioMensual(Math.max(0, Number(e.target.value)))}
            className="mt-1.5 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal text-slate-700"
          />
        </label>
        <label className="text-sm font-semibold text-brand-800">
          % de trabajo rutinario automatizable
          <input
            type="number"
            min={0}
            max={100}
            value={porcentajeAutomatizable}
            onChange={(e) => setPorcentajeAutomatizable(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="mt-1.5 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal text-slate-700"
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-brand-50 p-5">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Ahorro mensual estimado</p>
          <p className="text-3xl font-extrabold text-brand-900 mt-1">${fmt(ahorroMensual)}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-5">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Ahorro anual estimado</p>
          <p className="text-3xl font-extrabold text-brand-900 mt-1">${fmt(ahorroAnual)}</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-4">
        Cifras ilustrativas basadas en tus propios supuestos — no son una proyección financiera
        de Odds Ratio ni de terceros.
      </p>
    </section>
  );
}
