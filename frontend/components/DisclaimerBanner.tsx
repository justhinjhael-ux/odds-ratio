// ## Banner de advertencia reutilizable — NUNCA letra pequeña (regla del track)
export default function DisclaimerBanner({ texto }: { texto?: string }) {
  return (
    <p className="disclaimer-banner">
      {texto ??
        "Simulación ilustrativa basada en datos ficticios. No es una garantía ni promesa de rentabilidad — un asesor humano autorizado revisa cada propuesta."}
    </p>
  );
}
