import helmet from 'helmet';

// CSP explícita (sem os defaults do helmet) para a política ser exatamente a documentada.
// `style-src-attr 'unsafe-inline'`: as views e o HTML montado pelo JS trazem ~45 `style="…"`
// (cor da zona, `--p` do placar), sempre com valores de constantes ou números calculados no
// servidor, nunca texto do usuário. Continuam barrados `<script>` inline, handlers `on*`
// e `<style>` injetado.
export function securityHeaders(env) {
  const production = env.NODE_ENV === 'production';
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'connect-src': ["'self'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'img-src': ["'self'", 'https://tile.openstreetmap.org'],
        'object-src': ["'none'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'style-src-attr': ["'unsafe-inline'"],
        ...(production ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
    strictTransportSecurity: production,
    // O errorHandler usa o Referer do mesmo host no "Atualizar e tentar de novo" (spec 009).
    referrerPolicy: { policy: 'same-origin' },
    frameguard: { action: 'deny' },
  });
}
