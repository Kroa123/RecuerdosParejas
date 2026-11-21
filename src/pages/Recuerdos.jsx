import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteItem } from '../lib/api'
import { buildGroups, catOf, deleteCategory, loadScope, NO_CATEGORY } from '../lib/categories'
import { plural } from '../lib/scopes'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { VideoThumb } from '../components/VideoPlayer'
import Modal from '../components/Modal'
import CategoryForm from '../components/CategoryForm'
import PostComposer from '../components/PostComposer'
import PostEditForm from '../components/PostEditForm'
import PostCard from '../components/PostCard'
import Icon from '../components/Icon'

/* ---------- página ---------- */
export default function Recuerdos() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState(null) // nombre de categoría o null = todas
  const [modal, setModal] = useState(null) // 'new-cat' | {editCat} | {editPost}
  const toast = useToast()
  const confirm = useConfirm()

  // Cada carga invalida la anterior y se ignora si la página ya se desmontó
  const reqRef = useRef(0)
  const loading = useRef(false)
  const load = () => {
    const req = ++reqRef.current
    const alive = () => req === reqRef.current
    loading.current = true
    return loadScope('post')
      .then((d) => { if (alive()) setData(d) })
      .catch((e) => { if (alive()) { toast(e.message, 'error'); setData({ items: [], cats: [] }) } })
      .finally(() => { if (alive()) loading.current = false })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { reqRef.current++ } }, [])

  const posts = data?.items || []
  const groups = useMemo(() => (data ? buildGroups(data.items, data.cats) : []), [data])
  const names = groups.map((g) => g.name).filter((n) => n !== NO_CATEGORY)
  const shown = filter ? posts.filter((p) => catOf(p) === filter) : posts
  // Seguro aunque la carga inicial no haya terminado (data todavía null)
  const setPosts = (fn) => setData((d) => ({ cats: [], ...d, items: fn(d?.items || []) }))
  const toggle = (name) => setFilter((f) => (f === name ? null : name))

  const removePost = async (post) => {
    const ok = await confirm({
      title: 'Eliminar recuerdo',
      message: `"${post.title || 'Sin título'}" y sus ${post.media?.length || 0} foto(s)/video(s) se eliminarán.`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteItem(post.id)
      setPosts((p) => p.filter((x) => x.id !== post.id))
      toast('Recuerdo eliminado')
    } catch (e) { toast(e.message, 'error') }
  }

  const removeCat = async (g) => {
    const ok = await confirm({
      title: `Eliminar categoría "${g.name}"`,
      message: g.list.length ? `Los ${g.list.length} recuerdo(s) no se borran: quedarán "${NO_CATEGORY}".` : 'La categoría está vacía.',
      confirmText: 'Eliminar categoría',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(g, { keepItems: true })
      if (filter === g.name) setFilter(null)
      toast('Categoría eliminada')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const coverOf = (g) => {
    for (const p of g.list) {
      const m = p.media?.find((x) => x.type === 'image') || p.media?.[0]
      if (m) return m
    }
    return null
  }

  return (
    <section className="feed-page">
      <header className="page-head">
        <h1 className="page-title">Nuestros recuerdos</h1>
        <p className="page-sub">Publicaciones con texto, fotos, videos y comentarios, ordenadas por categoría.</p>
      </header>

      <div className="strip-head">
        <h2 className="label">Categorías</h2>
        <button className="btn ghost sm" onClick={() => setModal('new-cat')}><Icon name="folderPlus" size={15} /> Nueva</button>
      </div>
      <div className="cat-strip">
        <button className={`strip-card all ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>
          <div className="strip-cover"><Icon name="book" size={22} /></div>
          <div className="strip-body"><b>Todos</b><span className="mono">{posts.length}</span></div>
        </button>
        {groups.map((g) => {
          const cover = coverOf(g)
          return (
            <div key={g.name} className={`strip-card ${filter === g.name ? 'on' : ''}`}>
              {/* Zona seleccionable separada de las herramientas: sin controles anidados */}
              <div
                role="button"
                tabIndex={0}
                aria-pressed={filter === g.name}
                aria-label={`Filtrar por ${g.name} (${g.list.length})`}
                onClick={() => toggle(g.name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(g.name) } }}
              >
                <div className="strip-cover">
                  {cover ? (cover.type === 'image' ? <img src={cover.src} alt="" loading="lazy" /> : <VideoThumb src={cover.src} />) : <Icon name="folder" size={22} />}
                </div>
                <div className="strip-body"><b title={g.name}>{g.name}</b><span className="mono">{g.list.length}</span></div>
              </div>
              {g.name !== NO_CATEGORY && (
                <div className="strip-tools">
                  <button className="tool-btn" title="Editar" aria-label={`Editar categoría ${g.name}`} onClick={() => setModal({ editCat: g })}><Icon name="pencil" size={13} /></button>
                  <button className="tool-btn danger" title="Eliminar" aria-label={`Eliminar categoría ${g.name}`} onClick={() => removeCat(g)}><Icon name="trash" size={13} /></button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="feed">
        <PostComposer
          categories={names}
          defaultCategory={filter && filter !== NO_CATEGORY ? filter : ''}
          onCreated={(p) => {
            setPosts((cur) => [p, ...cur.filter((x) => x.id !== p.id)])
            // Publicado durante la carga: esa respuesta pudo salir antes de guardar → se recarga
            if (loading.current) load()
          }}
        />

        {filter && (
          <div className="filter-note">
            <span>Mostrando <b>{filter}</b> · {plural(shown.length, ['recuerdo', 'recuerdos'])}</span>
            <button className="link" onClick={() => setFilter(null)}>Ver todos</button>
          </div>
        )}

        {!data && [0, 1].map((i) => <div key={i} className="card post skeleton post-skel" />)}
        {data && shown.length === 0 && (
          <div className="empty-state">
            <Icon name="book" size={30} />
            <h3>{filter ? 'Nada en esta categoría todavía' : 'Aún no hay recuerdos'}</h3>
            <p>Escribe el primero arriba.</p>
          </div>
        )}
        {shown.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onDelete={removePost}
            onEdit={(post) => setModal({ editPost: post })}
            onChange={(next) => setPosts((cur) => cur.map((x) => (x.id === p.id ? (typeof next === 'function' ? next(x) : next) : x)))}
          />
        ))}
      </div>

      {(modal === 'new-cat' || modal?.editCat) && (
        <Modal title={modal.editCat ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setModal(null)}>
          <CategoryForm scope="post" label="categoría" group={modal.editCat} existing={groups.map((g) => g.name)}
            onDone={(saved) => { if (modal.editCat && filter === modal.editCat.name) setFilter(saved.name); setModal(null); load() }} />
        </Modal>
      )}
      {modal?.editPost && (
        <Modal title="Editar recuerdo" wide onClose={() => setModal(null)}>
          <PostEditForm
            post={modal.editPost}
            categories={names}
            onSaved={(next) => { setModal(null); setPosts((cur) => cur.map((x) => (x.id === next.id ? next : x))) }}
          />
        </Modal>
      )}
    </section>
  )
}
