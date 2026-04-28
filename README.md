# Visualizador Google Sheets

Web estática en HTML, CSS y JS que consume una hoja de Google Sheets publicada y muestra una tabla + gráfico.

## Archivos

- `index.html`: estructura principal.
- `styles.css`: estilos.
- `app.js`: carga y render de datos.
- `scoreboard.html`: nueva experiencia con welcome page + ranking competitivo por grupo.
- `scoreboard.css`: estilos modernos/minimalistas del scoreboard.
- `scoreboard.js`: lectura de Google Sheets y cálculo de puntajes totales por `Grupo`.

## Scoreboard por grupo

La página `scoreboard.html` calcula el puntaje total por grupo usando:

- `PuntosFQ + PuntosMate` por cada alumno.
- Agrupación por columna `Grupo`.
- Filtro maestro por hoja: `3roSoc`, `3roNat`, `3roEco`.

Tiene una pantalla de bienvenida previa y luego muestra un ranking visual por equipos.

## Ajustar la hoja

En `app.js`, cambia `SHEET_PUBHTML_URL` y `SHEET_CSV_BASE_URL` si usas otra hoja.
Puedes editar `MANUAL_TAB_NAMES` para listar las pestañas esperadas.

El formato recomendado para hojas publicadas es:

```
https://docs.google.com/spreadsheets/d/e/<ID>/pub?output=csv
```

## Ejecutar en local

Necesitas un servidor estático (por ejemplo, con Python):

```powershell
python -m http.server 5173
```

Luego abre: `http://localhost:5173`

Páginas disponibles:

- Visualizador tabla/gráfico: `http://localhost:5173/index.html`
- Scoreboard competitivo: `http://localhost:5173/scoreboard.html`

## Notas

- Si la hoja tiene varias pestañas, el selector de hoja se llena automáticamente desde `pubhtml`.
- Si alguna pestaña no aparece, asegúrate de que esté publicada o pasa su `gid` manualmente.
- Si no se listan todas las pestañas, puedes forzar `&gid=<ID>` en `SHEET_CSV_BASE_URL`.
- El gráfico detecta columnas numéricas automáticamente.
