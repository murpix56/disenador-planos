# Diseñador de planos

Herramienta **personal** (de un subinspector de la Policía Local de Don Benito) para preparar planos de itinerarios y cortes de calle que se publican en redes sociales (Facebook). Aplicación web **estática** sin build, en GitHub Pages: https://murpix56.github.io/disenador-planos/ . Es independiente de `cortes-don-benito` (aplicación de gestión de cortes); no mezclar los dos proyectos. El módulo `js/net.js` nació como copia del de esa aplicación, pero ahora evolucionan por separado.

## Cómo trabajar con el usuario
- Responder **en español**, tono cercano y claro. Describe el diseño a ojo y pide ajustes finos: **mirar siempre una captura real** (y la imagen exportada) antes de darla por buena.
- Quiere lo más práctico y rápido posible: que un plano salga con pocos clics. Valora que se le propongan funciones que ahorren tiempo.
- Referencia visual: sus carteles reales: fondo **gris claro (#e6e6e6)** y calles **blancas** sin más detalle; itinerario en **verde** con **flechas azules** de sentido; cortes en **rojo** con señales de dirección prohibida en los extremos; nombres de calle en **azul (#1d5fb5), negrita, mayúsculas y borde blanco**; cuadros de texto blancos con borde azul y flecha («ZONA DE SALIDA Y LLEGADA»); leyenda en caja blanca con borde rojo («Itinerario», «Sentido de la marcha»).

## Qué hace (estado actual)
- Fondos: **Gris y blanco** (calles dibujadas con el callejero OSM, anchura según tipo de vía; colores configurables), **Calles** (OSM) y **Satélite** (PNOA/IGN).
- **Trazo que sigue las calles**: puntos de inicio, final e intermedios → ruta por el grafo (Dijkstra). «Libre» y «Levantar el lápiz» (varios tramos). Se quitan rebotes si se marca pasado el cruce.
- **Estilos rápidos** al dibujar: Itinerario (verde, flechas, punto de salida y meta), Corte (rojo, señal de dirección prohibida en los dos extremos), Desvío (discontinuo, flechas). Cambiables luego.
- Personalización del trazo: color (paleta + libre), grosor, borde blanco, discontinuo, flechas (color, tamaño, separación; **esquivan los nombres**).
- **Nombres de calle**: se generan solos, uno por calle del recorrido (abreviados «C/», «Avda.»); texto, tamaño, color, borde, negrita, mayúsculas, giro; se **arrastran**. Botón «Estilo cartel».
- **Señales** (dibujadas con canvas, `dibujarSenal` en `js/render.js`): dirección prohibida, obras, peligro, prohibido estacionar, salida/llegada, meta; arrastrables, con tamaño y texto debajo. **Cuadros de texto** con flecha. **Leyenda automática** (se coloca en una esquina del marco de exportación).
- **Leyenda**: posición en desplegable y filas configurables (`leyenda.ocultos`; por defecto oculta salida y meta). Abreviaturas: C/, Avda., Ctra., Pza., Pº, Trv., Cno., Cjón., Gta.
- **Exportar** PNG (1080×1080, 1080×1350, 1200×630, 2160×2160) de la zona dentro de un **marco** sobre el mapa; «Encuadrar el plano»; «Copiar imagen». **Solo con el fondo gris** (con teselas se usa captura de pantalla).
- Señales con giro (`marca.rot`, deslizador y botones de 90°).
- **Mis planos**: lista de planos guardados en el navegador (`plano.biblioteca.v1`, con la vista del mapa); un plano guardado se actualiza solo. Más archivo `.json`.
- Interfaz: pestañas con icono, tarjetas, interruptores y desplegables con el mismo estilo.
- Deshacer/rehacer (historial de 60 pasos), guardado automático en el navegador y archivo `.json` (guardar/abrir).

## Arquitectura
`index.html`, `style.css`, `boot.js`, `js/{app,render,net,util}.js` (módulos ES), `vendor/leaflet`, `pruebas/`.
- `js/render.js`: **un único motor de dibujo en canvas** (`dibujar`) que pinta la pantalla (capa superpuesta al mapa, mismo tamaño que el contenedor) y la imagen exportada (`imagen`) con la misma función → lo que se ve es lo que se descarga. Trabaja en coordenadas Mercator normalizadas (`merc`), con una «vista» (`crearVista`: centro, tamaño del mundo en px, escala k).
- `js/net.js`: descarga del callejero (Overpass, 2 servidores; caché en localStorage `plano.callejero.v1`), grafo, `snap`, `route` (devuelve `path` y `tramos` por calle) y `rl` (líneas Mercator precalculadas para dibujar rápido).
- `js/app.js`: estado `S`, proyecto `S.p` (`{nombre, base, gris, trazos[], marcas[], notas[], leyenda}`; localStorage `plano.proyecto.v1`), paneles (pestañas Plano/Trazos/Nombres/Señales/Exportar), interacción (clic, arrastre con pointer events; el arrastre desactiva `map.dragging`), historial.
- Leaflet con `zoomAnimation:false` y `zoomSnap:0.25` para que el lienzo vaya sincronizado y se pueda encuadrar con precisión.

## Reglas importantes (trampas conocidas)
1. **Versión de archivos:** todos los `?v=` de los imports, `index.html` y hoja de estilos deben llevar el **mismo** número; cámbialo en todos a la vez en cada publicación (`sed -i 's/ANTIGUA/NUEVA/g'` sobre `js/*.js index.html style.css`). Si no, la caché de GitHub puede mezclar versiones y la página queda en blanco. `boot.js` muestra un aviso de recuperación si no arranca. Versión actual: ver `index.html`.
2. Nombres de repositorio de GitHub sin «ñ». Para subir hace falta que la app de Claude tenga acceso al repositorio (si da 403: https://github.com/apps/claude/installations/select_target).
3. Atribución de OpenStreetMap siempre visible (licencia). Los PNG exportados no la incluyen: avisar si se publica sin ella no es un problema de la herramienta, pero conviene recordarlo al usuario si pregunta por licencias.
4. Probar en escritorio y en ancho móvil. La imagen exportada se comprueba abriéndola (Read sobre el PNG).
5. Publicar = commit + `git push origin main`, sin PR salvo que lo pida.

## Pruebas
`pruebas/LEEME.md`: `node pruebas/plano.js` y `node pruebas/plano2.js` (Playwright, callejero simulado). Terminan con `ERRORES: []`.

## Pendiente / ideas (no pedidas aún)
- Exportar también con satélite / plano de calles (teselas con CORS; hay que dibujarlas en el canvas de exportación).
- Más señales o rotarlas; seleccionar varios elementos; alinear.
- Plantilla de cartel completo (cabecera, caja de información, pie) o marco con escudo.
- Editar vértices de un trazo; flechas en un solo punto; sentido contrario.
- Probar con el callejero **real** de Don Benito (hasta ahora solo con rejilla de pruebas): ajustar grosores de calle, tono de gris y tamaños por defecto.
