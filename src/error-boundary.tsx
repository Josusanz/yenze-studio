import { Component, type ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-recovery" role="alert">
          <a className="logo" href="/">
            yenze<span>STUDIO</span>
          </a>
          <h1>No hemos podido mostrar esta pantalla.</h1>
          <p>
            Recarga para volver a abrir tu proyecto. Si el problema continúa,
            vuelve al listado de configuradores.
          </p>
          <div>
            <button className="primary" onClick={() => location.reload()}>
              Recargar pantalla
            </button>
            <a className="button" href="/?page=products">
              Mis configuradores
            </a>
          </div>
        </main>
      );
    return this.props.children;
  }
}
