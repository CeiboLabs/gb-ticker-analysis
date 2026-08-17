# Endurecer el acceso al panel — pendiente

Escrito el 2026-08-17 a partir de la pregunta «¿el panel queda en `/admin`? ¿eso
es seguro?». **No implementado.** Acá está la respuesta investigada, la decisión
y los pasos, para hacerlo sin volver a discutirlo.

## La decisión, en una línea

**`/admin` se queda donde está. Lo que falta es una puerta de RED adelante, no un
path más difícil de adivinar.**

## Por qué no renombrar el path

OWASP lo trata directamente: el path se descubre por fuerza bruta de contenidos,
por *Google dorks*, por inspección del JS que sirve la app y por *path
disclosure*. Su remediación **no menciona ofuscar la URL** — pide filtrado por IP
u otros controles de infraestructura, autenticación y separación de roles.
PortSwigger llama anti-patrón a tratar la ocultación como control de acceso.

Existe la práctica contraria y conviene entender por qué, para no descartarla por
ignorancia: **Magento genera una URL de admin aleatoria en la instalación** y la
comunidad de Django recomienda mover `/admin/`. Eso responde a otro problema —el
escaneo masivo automatizado contra *plataformas conocidas*, donde el bot prueba
`/wp-admin`, `/administrator`, `/admin` en millones de hosts y encadena con CVEs
del producto—. Reduce ruido de log y explotación oportunista de un stack con
firma pública.

**Este panel no es eso**: app a medida, sin firma de producto, sin CVEs propios,
y el login no filtra nada (401 idéntico + verificación contra hash señuelo). Si
alguna vez se renombra el path, que quede anotado como **higiene de logs, no como
control** — o en seis meses alguien va a creer que el panel está protegido porque
vive en `/gestion-x7k`.

## Lo que ya está bien (verificado en el código, 2026-08-17)

No hace falta tocarlo, y es lo que hace que el path importe poco:

- **TOTP obligatorio** para todos, con anti-replay del timestep
- PBKDF2 + **pepper** (un dump de la base solo no crackea nada)
- **Lockout por cuenta**: 10 fallas/hora (`panelfailu`)
- Sesión absoluta 12 h + idle 2 h, cookie `__Host-`
- Sin enumeración de usuarios · origin-check en todo método mutante ·
  auditoría append-only de toda mutación y todo login · `noindex`

## El agujero real, y no es el que uno mira primero

`lib/rateLimiter.ts` → `trustedClientIp()`:

```ts
const cf = req.headers.get("cf-connecting-ip");
if (cf) return cf;
if (process.env.TRUSTED_PROXY === "1") { /* X-Real-IP / X-Forwarded-For */ }
return null;
```

**Al sacar Cloudflare, esto devuelve `null`.** Sin IP resoluble, el lockout por IP
del login (`panelfail`, 30/h) **deja de repartir por IP** y cae a un balde
compartido de 500 intentos/hora para todos. El lockout **por cuenta sigue
funcionando**, que es el que importa contra credential stuffing dirigido, pero la
capa de IP hoy es decorativa.

Corolario que decide dónde va el allowlist: **a nivel de aplicación tendría el
mismo problema**. Va en el reverse proxy, que sí ve la conexión real.

## Los pasos, en orden de valor

1. **Allowlist por IP en el reverse proxy** (Apache/nginx, NO en la app) a la IP
   fija de la oficina. Es lo que hace una casa de bolsa chica: la ganancia más
   grande por el trabajo que cuesta, cero fricción para Adrián, cero cliente que
   instalar. Base: `deploy/home/nginx-bng.conf`.
2. **Resolver `TRUSTED_PROXY`.** Confirmar en el access log que llega la IP
   pública y **no** `127.0.0.1`, y recién entonces prenderlo. Eso reactiva el
   lockout por IP que hoy no funciona. Checklist en `docs/RUNBOOK-home.md`
   § «Reverse proxy».
3. **Vía de emergencia** para entrar desde afuera de la oficina (Tailscale en el
   laptop es lo más barato). Sin salida de escape, alguien va a apagar el
   allowlist "por un rato" y va a quedar así.

Si en algún momento el equipo crece o hay varias oficinas, el reemplazo natural
del allowlist es un **proxy con identidad** (Cloudflare Access, Google IAP,
Pomerium): verifica en cada request en vez de confiar en la ubicación de red. Se
anota como el camino siguiente, no como el de ahora — y ojo que Cloudflare se
sacó a propósito de este proyecto.

## Por qué subió la prioridad

Desde el 17-ago-2026 **el panel publica al sitio público**. Antes, un compromiso
daba acceso a datos internos; ahora deja escribir el valor cuota y las tenencias
de un fondo regulado por el BCU en su propia web. El diagnóstico no cambia —el
path nunca fue la defensa— pero el retorno de poner la puerta de red sí.

## Fuentes

- [OWASP WSTG — Enumerate Infrastructure and Application Admin Interfaces](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces)
- [PortSwigger — Access control vulnerabilities](https://portswigger.net/web-security/access-control)
- [Cobalt — Admin Panel Publicly Accessible](https://www.cobalt.io/vulnerability-wiki/v4-access-control/admin-panel-public)
- [Foregenix — The potential risks of exposed admin login panels](https://www.foregenix.com/blog/the-potential-risks-of-exposed-admin-login-panels)
- [Liquid Web — Change the Magento 2 admin login URL](https://www.liquidweb.com/magento/security/change-admin-login-url/)
- [LearnDjango — Django best practices: security](https://learndjango.com/tutorials/django-best-practices-security)
- [Pomerium — Identity-Aware Proxy](https://www.pomerium.com/blog/identity-aware-proxy)
