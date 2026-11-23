# League Newspaper (periódico de liga)

**Un periódico semanal y un sitio de estadísticas para tu liga de baloncesto fantasy.**
Cada semana tu liga tiene su portada: crónica principal, marcadores, clasificación, ranking de poder, premios, cinturones de rachas, juego de pronósticos, notas de jugadores, ideas de traspaso y el archivo de todos los números. Las cifras las calcula el sitio; los textos los escribe la IA que elijas.

Idiomas: **Español · English · Français · Türkçe** (un idioma por sitio, elegido en los ajustes).
Otros idiomas: [English](README.md) · [Français](README.fr.md) · [Türkçe](README.tr.md)

> **Versión 0.1:** ligas Yahoo Fantasy NBA, cara a cara, 9 categorías (FG%, FT%, 3PT%, PTS, REB, AST, ST, BLK, TO). Otros deportes y tipos de puntuación están previstos.

## Qué incluye

- **Portada:** titular, marcadores, clasificación, mánagers dormidos, premios y cinturones, pronósticos, notas de jugadores, mesas de traspasos.
- **Estadísticas:** ranking de poder independiente del calendario, balance contra todos, cambio semanal, mapa de calor, tus propios gráficos, CSV en bruto.
- **Podio:** cinturones, rachas activas, liga del sueño («Almohada de Oro»), medallero.
- **Pronósticos:** favoritos de la próxima semana, libreta de pronósticos, probabilidades de playoffs, índice de suerte, clasificación justa, juego de pronósticos para lectores.
- **Comparar, Equipos, Jugadores, Mesas de traspasos, Vitrina de trofeos.**
- Archivo, imagen para compartir de cada página y equipo, modo app en la pantalla de inicio, aviso opcional, «mi equipo» destacado (guardado solo en el navegador del lector).

## Cómo funciona

```
Datos de la liga (Excel) ──► scripts → archivos de datos ──► la IA escribe el número ──► GitHub ──► Cloudflare compila y publica
```

El trabajo se reparte en tres **roles**. Cada archivo se entiende por sí solo y funciona con cualquier IA:

| Rol | Archivo | Necesita |
|---|---|---|
| Datos | [roles/1-DATA.md](roles/1-DATA.md) | Acceso a la liga (un conector como Flaim, o copiar a mano) |
| Redacción | [roles/2-WRITER.md](roles/2-WRITER.md) | Archivos de datos, guía de estilo, opcionalmente el chat del grupo |
| Revisión | [roles/3-CHECKER.md](roles/3-CHECKER.md) | El número terminado |

- **Varias IA:** reparten el coste y la espera (una para los datos, otra para escribir).
- **Una sola IA:** dale los tres archivos en orden.

El sitio nunca llama a una IA por su cuenta y no cuesta nada en el plan gratuito de Cloudflare. Los archivos de rol están en inglés; la IA escribe el número en el idioma del sitio.

## Inicio rápido

Necesitas: cuenta de GitHub, cuenta de Cloudflare (gratis), Node.js 22 y Python 3 con `openpyxl` (o una IA que pueda ejecutar código).

1. En GitHub, «Use this template» (o fork) para crear tu repositorio. Mantenlo privado si el contenido de tu liga lo es.
2. Rellena `veri/ayarlar.json` con `"dil": "es"`. Todos los ajustes están en el [README en inglés](README.md#settings).
3. Borra la liga de ejemplo: pon `"ornekLig": false` en los ajustes (o borra la línea), borra la carpeta `ornek/` y archivos de `veri/haftalar/`, `veri/kadrolar/`, `veri/gelecek/`, `veri/nba/`, `veri/yahoo-sira/`; vacía `veri/gecmis.json`, `veri/draft.json`, `veri/fikstur.json`.
4. Describe el tono de tu liga en `style/STYLE.md`.
5. Prepara tu primer número siguiendo [docs/WEEKLY.md](docs/WEEKLY.md).
6. Prueba en local: `npm install`, `npm run build`, `npm run preview`.
7. Cloudflare: Workers & Pages → Create → Import a repository → tu repositorio. Comando de compilación `npm run build`, comando de despliegue `npx wrangler deploy`.
8. Avisos (opcional): ejecuta `npm run anahtar`; la clave pública va en `veri/ayarlar.json` → `"bildirimAnahtari"` y la privada como secreto de Cloudflare `VAPID_PRIVATE_JWK`.

## Datos, derechos y privacidad

- La plantilla no tiene ningún servidor que recoja datos de las ligas; cada liga obtiene sus propios datos con su propia cuenta. La API Fantasy Sports de Yahoo se ofrece para uso no comercial; si piensas en algo comercial, lee antes las condiciones de Yahoo. Esto no es asesoramiento legal.
- Las actas de partidos NBA vienen del marcador público de ESPN; no es oficial y puede cambiar.
- El chat del grupo solo debe usarse si la liga está de acuerdo. El repositorio solo guarda el número de mensajes por equipo.
- Las elecciones de los lectores se quedan en su navegador.

Sin relación con Yahoo, la NBA, ESPN ni ninguna empresa de IA.

## Idiomas

Los textos de la interfaz están en turco en el código y se traducen con los diccionarios de `src/i18n/` (`en.json`, `fr.json`, `es.json`). Números, porcentajes y fechas siguen el idioma (48,2 %), igual que las direcciones de las páginas (`/pronosticos/`, `/equipos/` …), los nombres de las imágenes para compartir y de los CSV, los anclajes de las secciones y los mensajes de los scripts. El número de ejemplo de la liga de demostración está en los cuatro idiomas. Para añadir un idioma, copia `en.json`, tradúcelo y añade el código en `scripts/dil.mjs`. Detalles en el [README en inglés](README.md#languages).

## Licencia

[MIT](LICENSE).
