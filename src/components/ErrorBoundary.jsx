import { Component } from 'react'
import Icon from './Icon'

/*
 * Atrapa errores de render de una página para que no se quede la pantalla en blanco.
 *
 * Excepción a la regla "solo componentes funcionales": en React 18 la única forma de
 * capturar errores de render es un componente de clase con getDerivedStateFromError /
 * componentDidCatch (no existe un hook equivalente).
 *
 * resetKey: al cambiar (p. ej. la ruta), se limpia el error y se vuelve a intentar.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error en la página:', error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty-state" role="alert">
        <Icon name="heart" size={30} />
        <h3>Algo salió mal al mostrar esta página</h3>
        <p>No se perdió ningún recuerdo. Puedes volver al inicio o recargar la página.</p>
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={() => window.location.assign('/')}>
            <Icon name="home" size={16} /> Volver al inicio
          </button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
