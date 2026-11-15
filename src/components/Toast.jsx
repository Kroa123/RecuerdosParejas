import { createContext, useCallback, useContext, useState } from 'react'

const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
