# Recuerdos con el amor de mi vida

Página web (React + Vite) para guardar recuerdos en pareja, lista para desplegar en **Netlify** y guardar los datos en una **Mock API**.

## Vistas

| Vista | Qué hace |
|---|---|
| **Inicio** | Título, corazón interactivo, contadores y accesos a cada sección. |
| **Recuerdos** | Publicaciones con título, texto, fecha, categoría, fotos/videos, "me gusta" y comentarios. Las **categorías se muestran como cards** arriba y sirven de filtro. Cada publicación se puede **editar** (incluye quitar fotos/videos) o eliminar. |
| **Fotos** | Una **card por lugar** (categoría). Se pueden crear lugares vacíos, editarlos y eliminarlos. Dentro: galería con **botón de eliminar en cada foto**, selección múltiple y eliminar desde el visor. |
| **Videos** | Igual que Fotos, con videos (archivo o enlace de YouTube / Google Drive / Vimeo). |
| **Para ti** | Carta editable que **se muestra al instante**; el ramo de tulipanes se dibuja aparte, sin bloquear la lectura. |

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

Todo se guarda en el mismo recurso con un campo `kind` (`post`, `photo`, `video`, `info`, `category`), así basta un solo recurso del plan gratis. Las categorías (`kind: category`, con `scope` = `photo` / `video` / `post`) permiten tener lugares vacíos con nombre y descripción.

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
- **Colores y tipografías** (tema oscuro): variables `:root` al inicio de `src/styles.css`.
- **Tulipanes** (colores y posiciones): arreglo `TULIPS` en `src/components/TulipBouquet.jsx`.

> Nota: la Mock API es pública para quien conozca la URL; no guardes nada privado sensible.

## 💬 Chat entre los dos

En la vista **Chat** cada uno elige quién es (M o D) la primera vez; el navegador lo recuerda.
Los mensajes se guardan en la Mock API (`kind: "message"`) y se actualizan solos cada 3 segundos.
Para chatear desde **dos celulares distintos** tienen que tener configurada la Mock API (en modo local
solo se ven en el mismo navegador). Doble clic en un mensaje = corazón ♥.

## 📸 Conectar Google Fotos

El botón **Google Fotos** (en Recuerdos, Fotos y Videos) usa la *Google Photos Picker API*. Se configura una sola vez:

1. Entra a https://console.cloud.google.com y crea un proyecto (gratis).
2. En *APIs y servicios → Biblioteca* busca **Google Photos Picker API** y actívala.
3. En *Pantalla de consentimiento de OAuth* elige **Externo**, ponle un nombre (ej. "MyD") y en
   *Usuarios de prueba* agrega los dos correos de Gmail que van a usar la página.
4. En *Credenciales → Crear credenciales → ID de cliente de OAuth* elige **Aplicación web** y en
   *Orígenes de JavaScript autorizados* agrega `http://localhost:5173` y la URL de Netlify
   (ej. `https://myd-siempre-juntos.netlify.app`).
5. Copia el **ID de cliente** y ponlo en `VITE_GOOGLE_CLIENT_ID` (en `.env` y en las variables de entorno de Netlify).
   En Netlify, después de agregarla haz *Trigger deploy*.

Al tocar el botón: inicias sesión con Google, se abre Google Fotos, eliges y tocas **Listo**; las fotos se copian a la página.
Sin la llave, el botón explica cómo configurarlo. Tip: en Android, el selector normal de archivos ya permite elegir la app Google Fotos.
