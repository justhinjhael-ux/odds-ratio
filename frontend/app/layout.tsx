// ## ==========================================================================
// ## app/layout.tsx — Layout raíz: header con navegación + footer con
// ## disclaimer permanente (regla obligatoria del track: nunca letra pequeña).
// ## ==========================================================================
import type { Metadata } from "next";
import Link from "next/link";
import HelpWidget from "@/components/HelpWidget";
import ToastProvider from "@/components/Toast";
import { asset } from "@/lib/assetPath";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odds Ratio — Robo-Advisory Agéntico",
  description: "Track 3: Robo-Advisory · Agentic Scale 2026 · Dataclub ESPOL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-white/60 shadow-[0_1px_0_rgba(91,24,217,0.06)]">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/logo-mark.png")} alt="Odds Ratio" className="h-9 w-auto" />
              <span>
                <span className="block font-extrabold text-brand-900 tracking-tight leading-tight">Odds Ratio</span>
                <span className="block text-[9px] font-bold text-brand-500 tracking-widest leading-tight">
                  ANÁLISIS · ESTADÍSTICA · DECISIONES
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-semibold text-brand-700">
              <Link href="/onboarding" className="hover:text-brand-900">Crear perfil</Link>
              <Link href="/chat" className="hover:text-brand-900">Chat ORAI</Link>
              <Link href="/asesor" className="hover:text-brand-900">Panel Operativo</Link>
              {/* ## Confianza: sus datos están protegidos, visible en cada pantalla */}
              <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 border-l border-slate-200 pl-4">
                <span className="text-success-500">🔒</span> Datos cifrados en tránsito
              </span>
            </nav>
          </div>
        </header>

        <ToastProvider>
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>

          <footer className="border-t border-white/60 bg-white/50 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-6 py-4 space-y-2.5">
              <p className="disclaimer-banner">
                Proyecto demostrativo con datos ficticios y simulaciones ilustrativas. El
                sistema nunca ejecuta órdenes reales ni promete rentabilidad: toda acción
                sensible queda como propuesta sujeta a aprobación de un asesor humano.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                Todos los sistemas operativos
              </div>
            </div>
          </footer>

          <HelpWidget />
        </ToastProvider>
      </body>
    </html>
  );
}
