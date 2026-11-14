# BASELINE — contrato del refactor de `App.jsx`

Capturado el 2026-09-03, antes de tocar `src/`. Actualizado el 2026-11-13 con
el rediseño D (rama `rediseno-d`): mismas seis puertas, números de abajo.

Cada paso del refactor debe reproducir **estos mismos números**, no simplemente
"no petar". Si un paso no pasa las cinco puertas, se revierte ese paso entero.

## Las seis puertas

| # | Comando | Baseline |
|---|---|---|
| 1 · Lógica | `npm test` | 155/155 + 85/85 = **240** (158 al cerrar la Tarea 1; +16 en 1.2; +10 en 1.3; +6 en 1.4; +6 en 1.5; +7 en 2.2; +3 en 2.4; +15 en la decisión 1; +15 en la decisión 2; +1 en el rediseño D: S4 a dos tramos) |
| 2a · Interfaz | `npm run test:ui` | **289/289** · 0 errores de página (227 antes del rediseño D; la suite se reescribió para la navegación nueva conservando cada comprobación, +43 nuevas) |
| 2b · Auditoría | `npm run audit` | **23/23** · 0 errores de página (recorre también Progreso, Rutinas, el editor y Ajustes) |
| 3 · Lint | `npx oxlint` | **0 avisos / 0 errores** |
| 4 · Build | `npm run build` | compila · 393 kB (gzip 117) + Geist 29 kB |
| 5 · Snapshot | `npm run test:snapshot` | **2/2** · contrato de localStorage intacto |
| 6 · Renders | `npm run test:renders` | **App = 0** al marcar la 2ª serie (y DiaView/PanelDia = 0) |

### La puerta 6, añadida en el paso 7

Cuenta los renders de cuatro componentes al marcar una serie en la sesión.
Es la medida de si la separación de contextos hizo su trabajo: el progreso
cambia en cada toque, y lo que no depende de él no debería enterarse.

Se miden dos series. La primera fija el día (`fijados` cambia, el calendario se
regenera) y es legítimo que el enrutador se entere. La segunda solo cambia el
progreso: es la medida limpia.

```
                     antes del 7    tras el 7
                     1ª    2ª       1ª    2ª
  App                 3     3        1     0   ← el objetivo
  SessionView         2     1        2     1   ← es la pantalla activa
  CalendarView        0     0        0     0   ← nunca está montado a la vez
  PanelDia            2     1        2     1   ← ver abajo
```

`App` pasa de 3 a **0** en la segunda serie: el progreso ya no llega al
enrutador. El 1 de la primera es correcto: `diaActivo` es otro objeto y App
tiene que mirar si sigue habiendo día activo.

`PanelDia` no baja. No depende del progreso, pero re-renderiza por arrastre
de su padre `SessionView`, que sí. Eso **no lo arreglan los contextos**: lo
arregla `React.memo` en los hijos que solo leen `ContextoAcciones` (estable)
y datos por props. Es trabajo de la Tarea 4, y la puerta 6 ya lo mide.

Instrumentación: `contarRender(nombre)` en `src/utiles/medir.js`, una línea al
principio de cada componente medido. Solo cuenta si el test creó
`window.__renders` antes de cargar; en uso normal es un `if` que falla.

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

Las puertas 2a, 2b, 5 y 6 necesitan la app construida y servida:

```bash
npm run build
npx vite preview --port 4173
```

Y en otra terminal:

```bash
npm run test:ui && npm run audit && npm run test:snapshot && npm run test:renders
```

## Resultado de la Tarea 1

`App.jsx`: **2723 → 78 líneas**. De 69 hooks a 11 (cinco flags de pantalla,
cuatro envoltorios de cierre y dos lecturas de contexto). Ya no tiene estado de
dominio ni pasa datos: es un enrutador que lee `view` y `diaActivo`, guarda
cinco flags de pantalla y decide qué componente se muestra.

```
src/
├── App.jsx               78   el enrutador
├── main.jsx                   <PlanProvider><App/></PlanProvider>
├── estado/
│   ├── PlanProvider.jsx 200   compone los seis hooks y publica los contextos
│   ├── contextos.js      21   ContextoPlan · ContextoProgreso · ContextoAcciones
│   ├── persistencia.js  132   estadoGuardado (singleton) · guardar · exportar · importar
│   ├── usePlan.js       170   ancla · fijados · festivos · extras · css · calendario
│   ├── useProgreso.js   137   progress · prMap · PRs · mutaciones
│   ├── useNavegacion.js  35   view · activeFecha · activeSesion · mes
│   ├── useTemporizador.js 37  restTimer
│   └── useRutinas.js     21   rutina versionada
├── utiles/                    constantes-ui · formato · sonido · medir
└── componentes/
    ├── comunes/          ui (Punto · ChipTurno · Detalle · BotonCTA · Segmentado · Hoja) · BarraInferior
    │                     IconFor · NumInput · BotonSiNo · RestTimer · FichaEjercicio · Musculos
    ├── ajustes/          AjustesView (exportar · importar)
    ├── biblioteca/       Biblioteca (pestaña Rutinas) · FichaSesion · EditorRutina
    ├── calendario/       CalendarView · BarraCalendario · EditModal · MenuSesiones
    ├── estadisticas/     ProgresoView · VolumenMuscular
    └── sesion/           DiaView (pestaña Hoy) · SessionView · ExerciseCard · HojaSerie
                          SelectorVariante · PanelDia · PanelCSS · PanelFlexible
```

El componente más grande es `SessionView` (279 líneas). Solo pasan de 300
`data.js` (598) y `generador.js` (563), que no eran parte del refactor.

Los tres contextos están separados por **frecuencia de cambio**, no por tema:
`ContextoPlan` cambia poco, `ContextoProgreso` en cada toque, y
`ContextoAcciones` nunca (todos los callbacks son estables). Cada componente
lee solo lo que necesita, y las props que quedan son datos locales del padre
(`dia`, `ex`, `stats`) o flags de pantalla que viven en App.

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

## Tarea 2 · lo hecho

Doce puntos en tres bloques, un commit cada uno (`4a02914..0c79e60`), más las
dos decisiones que quedaron abiertas al cerrar el bloque 1. Los números del
plan salen de `npm run audit:plan`; al cerrar la tarea entera:

```
  gym 3.00 · natación 2.00 · running 0.90 (era 0.71) · bici 0.10 · CARDIO 1.00
  semanas sin cardio 0/78 (eran 23 sin correr) · dobles 50
  solapes fijado→siguiente 0 (eran 14) · los 24 anterior→fijado, avisados
```

Tres de los puntos (1.4, 1.5 y la mitad de 1.2) describían el estado anterior
a la v7; el código ya los tenía. Lo que se hizo en cada caso fue verificar y
arreglar lo que quedaba detrás. Y aparecieron cosas que ningún punto pedía:
38 ejercicios sin temporizador por un `includes('0s')`, sesiones fantasma al
usar la carga sugerida sin entrenar, y un agujero de S3 en el flexible.

### Decisión 1 · el cardio al 1.00 — IMPLEMENTADA

El criterio es del usuario: *"lo importante es hacer cardio de forma regular;
la distinción entre correr y pedalear me importa menos que no saltármelo"*. Así
que el cupo de 1 pasó a ser de **cardio** (`CARDIO_CUPO = ['running',
'ciclismo']`), no de running: una bici cubre la semana y no se busca otro hueco.
Dos cambios, los dos con la bici como salida suave:

- **D3 ya no prohíbe doblar en descarga: prohíbe doblar FUERTE.**
  `DOBLES.descarga.doblesSuaves = ['natacion', 'ciclismo']`. En esas semanas
  (5 huecos para 6 sesiones) el orden es: que una natación ceda su día al
  running → si no, bici doblada sobre un gym de torso → si no, al flexible.
  Running doblado en descarga nunca; gym extra, tampoco.
- **El flexible pone BICI por defecto cuando el cardio no cupo** (antes solo lo
  proponía y por defecto era descanso). `CARDIO_POR_DEFECTO_FLEXIBLE`. Bici y
  no running porque ese día cae en turno C: 12h de pie, y la bici da el mismo
  Z2 sin castigar pies ni tibias. El panel ya no pregunta nada ahí: explica y
  ofrece **Correr en su lugar** o **Hoy descanso**. Si el flexible viene de
  pierna (S3) o de dos gym seguidos, no se pone nada: se sigue proponiendo.

Resultado: running 0.90, bici 0.10, **cardio 1.00/sem y 0 semanas sin cardio**.
8 de los 78 flexibles pasan a bici por defecto.

### Decisión 2 · los 24 solapes `anterior → fijado` — IMPLEMENTADA

No se arreglan: se **avisan**. Arreglarlos exigiría reescribir el día anterior,
que el usuario no editó, y eso no se hace. `avisoAlFijar(calendario, fecha,
sesion)` es una función **pura** en `generador.js` que mira el calendario que ya
se está viendo y devuelve los avisos. Cubre dos cosas:

- **solape de patrón** con el gym anterior (`GYM_SOLAPAN`), haya o no días en
  medio: lo que castiga la zona son dos *sesiones* seguidas, no dos días.
- **S7** hacia atrás (pierna fijada 1 día tras otra pierna: eran 4 en el
  barrido) y hacia delante solo contra días ya fijados, que el generador no
  moverá.

Se pinta en los dos sitios donde se fija a mano: `SelectorVariante` marca las
opciones problemáticas antes de tocarlas y pide confirmar (**Mejor no** /
**Fijar igual**), y `EditModal` lo muestra con la sesión elegida, sin bloquear
Guardar. El aviso informa; la decisión sigue siendo del usuario. Verificado
contra el barrido de 60 combinaciones: los 24 solapes y las 4 violaciones de S7
quedan avisados, con cero falsos positivos.

## Pendientes detectados durante la Tarea 1 (para la Tarea 2)

Cosas que aparecieron al refactorizar y que NO se tocan aquí, porque la Tarea 1
es movimiento puro de código.

### ~~`VolumenMuscular` deja el calendario en blanco con un ejercicio malformado~~ — RESUELTO (Tarea 2 · 1.1)

`ex.musculos.primario.forEach(...)` reventaba si un ejercicio de una rutina
importada no traía `musculos.primario` como array. `musculos` es metadata de
la v6: un respaldo anterior, o editado a mano, no lo tiene o lo tiene con otra
forma. El resultado era el calendario en blanco sin ningún aviso, en cuanto la
semana visible contenía esa sesión.

**Arreglo:** `Array.isArray(ex.musculos.primario) ? ... : []` para primario y
secundario. Más estricto que el `?? []` de `validador.js`: cubre también
`primario: 'pecho'` (string) o `primario: 1`, que harían reventar el
`.forEach` igualmente.

**Test:** sección "RESPALDO CON EJERCICIOS MALFORMADOS" en `test-ui.mjs`.
Siembra tres ejercicios en gymA —uno bien formado, uno con `{ pectoral: 1 }`
(la forma que causó el fallo real) y uno con `primario: 'pecho'`— y comprueba
que el calendario pinta, que el panel de volumen sobrevive al pasar a la
semana del gym, que el bien formado cuenta (Pecho 2 / 11) y que no hay errores
de página. Verificado en las dos direcciones: contra el código sin arreglo
fallan 4 de las 5 aserciones con el error original.

**Revisión del resto de `src/`:** era el único acceso de dos niveles sin guarda
sobre datos importados. `validador.js` normaliza en `cargaDe()`, `reglas.js`
usa `p?.logs || []` y filtra `l && l.reps != null`, y los componentes leen
campos de ejercicio a un nivel (`ex.bs`, `ex.rir`), donde `undefined` es
inocuo.

### ~~La suite de UI depende de la fecha real~~ — RESUELTO (Tarea 2, bloque 0)

**El problema que había:** la app siempre aterriza en la sesión de HOY y pinta
el calendario del mes de HOY una vez, antes de que `nuevaPagina` navegue al
mes de prueba. Cualquier semilla con alcance atemporal tocaba ese primer render
y la suite cambiaba de resultado según la semana real. Las dos semillas
malformadas fueron el síntoma; esto era la causa.

**La solución:** `hoyISO()` (`src/utiles/formato.js`) lee una vez al cargar la
clave `plan-internado-hoy` de localStorage; si existe, esa es la fecha de hoy.
Las tres suites de UI (`test-ui.mjs`, `test-renders.mjs`, `audit.mjs`) la
siembran con `2026-08-01` —el día del ancla— antes de cargar la app. Ningún
`new Date()` queda en ellas.

Para un usuario real es inerte: nadie tiene esa clave salvo que la ponga a
mano. `test-snapshot.mjs` no la siembra a propósito: el snapshot no depende de
la fecha y su huella de referencia no debe moverse.

El test "semana actual" se reescribió: hoy fijado en agosto, sale a septiembre
(no hay etiqueta) y vuelve (el panel se recoloca en la semana de hoy y la
enseña). La auditoría comprueba ahora "Agosto 2027" tras 12 meses, no
"<mes real> 2027".

**También corregido antes:** `nuevaPagina` verifica que se llegó al calendario y
falla ahí con el error de página en el mensaje. Antes, un `.catch(() => {})` se
tragaba el fallo y aparecía 30 s después como un timeout sin relación.

## Correcciones a las cifras del ARRANQUE

- La suite de interfaz son **142** pruebas, no 111. Ha crecido desde que se
  escribió el documento.
- `App.jsx` son **2723** líneas (2544 con contenido), no 2723 repartidas en 21
  componentes: son **20**, contando `App`.
- La auditoría sí son 21.

Entorno: Node v24.20.0 · npm 11.19.0 · 409 paquetes.
