/* Textos por tipo de contenido (Fotos / Videos) */
export const SCOPE_TEXT = {
  photo: {
    n: '02', title: 'Fotos', heading: 'Nuestras fotos', unit: ['foto', 'fotos'], icon: 'image', base: '/fotos',
    sub: 'Cada lugar es una carpeta. Entra para ver la galería, agregar o eliminar fotos.',
  },
  video: {
    n: '03', title: 'Videos', heading: 'Nuestros videos', unit: ['video', 'videos'], icon: 'film', base: '/videos',
    sub: 'Momentos en movimiento, separados por lugar.',
  },
}

export const plural = (n, [s, p]) => `${n} ${n === 1 ? s : p}`
