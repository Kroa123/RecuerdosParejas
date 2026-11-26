/*
 * Pregunta del día para la pareja.
 * JS puro (sin React, sin import.meta ni APIs del navegador): lo usan la página
 * /pregunta y la función programada netlify/functions/daily.mjs.
 *
 * El "día" se cuenta en la hora de Perú (America/Lima, UTC-5 todo el año, sin horario de verano),
 * así ambos ven la misma pregunta y cambia a medianoche de Lima.
 */

export const QUESTIONS = [
  // Recuerdos
  '¿Qué fue lo primero que pensaste de mí cuando nos conocimos?',
  '¿Cuál es tu recuerdo favorito de nuestra primera cita?',
  '¿En qué momento supiste que te estabas enamorando?',
  '¿Qué viaje juntos repetirías mañana mismo?',
  '¿Qué canción te recuerda a nosotros y por qué?',
  '¿Cuál fue el día en que más te reíste conmigo?',
  '¿Qué detalle mío recuerdas de nuestros primeros meses?',
  '¿Qué foto nuestra es tu favorita y qué estaba pasando ese día?',
  '¿Cuál ha sido nuestra mejor aventura hasta ahora?',
  '¿Qué conversación nuestra nunca olvidarás?',
  '¿Qué lugar te hace pensar en mí cada vez que pasas por ahí?',
  '¿Cuál fue el regalo más especial que te he dado?',
  '¿Qué es lo más bonito que te he dicho alguna vez?',
  '¿Qué momento difícil superamos que te hizo sentir orgullo de nosotros?',
  '¿Recuerdas nuestro primer beso? Cuéntalo con tus palabras.',
  '¿Qué comida te recuerda a un momento nuestro?',
  '¿Qué día te gustaría volver a vivir exactamente igual?',
  '¿Cuál fue la primera vez que te sentiste en casa conmigo?',
  '¿Qué cosa pequeña que hice te hizo sentir muy querida o querido?',
  '¿Cuál es el mensaje mío que más te ha gustado recibir?',
  '¿Qué anécdota nuestra le contarías a nuestros nietos?',
  '¿Qué celebración juntos ha sido la más bonita?',
  '¿Qué fue lo que más te sorprendió de mí al conocerme mejor?',
  '¿Qué noche juntos recuerdas con más cariño?',
  '¿Cuál fue nuestro plan improvisado que salió mejor de lo esperado?',
  '¿Qué es lo primero que recuerdas de mi risa?',
  '¿Qué película o serie te recuerda a nosotros?',
  '¿Qué lugar de nuestra ciudad tiene un significado especial para ti?',
  '¿Qué día lloraste de felicidad por algo nuestro?',
  '¿Qué recuerdo nuestro te saca una sonrisa en un mal día?',

  // Sueños y futuro
  '¿Cómo te imaginas nuestra vida dentro de cinco años?',
  '¿Qué país te gustaría que conociéramos juntos?',
  '¿Cómo sería nuestra casa ideal?',
  '¿Qué tradición te gustaría que creáramos como pareja?',
  '¿Qué sueño tuyo quieres que te ayude a cumplir?',
  '¿Qué aventura loca te gustaría vivir conmigo algún día?',
  '¿Cómo te imaginas que seremos de viejitos?',
  '¿Qué te gustaría aprender juntos?',
  '¿Qué meta te gustaría que alcanzáramos este año?',
  '¿Cómo sería nuestro fin de semana perfecto?',
  '¿Dónde te gustaría que pasáramos nuestro próximo aniversario?',
  '¿Qué mascota te gustaría que tuviéramos y cómo se llamaría?',
  '¿Qué te gustaría que dijeran de nosotros como pareja?',
  '¿Qué ciudad elegirías para vivir juntos si pudiéramos ir a cualquier lugar?',
  '¿Qué proyecto te gustaría que empezáramos juntos?',
  '¿Qué lugar de Perú todavía no conocemos y quieres visitar conmigo?',
  '¿Qué te gustaría celebrar conmigo dentro de diez años?',
  '¿Cómo sería el viaje de nuestros sueños, paso a paso?',
  '¿Qué cosa te gustaría que hiciéramos más seguido?',
  '¿Qué te gustaría que nunca cambiara entre nosotros?',
  '¿Qué nueva costumbre te gustaría que tuviéramos los domingos?',
  '¿Qué te gustaría escribirme en una carta para abrir dentro de un año?',
  '¿Qué experiencia te gustaría regalarme algún día?',
  '¿Cómo imaginas nuestra boda o nuestra celebración perfecta?',
  '¿Qué te gustaría que lográramos antes de fin de año?',

  // Divertidas
  'Si fuéramos personajes de una película, ¿cuál sería el título?',
  'Si pudiéramos tener un superpoder de pareja, ¿cuál sería?',
  '¿Qué comida cocinarías para conquistarme otra vez?',
  'Si fuéramos animales, ¿qué animal sería cada uno?',
  '¿Cuál es mi manía más graciosa?',
  'Si ganáramos la lotería mañana, ¿qué sería lo primero que haríamos?',
  '¿Qué canción cantaríamos juntos en un karaoke?',
  '¿Qué apodo nuevo me pondrías hoy?',
  'Si tuviéramos un programa de televisión, ¿de qué trataría?',
  '¿Cuál es la cosa más rara que hemos comido juntos?',
  '¿Quién de los dos sobreviviría más tiempo en una isla desierta y por qué?',
  'Si pudiéramos cenar con un famoso, ¿a quién invitaríamos?',
  '¿Qué emoji me representa mejor?',
  '¿Qué harías si un día despertaras en mi cuerpo?',
  '¿Cuál sería el nombre de nuestra banda musical?',
  'Si fuéramos un postre, ¿cuál seríamos?',
  '¿Qué es lo más vergonzoso que te ha pasado delante de mí?',
  '¿Cuál de los dos es más dormilón? Defiende tu respuesta.',
  'Si tuviéramos que bailar una sola canción toda la vida, ¿cuál sería?',
  '¿Qué tres cosas llevarías a un viaje sorpresa conmigo?',
  'Si nuestra historia fuera un libro, ¿cómo se llamaría el capítulo de hoy?',
  '¿Qué palabra o frase digo tanto que ya es mi marca registrada?',
  'Si pudiéramos teletransportarnos ahora mismo, ¿a dónde iríamos?',
  '¿Qué plan absurdo te gustaría hacer conmigo solo por diversión?',
  '¿Qué personaje de dibujos animados se parece más a mí?',
  'Si me escribieras una canción, ¿cómo empezaría?',
  '¿Cuál sería nuestro sabor de helado como pareja?',
  '¿Qué serie veríamos en maratón un día de lluvia?',
  '¿Qué receta deberíamos aprender a cocinar juntos?',

  // Profundas
  '¿Qué es lo que más valoras de nuestra relación?',
  '¿Qué aprendiste de ti gracias a mí?',
  '¿Qué te hace sentir más amada o amado: palabras, gestos, tiempo, regalos o abrazos?',
  '¿Cómo puedo apoyarte mejor cuando tienes un mal día?',
  '¿Qué miedo te gustaría que enfrentáramos juntos?',
  '¿Qué es algo que nunca me has dicho y te gustaría decirme?',
  '¿Qué significa para ti la palabra "hogar"?',
  '¿Qué cualidad mía admiras más?',
  '¿En qué hemos crecido como pareja desde que empezamos?',
  '¿Qué te hace sentir en paz cuando estás conmigo?',
  '¿Qué promesa te gustaría hacerme hoy?',
  '¿Qué cosa pequeña puedo hacer cada día para hacerte feliz?',
  '¿Qué te gustaría que entendiera mejor de ti?',
  '¿Qué es lo que más te gusta de cómo nos cuidamos?',
  '¿Qué te ha enseñado el amor que sientes por mí?',
  '¿Cómo te sientes cuando estamos lejos el uno del otro?',
  '¿Qué es lo que más agradeces de este último mes juntos?',
  '¿Qué parte de tu historia te gustaría contarme con más calma?',
  '¿Qué es para ti un amor bonito?',
  '¿Cuándo te has sentido más orgullosa u orgulloso de mí?',
  '¿Qué necesitas de mí en esta etapa de tu vida?',
  '¿Qué es lo que más te gusta de ser tú cuando estás conmigo?',
  '¿Qué palabra describe lo que sientes por mí hoy?',
  '¿Qué te gustaría que recordáramos siempre, aunque pasen los años?',
  '¿Cómo te gustaría que resolviéramos nuestras discusiones?',
  '¿Qué sueño de tu infancia sigue vivo en ti?',
  '¿Qué es lo que más te emociona de nuestro futuro?',
  '¿Qué te gustaría agradecerme hoy?',
  '¿Qué momento de tu vida te gustaría haber compartido conmigo?',
  '¿Por qué crees que nos encontramos?',
  '¿Qué abrazo mío recuerdas como el más reconfortante?',
  '¿Qué te gustaría decirle a la persona que eras antes de conocerme?',
  '¿En qué momento del día me extrañas más?',
  '¿Qué gesto mío te hace sentir que todo va a estar bien?',
  '¿Qué es lo que más te gusta de nuestra rutina juntos?',
  'Si hoy fuera nuestro último día del año, ¿qué te gustaría que hiciéramos?',
]

const DAY_MS = 86400000
const LIMA_OFFSET_MS = -5 * 3600000 // UTC-5 fijo (Perú no usa horario de verano)

/* Fecha de Lima desplazada: sus campos UTC son la hora local de Lima */
const limaDate = (date) => new Date(new Date(date).getTime() + LIMA_OFFSET_MS)

/* 'YYYY-MM-DD' del día en Lima */
export const limaKey = (date = new Date()) => limaDate(date).toISOString().slice(0, 10)

/* Hora (0-23) en Lima */
export const limaHour = (date = new Date()) => limaDate(date).getUTCHours()

/* Paso coprimo con la cantidad de preguntas: recorre todas antes de repetir y no van en orden */
const gcd = (a, b) => (b ? gcd(b, a % b) : a)
const STEP = (() => {
  let s = 37
  while (gcd(s, QUESTIONS.length) !== 1) s++
  return s
})()

/* Pregunta de un día concreto a partir de su clave 'YYYY-MM-DD' */
export function questionForKey(key) {
  const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS)
  const n = QUESTIONS.length
  const index = Number.isFinite(day) ? (((day * STEP + 11) % n) + n) % n : 0
  return { key, index, text: QUESTIONS[index] }
}

/* Pregunta del día (determinista: la misma para ambos durante todo el día de Lima) */
export function dailyQuestion(date = new Date()) {
  return questionForKey(limaKey(date))
}
