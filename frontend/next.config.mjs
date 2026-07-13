/** @type {import('next').NextConfig} */
// ## NOTA: 'basePath'/'output' son SOLO configuración de despliegue.
// ## basePath se toma de env (vacío en dev local → la app sigue en '/').
// ## En producción (jbstrategybusiness.com/odds) se compila con
// ## NEXT_PUBLIC_BASE_PATH=/odds. No cambia ninguna lógica de la app.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  basePath: basePath || undefined,
};

export default nextConfig;
