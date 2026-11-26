import { configureVapid, listKind, listSubs, pushEnv, sendToSubs } from '../lib/send-push.mjs'
import { dailyQuestion, limaHour } from '../../src/lib/questions.js'

/*
 * Función programada (cada hora).
 *  1. Cápsulas del tiempo: las que ya llegaron a `openAt` y no tienen `notified` se marcan
 *     (PUT del registro completo) ANTES de avisar, y se avisa a todas las suscripciones.
 *  2. Pregunta del día: desde las 9 h de Lima se avisa la pregunta a todas las suscripciones.
 *     Un registro { kind: 'dailyLog', key: 'YYYY-MM-DD' } evita repetir: si la ejecución de las 9
 *     falla, la de las 10 (u otra posterior) la reintenta. Dos ejecuciones simultáneas podrían
 *     duplicar el aviso (improbable con @hourly).
 *  Un fallo al enviar no detiene el resto de la tarea (se cuenta en `errors`).
 *
 * Variables de entorno: ver netlify/lib/send-push.mjs
 */

export const config = { schedule: '@hourly' }

const QUESTION_HOUR = 9 // hora de Lima

const reply = (status, body) => Response.json(body, { status })

async function putItem({ base, resource }, item) {
  const res = await fetch(`${base}/${resource}/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error(`Mock API respondió ${res.status}`)
  return res.json()
}

async function createItem({ base, resource }, data) {
  const res = await fetch(`${base}/${resource}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: Date.now(), ...data }),
  })
  if (!res.ok) throw new Error(`Mock API respondió ${res.status}`)
  return res.json()
}

const short = (s, n = 140) => {
  const t = (s || '').trim()
  return t.length > n ? `${t.slice(0, n - 3)}…` : t
}

export async function runDaily(now = new Date()) {
  const env = pushEnv()
  if (!env.base || !env.publicKey || !env.privateKey) throw new Error('Faltan variables de entorno de push')
  const cfg = { base: env.base, resource: env.resource }
  const result = { capsules: 0, question: false, sent: 0, removed: 0, errors: 0 }
  let subs = null
  const getSubs = async () => (subs ??= await listSubs(cfg))
  const send = async (payload) => {
    try {
      const list = await getSubs()
      if (!list.length) return
      configureVapid(env)
      const r = await sendToSubs(list, payload, cfg)
      result.sent += r.sent
      result.removed += r.removed
      // Las borradas no se vuelven a usar en esta misma ejecución
      if (r.removed) subs = null
    } catch {
      result.errors++ // sin red o MockAPI caído: se sigue con lo demás
    }
  }

  // 1. Cápsulas que se abren
  const due = (await listKind(cfg, 'capsule'))
    .filter((c) => !c.notified && Number(c.openAt || 0) <= now.getTime())
  for (const c of due) {
    try {
      await putItem(cfg, { ...c, notified: true }) // primero se marca: otra ejecución ya no la avisa
    } catch {
      continue // si no se pudo marcar, no se avisa (se reintenta en la próxima hora)
    }
    result.capsules++
    await send({
      title: '💌 Se abrió una cápsula del tiempo',
      body: short(c.title) || 'Ya puedes leerla',
      url: '/capsula',
      tag: `capsule-${c.id}`,
    })
  }

  // 2. Pregunta del día (desde las 9 de Lima, una vez por día)
  if (limaHour(now) >= QUESTION_HOUR) {
    const q = dailyQuestion(now)
    const logs = await listKind(cfg, 'dailyLog')
    if (!logs.some((l) => l.key === q.key)) {
      await createItem(cfg, { kind: 'dailyLog', key: q.key }) // primero el registro, luego el aviso
      result.question = true
      await send({ title: '💭 Pregunta del día', body: q.text, url: '/pregunta', tag: `question-${q.key}` })
    }
  }
  return result
}

export default async () => {
  try {
    return reply(200, await runDaily())
  } catch (e) {
    return reply(500, { error: e.message || 'Error en la tarea diaria' })
  }
}
