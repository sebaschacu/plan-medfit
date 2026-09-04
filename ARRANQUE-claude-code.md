# ARRANQUE — Claude Code · Proyecto "Plan Internado"

> **Cómo usar:** abre Claude Code sobre la carpeta del proyecto y pega este documento como primer mensaje.

---

## 0. QUÉ ES ESTO

App PWA de planificación de entrenamiento para alguien con **turnos rotativos de 12h**. Genera el calendario automáticamente a partir del ciclo de turnos, gestiona 5 rutinas de gimnasio, 7 de natación, cardio y calistenia, y registra el progreso con progresión lineal.

**Stack:** Vite + React + Tailwind + PWA · Deploy en GitHub + Vercel

---

## 1. ANTES DE TOCAR NADA

```bash
npm i
npm test              # 92 lógica + 66 validador = 158, deben ir en verde
npm run test:ui       # 111 de interfaz (requiere: npm i -D playwright)
node audit.mjs        # 21 de auditoría
npx oxlint            # debe dar 0 avisos
```

> **Los 158 tests son la red de seguridad de todo lo que sigue.** No avances si alguno está en rojo.

---

## 2. MAPA DEL CÓDIGO

```
src/
├── App.jsx         2.723 líneas  ← TODO el UI. 21 componentes, 69 hooks
├── data.js           598 líneas  ← sesiones, ejercicios, constantes del plan
├── generador.js      563 líneas  ← el motor: genera el calendario desde los turnos
├── validador.js                  ← verifica que una rutina editada cumpla las reglas
├── rutina.js                     ← rutinas versionadas (protege el historial)
└── reglas.js                     ← P6 (reset), S4 (sueño), sugerencia de carga
```

### Conceptos clave del dominio

| Concepto | Qué es |
|---|---|
| **Ciclo de turno** | `L → C → N → P` cada 4 días. L=libre, C=turno día 12h, N=noche, P=posturno |
| **Cupo semanal** | 3 gym · 2 natación · 1 running · 1 día flexible |
| **Secuencia de gym** | `A → C1 → D → C2 → B`, contador persistente que nunca se reinicia |
| **Rotación de natación** | `A1 → B1 → A2 → B2 → A3 → B3`, con test de CSS cada 6-8 semanas |
| **Tipo vs variante** | `sesion: 'natacion'` es el tipo; `variante: 'natA1'` la concreta |
| **Día flexible** | Anclado a turno C. Descanso por defecto, running si se cumplen 3 condiciones |
| **Sesiones dobles** | Dos sesiones el mismo día, con reglas de qué combina con qué |
| **`POLITICA_FIJADO`** | Al fijar una sesión a mano, el contador de cola **no avanza** |

### Reglas del plan (están en `data.js`)

`S1` máx 4 gym seguidos · `S3` running nunca tras pierna · `S4` posturno según sueño · `S5` día N solo mañana/mediodía · `S6` natación sí junto a pierna · `S7` pierna separada 2-3 días · `E1-E9` ejecución · `P1-P6` progresión · `R1-R2` recortes · `L1/L4` seguridad

---

## 3. TAREAS, EN ORDEN

### 🥇 TAREA 1 — Partir `App.jsx`

**Por qué primero:** todas las demás tareas tocan este archivo. Hacerlas sobre 2.723 líneas es más lento y más arriesgado.

**Qué hacer:**
- Separar en componentes por responsabilidad: `Calendario`, `DetalleDia`, `DetalleSesion`, `Estadisticas`, `Biblioteca`, `ModalEdicion`, `GraficaProgresion`, `PantallaHoy`
- Extraer los hooks de estado compartido a un contexto o a hooks propios
- **Los 158 tests deben seguir en verde en cada paso.** Refactor incremental, no de golpe

**Criterio de éxito:** ningún archivo por encima de ~400 líneas, tests en verde, lint en 0.

---

### 🥈 TAREA 2 — Los cuatro arreglos pendientes

#### 2.1 Guardarraíl de solapes tras fijar un gym

**El problema, medido:** sin días fijados hay 0 solapes en 155 transiciones. Con un solo día fijado aparecen hasta 2:

```
fijar gymD el 04-ago   →   gymD → gymA      (banca dos veces)
fijar gymA el 07-ago   →   gymA → gymA      (empuje dos veces)
fijar gymC2 el 07-ago  →   gymC2 → gymC1    (pierna con 2 días — viola S7)
fijar gymA el 08-ago   →   gymA → gymD      (banca dos veces)
fijar gymB el 08-ago   →   gymB → gymD      (dominada dos veces)
```

**Qué implementar:** tras un gym fijado a mano, si la siguiente de la cola solapa con la que se acaba de hacer, avanzar a la siguiente que no solape y registrar un aviso.

**Pares que solapan:**
```
A-A · B-B · D-D · A-D · B-D · C1-C2 · C1-C1 · C2-C2
```
*(A y B no solapan entre sí: son antagonistas.)*

#### 2.2 El running está en 0.70/semana

| | Valor |
|---|---|
| Running asignado | **0.70/sem** |
| Sugerido en el flexible | +0.29 |
| Mínimo declarado del usuario | **1.00/sem** |

Hay 14 avisos `sin_hueco_doblando` en 18 meses, **todos de running**. La natación nunca se pierde.

**Qué hacer:** analizar por qué bajó (era 0.77 en la versión anterior) y proponer cómo recuperarlo **sin tocar el cupo de gym ni de natación**.

#### 2.3 La bici nunca se asigna

**0.00/semana.** Existe como sesión pero el generador no la propone jamás: las 23 sugerencias del día flexible son todas de running.

La bici es la alternativa para no correr tras 12h de pie (mismo Z2, impacto cero) y cubre el ciclismo para triatlón.

**Qué implementar:** ofrecerla junto al running en el día flexible (23 casos) y en los `sin_hueco_doblando` (14 casos), dejando elegir al usuario.

#### 2.4 Botón "usar sugerido"

La sugerencia de carga es visible pero hay que teclearla. Un botón que la escriba en el campo con un toque, editable después.

---

### 🥉 TAREA 3 — Selector tipo rueda iOS para kg y reps

**Qué se busca:** al registrar peso y repeticiones, un selector de rueda como el de iOS en lugar de un campo de texto.

**Por qué:** girar con el pulgar es mucho más rápido que teclear, y en el gimnasio se usa con una mano, de pie y sudado.

**Implementación sugerida — sin librerías:**
- `scroll-snap-type: y mandatory` en el contenedor
- `scroll-snap-align: center` en cada opción
- Máscara de degradado arriba y abajo para el efecto de profundidad
- Detectar el valor seleccionado con el evento `scroll` y `scrollTop`
- Vibración háptica al cambiar de valor (`navigator.vibrate`) si el dispositivo lo soporta

**Rangos y pasos:**

| Campo | Rango | Paso |
|---|---|---|
| kg | 0-200 | 2.5 (y 1.25 en mancuernas si aplica) |
| reps | 0-50 | 1 |

**Debe respetar:**
- El valor sugerido por la progresión lineal aparece **preseleccionado**
- Debe poder editarse a mano también (no eliminar el input de texto, ofrecer ambos)
- Accesible: el selector debe funcionar con teclado y lector de pantalla

---

### TAREA 4 — Rendimiento

69 hooks (`useState`/`useMemo`/`useEffect`) en un solo componente. Tras partir el archivo (Tarea 1), revisar:

- Memoizar los cálculos caros (estadísticas musculares, volumen semanal)
- Evitar re-renders del calendario completo al marcar una serie
- Verificar que el guardado en `localStorage` no dispare renders en cascada

---

### TAREA 5 — Firebase *(solo si el usuario lo confirma)*

**Objetivo:** sincronización instantánea entre móvil y PC. Ahora `localStorage` es por dispositivo.

**Requisitos si se hace:**
- Firestore con **autenticación obligatoria** (entrar con cuenta de Google)
- **Reglas de seguridad que limiten el acceso al propio usuario.** No es opcional: sin ellas, cualquiera podría leer o borrar los datos
- Debe seguir funcionando sin conexión y sincronizar al volver
- Conservar el exportar/importar JSON existente como respaldo

---

## 4. LO QUE NO SE PUEDE ROMPER

| Elemento | Nota |
|---|---|
| Generador y sus reglas | S1-S7, E1-E9, P1-P6, R1-R2, L1/L4 |
| Rotación de natación | Verificada por tests, incluido el test de CSS |
| `SECUENCIA_GYM` | Contador persistente que no se reinicia |
| Sesiones dobles | Combinaciones válidas y límites D1-D5 |
| Validador | Verifica rutinas editadas |
| Rutinas versionadas | *"El pasado no se reescribe"* |
| Estadísticas musculares | Primario ×1, secundario ×0.5 |
| Protección de días con progreso | Modal de confirmación al cambiar sesión |
| Exportar/importar JSON | |
| Claves internas | `natA1`, `natacion`, `gymC1`… no se renombran o se rompe el localStorage guardado |

---

## 5. CÓMO TRABAJAR

1. **Una tarea cada vez.** No mezclar refactor con funcionalidad nueva
2. **Tests en verde antes de pasar a la siguiente**
3. Si un test existente debe cambiar, **explicar por qué** antes de tocarlo
4. Sin librerías nuevas sin preguntar antes: decir cuál y cuánto pesa
5. Al terminar cada tarea, dar los números de la auditoría: gym/semana, natación/semana, running/semana, bici/semana, dobles y avisos por tipo

---

## 6. ANTES DE EMPEZAR

> Ejecuta las cuatro suites, confirma que están en verde, y **propón cómo vas a abordar la Tarea 1** (partir `App.jsx`) antes de escribir código.
>
> Es un refactor grande sobre un archivo del que depende todo, y prefiero validar el plan antes de que lo ejecutes.

---

*Arranque Claude Code · Plan Internado v7*
