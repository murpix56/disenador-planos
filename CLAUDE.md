# Diseñador de planos

Herramienta **personal** (de un subinspector de la Policía Local de Don Benito) para preparar planos de itinerarios y cortes de calle que se publican en redes sociales (Facebook). Aplicación web **estática** sin build, en GitHub Pages: https://murpix56.github.io/disenador-planos/ . Es independiente de `cortes-don-benito` (aplicación de gestión de cortes); no mezclar los dos proyectos. El módulo `js/net.js` nació como copia del de esa aplicación, pero ahora evolucionan por separado.

## Cómo trabajar con el usuario
- Responder **en español**, tono cercano y claro. Describe el diseño a ojo y pide ajustes finos: **mirar siempre una captura real** (y la imagen exportada) antes de darla por buena.
- Quiere lo más práctico y rápido posible: que un plano salga con pocos clics. Valora que se le propongan funciones que ahorren tiempo.
- Referencia visual: sus carteles reales: fondo **gris claro (#e6e6e6)** y calles **blancas** sin más detalle; itinerario en **verde** con **flechas azules** de sentido; cortes en **rojo** con señales de dirección prohibida en los extremos; nombres de calle en **azul (#1d5fb5), negrita, mayúsculas y borde blanco**; cuadros de texto blancos con borde azul y flecha («ZONA DE SALIDA Y LLEGADA»); leyenda en caja blanca con borde rojo («Itinerario», «Sentido de la marcha»).

## Qué hace (estado actual)
- Fondos (desplegable): **Gris y blanco** (calles dibujadas con el callejero OSM, anchura según tipo de vía; colores configurables), **Beige / tonos tierra** (fijo, dibujado en el lienzo con el mismo callejero: fondo crema, «manzanas» en arena sólido = cada espacio cerrado entre calles (`manzanas()` en net.js: caras del grafo, se descartan la exterior y las de más de 12 ha) más un trazo ancho bajo las calles por si algún bloque queda abierto, todas las vías blancas (las principales, más anchas, ya no son amarillas); se exporta a PNG; zonas verdes (parques, jardines, césped, arbolado: `loadVerdes` en net.js, descarga aparte, caché `plano.verdes.v1`, solo `way` cerrados, sin relaciones multipolígono); sin polígonos de edificios ni agua), **Calles** (OSM) y **Satélite** (PNOA/IGN). Grosor de calles y mostrar/ocultar zonas verdes en el Beige (`p.tierra.ancho`, `p.tierra.verdes`). Exportar PNG: gris y beige.
- **Otra localidad**: pestaña Plano → «Otra localidad»: busca el nombre (Nominatim), descarga ~5 km alrededor de su centro (`setZona`/`buscarZona` en net.js; zona recordada en `plano.zona.v1`; las cachés de callejero y zonas verdes llevan el id de zona y solo guardan la última) y centra el mapa. Botón «Volver a Don Benito». Los planos guardados no cambian de zona solos.
- **Trazo que sigue las calles**: puntos de inicio, final e intermedios → ruta por el grafo (Dijkstra). «Libre» y «Levantar el lápiz» (varios tramos). Se quitan rebotes si se marca pasado el cruce.
- **Estilos rápidos** al dibujar: Itinerario (verde, flechas, punto de salida y meta), Corte (rojo, señal de dirección prohibida en los dos extremos), Desvío (discontinuo, flechas). Cambiables luego.
- Personalización del trazo: color (paleta + libre), grosor, borde blanco, discontinuo, flechas (color, tamaño, separación; **esquivan los nombres**).
- **Nombres de calle**: se generan solos, uno por calle del recorrido (abreviados «C/», «Avda.»); texto, tamaño, color, borde, negrita, mayúsculas, giro; se **arrastran**. Botón «Estilo cartel».
- **Señales** (dibujadas con canvas, `dibujarSenal` en `js/render.js`): dirección prohibida, obras, peligro, prohibido estacionar, salida/llegada, meta; arrastrables, con tamaño y texto debajo. **Cuadros de texto** con flecha. **Leyenda automática** (se coloca en una esquina del marco de exportación).
- **Leyenda**: posición en desplegable y filas configurables (`leyenda.ocultos`; por defecto oculta salida y meta). Abreviaturas: C/, Avda., Ctra., Pza., Pº, Trv., Cno., Cjón., Gta.
- **Exportar** PNG (1080×1080, 1080×1350, 1200×630, 2160×2160) de la zona dentro de un **marco** sobre el mapa; «Encuadrar el plano»; «Copiar imagen». **Solo con el fondo gris** (con teselas se usa captura de pantalla).
- Flechas: solo se colocan donde el trazo es casi recto (no en glorietas ni curvas cerradas, a cualquier zoom, `flechas()` en render.js) y se pueden quitar de una **zona** (`flechas.sin`: círculos en metros anclados al mapa). Posición y número dependen del zoom porque separación y tamaño son en píxeles.
- Flechas de **doble sentido** (`flechas.doble`: flecha con dos puntas; la leyenda pone «Doble sentido»).
- **Puntos de referencia** (dibujos, `dibujarRef` en render.js; no salen en la leyenda): iglesia, edificio, fuente, campo de fútbol, arco liso verde (sin texto), arco de salida y de meta, aparcamiento, parque/árbol.
- Pestaña Señales: **desplegable de categoría** (`CATS` en app.js: Señales de tráfico, Puntos de referencia, Cortes de calle) y debajo sus objetos. **Cortes de calle** (`CORTES`, `dibujarCorte` en render.js; no salen en la leyenda): agente de Policía Local, coche patrulla, valla, cono, raya de corte y cinta rojiblanca (la raya y la cinta se orientan y alargan con giro y tamaño).
- Señal de «plaza de movilidad reducida» (silla de ruedas, `minusvalido`). Selector de fondo con cuadrito de muestra.
- Señal de «dirección obligatoria» (flecha blanca en círculo azul; se orienta con el giro).
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

## Visibilidad
Repositorio y página públicos (GitHub Free). La página lleva `noindex, nofollow, noarchive` para que los buscadores no la indexen; no hay datos sensibles (los planos se guardan en el navegador del usuario). Hacerlo privado despublicaría Pages (ver conversación del 2026-11-08).

## Pendiente / ideas (no pedidas aún)
- **Escala general** (un deslizador que escale a la vez nombres, señales, flechas y leyenda): al alejar el plano tras ajustarlo de cerca, los tamaños no se mantienen proporcionales. El usuario lo ve «interesante, no imprescindible»; retomar si lo echa en falta.
- Exportar también con satélite / plano de calles (teselas con CORS; hay que dibujarlas en el canvas de exportación).
- Más señales; seleccionar varios elementos; alinear.
- Plantilla de cartel completo (cabecera, caja de información, pie) o marco con escudo.
- Editar vértices de un trazo; flechas en un solo punto; sentido contrario.
- Probar con el callejero **real** de Don Benito (hasta ahora solo con rejilla de pruebas): ajustar grosores de calle, tono de gris y tamaños por defecto.
