/*
 * Categorías (lugares) como entidades propias:
 *   { kind: 'category', scope: 'photo' | 'video' | 'post', name, description, date }
 * Así una categoría existe aunque todavía no tenga fotos/videos, y se puede
 * editar o eliminar como una card independiente.
 * Los elementos (photo/video/post) guardan el nombre en `category`.
 *
 * Criterio de nombres:
 *   - Agrupar: el nombre recortado (trim), respetando mayúsculas, tal como se guarda.
 *   - Evitar duplicados al crear/renombrar: recortado y sin distinguir mayúsculas
 *     (no se permite "cusco" si ya existe "Cusco").
 */
import { byDateDesc, createItem, deleteItem, listByKind, mutateItem, runAll, updateItem } from './api'

export const NO_CATEGORY = 'Sin categoría'
export const catKey = (name) => (name || '').trim()
export const catOf = (item) => catKey(item.category) || NO_CATEGORY
export const sameName = (a, b) => catKey(a).toLowerCase() === catKey(b).toLowerCase()

/* Carga solo los elementos del tipo y las categorías (en paralelo), ordenados por fecha */
export async function loadScope(scope) {
  const [items, cats] = await Promise.all([listByKind(scope), listByKind('category')])
  return {
    items: items.sort(byDateDesc),
    cats: cats.filter((c) => c.scope === scope).sort(byDateDesc),
  }
}

const lastActivity = (g) => Math.max(g.entity?.date || 0, ...g.list.map((i) => i.date || 0))

/* Une categorías guardadas + categorías deducidas de los elementos */
export function buildGroups(items, cats) {
  const map = new Map()
  for (const c of cats) {
    const key = catKey(c.name)
    if (!key) continue
    if (!map.has(key)) map.set(key, { name: key, description: c.description || '', entity: c, list: [] })
  }
  for (const it of items) {
    const key = catOf(it)
    if (!map.has(key)) map.set(key, { name: key, description: '', entity: null, list: [] })
    map.get(key).list.push(it)
  }
  return [...map.values()].sort((a, b) => lastActivity(b) - lastActivity(a))
}

/* Cuántos resultados de runAll fallaron */
const failures = (results) => results.filter((r) => r.status === 'rejected').length

/* Crea o edita una categoría. Si cambia el nombre, actualiza todos sus elementos. */
export async function saveCategory({ scope, group, name, description, existing = [] }) {
  name = catKey(name)
  description = (description || '').trim()
  if (!name) throw new Error('El nombre no puede estar vacío')
  const renamed = !group || catKey(group.name) !== name
  const others = group ? existing.filter((n) => catKey(n) !== catKey(group.name)) : existing
  if (renamed && others.some((n) => sameName(n, name)))
    throw new Error(`Ya existe "${name}"`)

  let failed = 0
  if (group && renamed) failed = failures(await runAll(group.list, (it) => mutateItem(it.id, (x) => ({ ...x, category: name }))))
  const saved = group?.entity
    ? await updateItem({ ...group.entity, name, description })
    : await createItem('category', { scope, name, description })
  if (failed)
    throw new Error(`Se guardó "${name}", pero ${failed} de ${group.list.length} elemento(s) no se pudieron mover. Vuelve a intentarlo.`)
  return saved
}

/* Elimina la categoría. Con keepItems los elementos quedan "Sin categoría". */
export async function deleteCategory(group, { keepItems = false } = {}) {
  const failed = failures(await runAll(group.list, (it) =>
    keepItems ? mutateItem(it.id, (x) => ({ ...x, category: '' })) : deleteItem(it.id),
  ))
  if (failed) {
    // La entidad se conserva para que se pueda reintentar
    throw new Error(`No se pudieron ${keepItems ? 'actualizar' : 'eliminar'} ${failed} de ${group.list.length} elemento(s). Vuelve a intentarlo.`)
  }
  if (group.entity) await deleteItem(group.entity.id)
}
