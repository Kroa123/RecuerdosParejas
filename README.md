# 💖 Recuerdos con el amor de mi vida

Página web (React + Vite) para guardar recuerdos en pareja, lista para desplegar en **Netlify** y guardar los datos en una **Mock API**.

## Vistas

| Vista | Qué hace |
|---|---|
| **Inicio** | Título "RECUERDOS CON EL AMOR DE MI VIDA" y un corazón animado (tócalo: suelta corazoncitos y frases). |
| **Recuerdos** | Publicaciones tipo red social: título, texto, fecha, varias fotos/videos, "me gusta" y comentarios. |
| **Fotos** | Tarjetas por lugar (categoría). Entra a cada lugar para ver su galería, ampliar fotos, renombrar o borrar. |
| **Videos** | Igual que Fotos, pero con videos (archivo o enlace de YouTube / Google Drive / Vimeo). |
| **Para ti** (Información) | Mensaje largo editable, fondo de partículas interactivo y un ramo de tulipanes que se dibuja por partes. |

## Ejecutar en tu computadora

```bash
npm install
npm run dev
```

Abre http://localhost:5173. **Sin configurar nada**, todo se guarda en el navegador (IndexedDB), así que puedes probarla al instante.

## Conectar la Mock API (MockAPI.io)

1. Entra a https://mockapi.io, crea una cuenta y un proyecto nuevo.
2. Crea **un solo recurso** llamado `recuerdos` (borra los campos de ejemplo o déjalos, da igual).
3. Copia la URL del proyecto, algo como `https://6650a1b2c3d4e5f6a7b8c9d0.mockapi.io/api/v1`.
4. Configúrala de una de estas formas:
   - **Desde la página**: botón ⚙ del menú → pega la URL → "Probar conexión" → "Guardar". (Se guarda en ese navegador.)
   - **Para todos (recomendado en Netlify)**: crea la variable de entorno `VITE_MOCKAPI_URL` con esa URL (y opcional `VITE_MOCKAPI_RESOURCE`, por defecto `recuerdos`). En local copia `.env.example` a `.env`.

El punto del ⚙ se pone **verde** cuando usa la Mock API y **amarillo** cuando guarda en local.

Todo se guarda en el mismo recurso con un campo `kind` (`post`, `photo`, `video`, `info`), así basta un solo recurso del plan gratis.

### ⚠️ Tamaño de imágenes y videos
- Las fotos se **comprimen automáticamente** (JPEG) y se guardan como base64.
- MockAPI limita el tamaño de cada registro, por eso con Mock API los videos como archivo se limitan a **2 MB**. Para videos más grandes súbelos a **YouTube (oculto)** o **Google Drive (compartido con enlace)** y pega el enlace.
- En el ⚙ puedes **descargar un respaldo** e **importarlo** en otra fuente (por ejemplo, pasar lo que guardaste en local a la Mock API).

### Alternativa: json-server (API falsa local)
```bash
npm run api            # levanta http://localhost:3001/recuerdos usando db.json
```
y pon `VITE_MOCKAPI_URL=http://localhost:3001` (o configúralo desde el ⚙).

## Desplegar en Netlify

El archivo `netlify.toml` ya trae el comando de build, la carpeta `dist` y la redirección para que las rutas (`/fotos`, `/videos/...`) funcionen al recargar.

**Opción A – desde GitHub (recomendada)**
1. Sube este proyecto a un repositorio de GitHub.
2. En https://app.netlify.com → *Add new site* → *Import an existing project* → elige el repositorio.
3. Netlify detecta la configuración sola. En *Site configuration → Environment variables* agrega `VITE_MOCKAPI_URL`.
4. *Deploy*. Si cambias la variable después, haz *Trigger deploy* para que se aplique.

**Opción B – arrastrar y soltar**
1. Crea `.env` con `VITE_MOCKAPI_URL=...` y ejecuta `npm run build`.
2. Arrastra la carpeta `dist` a https://app.netlify.com/drop.

## Personalizar
- **Mensaje de "Para ti"**: botón "Editar mensaje" en la página (se guarda en la API), o el texto por defecto en `src/pages/Informacion.jsx`.
- **Colores**: variables al inicio de `src/styles.css`.
- **Tulipanes** (colores y posiciones): arreglo `TULIPS` en `src/components/TulipBouquet.jsx`.

> Nota: la Mock API es pública para quien conozca la URL; no guardes nada privado sensible.
