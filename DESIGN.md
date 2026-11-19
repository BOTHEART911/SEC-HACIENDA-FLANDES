# DESIGN.md · SEC-HACIENDA-FLANDES

Sistema visual de la app de la Secretaría de Hacienda de Flandes.
Es hermana del ecosistema Flandes Core: hereda su DESIGN.md
(`BOTHEART911/KIT-FLANDES/DESIGN.md`) y este documento solo dice lo propio
de Hacienda. Lo lee quien diseñe o toque una pantalla, antes de escribir CSS.

Fuente de verdad de los valores: `kit/base.css` (copia del kit Flandes
dentro de este repo) y los alias de `css/hacienda.css`. Si algo aquí no
coincide con esos archivos, mandan ellos y se corrige este documento.

Escrito el 18/11/2026 a partir de las variables reales y de la app
publicada (versión 2026.11.18.1). Aprobado por Oscar el 18/11/2026 junto con
la maqueta del nuevo inicio (publicado en 2026.11.18.2).

## 1. Carácter

Una mesa de trabajo de cobro y fiscalización: cada día hay vencimientos,
bitácoras y contribuyentes esperando. El inicio responde primero **qué vence
y qué espera respuesta**, y después da los caminos. Mismo verde, papel blanco
y letra del ecosistema Flandes; el escudo «SEC. HACIENDA APP · DIGITAL» es la
única imagen de marca.

## 2. Color

Las vistas usan siempre las variables `--k-*`. Los alias viejos de
`css/hacienda.css` (`--primary`, `--text-muted`, `--card-bg`…) apuntan a
ellas y solo existen para no romper `styles.css`; el código nuevo no los usa.

| Uso | Variable | Claro | Oscuro |
|---|---|---|---|
| Marca | `--k-marca` | `#06402B` | `#2f9c6e` |
| Marca oscura (banner, degradado del login) | `--k-marca-2` | `#04281C` | `#14201b` |
| Marca clara | `--k-marca-clara` | `#0a6644` | `#44c48c` |
| Fondo | `--k-fondo` | `#eef2f0` | `#0d1512` |
| Papel | `--k-papel` / `--k-papel-2` | `#ffffff` / `#f6f8f7` | `#14201b` / `#1b2a23` |
| Texto | `--k-tinta` | `#0f1f16` | `#e8f0eb` |
| Texto secundario | `--k-tinta-2` | `#3d5248` | `#b9ccc2` |
| Texto apagado | `--k-apagado` | `#6b7c74` → **`#4b5c54`** | `#8ba298` |
| Línea | `--k-linea` | `rgba(6,64,43,.14)` | `rgba(255,255,255,.12)` |
| Bien | `--k-ok` / fondo | `#16a34a` → **`#15803d`** / `#dcfce7` | — / `#10331f` |
| Atención | `--k-aviso` / fondo | `#b45309` / `#ffedd5` | — / `#332414` |
| Error | `--k-malo` / fondo | `#dc2626` / `#fee2e2` | — / `#3a1a1a` |

En **negrita**: valores que el kit Flandes corrigió el 18/11/2026 por
contraste; desde la 2026.11.18.2 este repo ya los tiene (se copiaron de
KIT-FLANDES `base.css` y los CSS del kit sin nada propio de Hacienda), junto
con las sombras neutras (`rgba(15,23,20,…)`, sin resplandor verde).
`kit/visor.css` y `kit/soporte.css` NO se copian: Hacienda tiene funciones
propias en el visor y otra versión del soporte.

### Colores del semáforo (propios de Hacienda)

El semáforo de asignaciones y la clasificación de BD Predial tienen colores
con significado. Se conservan, pero se muestran como **pastilla o fondo
suave con texto**, nunca como franja lateral ni degradado:

| Estado | Texto | Fondo suave |
|---|---|---|
| A tiempo (verde) | `#15803d` | `#dcfce7` |
| Por vencer (amarillo) | `#92400e` | `#fef3c7` |
| Urgente (naranja) | `#9a3412` | `#ffedd5` |
| Vencido (rojo) | `#b91c1c` | `#fee2e2` |
| Ejecutado por finalizar (morado) | `#6b21a8` | `#f3e8ff` |
| Sin fecha / cerrado (gris) | `#475569` | `#f1f5f9` |

Siempre con la palabra («Vencida», «Faltan 8 días»), no solo el color.

## 3. Tipografía

Igual que Flandes: títulos **Sora** 600, cuerpo **IBM Plex Sans**
400/500/600, ya cargadas en `index.html`. Títulos de sección en frase normal
(«Industria y comercio», no «INDUSTRIA Y COMERCIO»). Las mayúsculas quedan
para etiquetas cortas (`MI SEMÁFORO`, `PSH00366`).

## 4. Forma, espacio y profundidad

Radios 10 / 14 / 20 y pastillas 999. Tarjetas en papel con borde de 1 px
`--k-linea` y `--k-sombra-1` como mucho. Espaciado en múltiplos de 4;
16 px de margen lateral en celular.

## 5. Íconos

`kit/iconos.js` más `js/iconos-hacienda.js` (los de Hacienda: predial,
semáforo, ICA, masivo…). Uno distinto por acción y con sentido; nunca
emoji. Si falta uno, se le pide a Oscar.

## 6. Movimiento

Igual que Flandes (150–250 ms, `cubic-bezier(.2,.8,.2,1)`, solo
`transform` y `opacity`, `prefers-reduced-motion`). El cielo del kit
(`K.piezas.cielo.poner(el, { burbujas: 4 })`: la aurora que respira y las
burbujas que suben, el mismo efecto de la portada) va **solo** en la tarjeta
grande del inicio. Nada de globos con cuerda ni adornos de fiesta: Oscar los
rechazó en la maqueta del 18/11.
El punto que late del chat EN VIVO y el de «esperando» en la línea de tiempo
de una asignación son legítimos (estado en vivo).

## 7. Patrón de inicio de Hacienda

1. Saludo, rol y fecha en una línea.
2. Tarjeta grande en marca con el cielo y **la tarea del rol**:
   - ADMIN y DEV: Mi semáforo de toda la Secretaría (vencidas, vencen hoy,
     en 7 días, y la barra por estado).
   - ABOGADO y ASISTENTE: sus asignaciones, la próxima que vence.
   - ATENCIÓN: Pendientes predial (solicitudes por chat esperando).
   - ARCHIVO: bitácoras por responder en BD Predial.
3. Lo reciente más útil: la próxima asignación que vence.
4. Cuatro accesos rápidos (2×2 en celular, 4×1 en PC), cada uno con su
   ícono y su conteo si lo tiene; si solo hay 2 o 3 disponibles, van 2.
   Lo que ya es la tarjeta grande no se repite como acceso.
5. «Piden tu acción»: bitácoras en rojo, requerimientos ICA vencidos,
   asesorías sin disponibilidad. Fondo suave + texto, sin franja.
6. Listas compactas por sección: Predial, Industria y comercio, Gestión,
   Correos masivos, La app. Lo que viene «próximamente» va en una línea de
   texto, no como botones que no hacen nada.

En PC: dos columnas (tarea, accesos y listas de trabajo a la izquierda;
reciente, avisos y «La app» a la derecha), hasta 1200 px.

**Datos del inicio:** un solo viaje (`js/inicio.js` + backend
`Inicio1118.gs`, bandera `ini=1`). Los conteos de la tarjeta grande y de
los avisos llegan en la misma respuesta de entrada (bandera opcional para
que front y backend se suban en cualquier orden); la tarjeta se pinta al
instante con lo último que se supo y se completa en silencio.

## 8. Prohibido

Lo mismo que en Flandes (franjas laterales, texto con degradado, rebotes,
resplandores, ícono repetido, pastillas que no hacen nada). En Hacienda hay
deudas conocidas en `styles.css` (código heredado de la app vieja) y en
`css/hacienda.css`: franjas de color en `.proc-card` y `.bdp-card`,
degradados en `.semaforo-*`. Se limpian cuando se toque cada vista; no se
agrega nada nuevo con esos patrones.

## 9. Antes de publicar

Detector de Impeccable en cero para lo prohibido, captura en 390 y 1280 px
en claro y oscuro, tiempos dentro del presupuesto y `version.js` arriba.
