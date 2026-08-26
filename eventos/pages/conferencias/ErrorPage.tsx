import { useNavigate } from '@/utils/nextRouterCompat';

function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="flex items-center justify-center p-8 bg-gradient-to-br from-[#eef2ff] to-[#f0fdf4]">
          <div className="max-w-xs text-center">
            <svg
              className="mx-auto mb-6 w-40 h-40"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <rect x="12" y="12" width="176" height="176" rx="18" fill="#fff" stroke="url(#g1)" strokeWidth="4" />
              <path d="M60 70h80v12H60z" fill="#f8fafc" />
              <path d="M60 96h80v12H60z" fill="#f8fafc" />
              <path d="M60 122h40v12H60z" fill="#f8fafc" />
              <circle cx="140" cy="142" r="16" fill="url(#g1)" />
              <g transform="translate(44,40)">
                <path d="M40 10 L50 40 L30 40 Z" fill="#f97316" />
                <rect x="0" y="0" width="80" height="8" rx="4" fill="#a78bfa" opacity="0.15"/>
              </g>
            </svg>

            <p className="text-sm text-gray-600">
              Ups — algo no salió como esperábamos. Pero no te preocupes, intentar regresar.
            </p>
          </div>
        </div>

        <div className="p-8 flex flex-col justify-center">
          <div className="mb-4">
            <p className="text-sm font-medium text-indigo-600 inline-flex items-center gap-2">
              <span className="px-2 py-1 bg-indigo-100 rounded-full text-indigo-700 text-xs">Error 404</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => navigate(-1)} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition">
              Regresar
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-400">
            <p>Si el problema persiste, contacta al soporte o prueba limpiar la caché del navegador.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;
