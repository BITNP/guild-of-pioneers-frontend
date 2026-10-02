# Guild of Pioneers frontend

Vue application using the backend's Keycloak OIDC login and same-origin Cookie session.

## Development

Use the existing Node/pnpm tools, or Bun to install the locked dependencies. With Bun, use the installed Node runtime for the Vue type checker:

```bash
bun install --frozen-lockfile
bun run dev
bun run build
bun test
```

The Vite proxy forwards `/api` and `/uploads` to the backend on port 8080. For local login, configure the backend's `APP_PUBLIC_URL` as `http://localhost:5173`, register `http://localhost:5173/api/auth/oidc/callback/keycloak` in Keycloak, and set `APP_SECURE_COOKIE=false`. In production, use the actual HTTPS frontend origin and Secure cookies.

The Docker build uses the committed pnpm lockfile. It does not require a separate npm lockfile.

The login page redirects to the backend's OIDC entry point. A verified identity without site membership reaches invitation/profile setup; business pages require completed admission. Password and remember-me fields have been removed. Each write obtains the current CSRF token from the backend before sending its request. Logout ends the site session only, and a failed logout remains retryable.

See the backend's `docs/keycloak-setup.md` for client configuration, administrator initialization and legacy-account binding. Tests use mocked requests to cover routing, admission, CSRF and logout; the backend separately tests the OIDC protocol against a local signed-token provider.
