# BASELINE — contrato del refactor de `App.jsx`

Capturado el 2026-09-03, antes de tocar `src/`.

Cada paso del refactor debe reproducir **estos mismos números**, no simplemente
"no petar". Si un paso no pasa las cinco puertas, se revierte ese paso entero.

## Las cinco puertas

| # | Comando | Baseline |
|---|---|---|
| 1 · Lógica | `npm test` | 92/92 + 66/66 = **158** |
| 2a · Interfaz | `npm run test:ui` | **142/142** · 0 errores de página |
| 2b · Auditoría | `npm run audit` | **21/21** · 0 errores de página |
| 3 · Lint | `npx oxlint` | **0 avisos / 0 errores** |
| 4 · Build | `npm run build` | compila · 352 kB (gzip 104) |
| 5 · Snapshot | `npm run test:snapshot` | **2/2** · contrato de localStorage intacto |

### Por qué los 158 no bastan

Ni `test-generador.mjs` ni `test-validador.mjs` importan `App.jsx`. Se puede
borrar el archivo entero y los 158 siguen en verde: son la red de
`generador.js`, no de la interfaz.

La red real de este refactor son las puertas **2a, 2b y 5**.

### Por qué existe la puerta 5

`test-ui.mjs` verifica la migración v2 → v3, pero no que la **forma v3**
sobreviva a un refactor. Si al partir `App.jsx` se renombra una clave interna,
el localStorage de quien ya usa la app se rompe en silencio.

`test-snapshot.mjs` siembra un estado v3 que toca los nueve campos, deja
hidratar la app y compara lo reguardado contra `baseline-snapshot.json`.

Claves de primer nivel que hay que conservar:

```
ancla · css · extras · festivos · fijados · prog · prs · rutina · v
```

Y dentro, las que el ARRANQUE marca como intocables: `natB2`, `gymD`,
`__sueno`, `separacionH`, `complementos`, `gymIdx`.

Verificado en las dos direcciones: pasa con el código intacto, y **falla**
al renombrar `natB2` → `natB3`, señalando la línea exacta.

Para regenerar la huella tras un cambio deliberado y justificado:

```bash
node test-snapshot.mjs --guardar
```

## Cómo levantar la red

Las puertas 2a, 2b y 5 necesitan la app construida y servida:

```bash
npm run build
npx vite preview --port 4173
```

Y en otra terminal:

```bash
npm run test:ui && npm run audit && npm run test:snapshot
```

### Windows: la variable CHROMIUM

Las tres suites lanzan chromium por `executablePath`, con `/opt/pw-browsers/chromium`
por defecto (la ruta del CI en Linux). En Windows hay que apuntar `CHROMIUM` al
**headless shell**:

```
%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe
```

No vale `chrome.exe`: falla con `spawn UNKNOWN` incluso usando la ruta que el
propio Playwright devuelve en `chromium.executablePath()`. El headless shell es
además el binario que Playwright elige por su cuenta cuando no se le pasa
`executablePath`.

Requiere `npx playwright install chromium` una vez.

## Estado del código al capturar el baseline

`src/` **sin tocar**. Fuera de `src/`, tres cambios:

1. `audit.mjs` — `executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'`.
   Comportamiento idéntico en Linux; solo añade la salida en Windows.
2. `test-snapshot.mjs` + `baseline-snapshot.json` — la puerta 5, nueva.
3. `package.json` — el script `test:snapshot`.

## Pendientes detectados durante la Tarea 1 (para la Tarea 2)

Cosas que aparecieron al refactorizar y que NO se tocan aquí, porque la Tarea 1
es movimiento puro de código.

### `VolumenMuscular` deja el calendario en blanco con un ejercicio malformado

`ex.musculos.primario.forEach(...)` en `VolumenMuscular` revienta si un
ejercicio de una rutina editada no trae `musculos.primario`. Un respaldo
editado a mano o de una versión anterior lo provoca, y el resultado es la
pantalla del calendario vacía sin ningún aviso.

`validador.js:239` ya lo hace bien: `(e.musculos?.primario ?? [])`. Aplicar el
mismo patrón a las dos líneas de `VolumenMuscular` (primario y secundario).

Detectado el 2026-09-11 porque dos semillas de `test-ui.mjs` tenían esa forma
incorrecta y la semana actual incluía un gymA. Las semillas se corrigieron; la
robustez de la app, no.

### La suite de UI depende de la fecha real (revisada al cerrar el paso 5)

**El problema de fondo:** la app siempre aterriza en la sesión de HOY y pinta
el calendario del mes de HOY una vez, antes de que `nuevaPagina` navegue al
mes de prueba (agosto 2026). Cualquier semilla con alcance atemporal —una
`rutina` con `desde` en el pasado, `css`, festivos futuros— toca ese primer
render. Las dos semillas malformadas fueron el síntoma; esto es la causa.

La solución de fondo sería un gancho de test para fijar "hoy": que `hoyISO()`
respete una clave como `plan-internado-hoy` en localStorage cuando exista. Es
un cambio en `src/`, fuera de la Tarea 1.

**Síntoma latente:** el test "semana actual" (`test-ui.mjs` ~268-275) afirma
que en agosto NO hay etiqueta y que al volver al mes de hoy SÍ. Da por hecho
que hoy no es agosto de 2026. Si se ejecuta en agosto, `mesesDesdeHoy = 0`, no
navega, y la segunda aserción falla sea cual sea la semana. Hoy es inofensivo
porque el ancla está fija en el pasado; si algún día el ancla se mueve al mes
en curso, este test cae el primer día.

**Ya corregido:** `nuevaPagina` verifica que se llegó al calendario y falla ahí
con el error de página en el mensaje. Antes, un `.catch(() => {})` se tragaba
el fallo y aparecía 30 s después como un timeout sin relación.

## Correcciones a las cifras del ARRANQUE

- La suite de interfaz son **142** pruebas, no 111. Ha crecido desde que se
  escribió el documento.
- `App.jsx` son **2723** líneas (2544 con contenido), no 2723 repartidas en 21
  componentes: son **20**, contando `App`.
- La auditoría sí son 21.

Entorno: Node v24.20.0 · npm 11.19.0 · 409 paquetes.
