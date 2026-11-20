import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/brand/BrandMark';

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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="card w-full max-w-sm animate-rise-in space-y-5 p-8 text-center">
        <BrandMark size={56} animated className="mx-auto" />
        {deepLink ? (
          <>
            <h1 className="text-2xl font-bold text-ink">Volviendo a DoTask</h1>
            <p className="text-sm text-muted">
              Si tu navegador pregunta, permite abrir <strong>DoTask</strong>. Después puedes
              cerrar esta pestaña.
            </p>
            <a
              href={deepLink}
              className="btn-primary"
            >
              Abrir DoTask
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">Enlace no válido</h1>
            <p className="text-sm text-muted">
              Vuelve a la aplicación de escritorio y pulsa «Iniciar sesión» otra vez.
            </p>
            <Link to="/" className="text-sm font-medium text-brand hover:underline">
              Ir al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
