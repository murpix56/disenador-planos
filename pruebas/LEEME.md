# Pruebas automáticas (Playwright)

Requieren Node.js y Playwright instalado en global (`npm i -g playwright`). Se ejecutan desde la raíz del repositorio, con un callejero de pruebas (cuadrícula) y teselas simuladas, sin Internet. Dejan capturas e imágenes exportadas en esta carpeta (no se suben).

    NODE_PATH=$(npm root -g) node pruebas/plano.js    # arranque, dibujar un recorrido, nombres, color, arrastrar, descargar PNG, persistencia
    NODE_PATH=$(npm root -g) node pruebas/plano2.js   # estilos rápidos, señales, cuadro de texto con flecha, leyenda, deshacer/rehacer, encuadrar

    NODE_PATH=$(npm root -g) node pruebas/plano3.js   # lista «Mis planos»: guardar, actualizar, duplicar, abrir, borrar
    NODE_PATH=$(npm root -g) node pruebas/plano4.js   # cambio de localidad (Nominatim y Overpass simulados)

Todos terminan con `ERRORES: []`. La imagen descargada (`export.png`, `export2.png`) conviene mirarla con el visor de imágenes.
`common.js` contiene el callejero simulado (rejilla 5×5) y los simuladores de Overpass y de teselas.
