import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Último paso del login de la app de escritorio: el API redirige aquí tras el
 * inicio de sesión con Google y esta página devuelve el código a la app con el
 * enlace `dotask://auth?code=…`. El código solo sirve junto al verificador secreto
 * que guarda la app, así que verlo en el navegador no da acceso a la cuenta.
 */
export default function AppOpenPage() {
  const code = new URLSearchParams(window.location.search).get('code');
  const deepLink = code ? `dotask://auth?code=${encodeURIComponent(code)}` : null;

  useEffect(() => {
    document.title = 'Abriendo DoTask…';
    if (deepLink) window.location.href = deepLink;
  }, [deepLink]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 text-center shadow">
        {deepLink ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Volviendo a DoTask</h1>
            <p className="text-sm text-gray-600">
              Si tu navegador pregunta, permite abrir <strong>DoTask</strong>. Después puedes
              cerrar esta pestaña.
            </p>
            <a
              href={deepLink}
              className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Abrir DoTask
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Enlace no válido</h1>
            <p className="text-sm text-gray-600">
              Vuelve a la aplicación de escritorio y pulsa «Iniciar sesión» otra vez.
            </p>
            <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
              Ir al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
