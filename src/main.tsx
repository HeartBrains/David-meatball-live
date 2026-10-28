import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import App from "./App";
import "./styles.css";

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Admin interface failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-screen">
          <section className="fatal-error-card" role="alert">
            <p className="eyebrow">DAVID MEATBALL · ADMIN</p>
            <h1>หน้าแอดมินแสดงผลไม่สำเร็จ</h1>
            <p>ระบบพบข้อผิดพลาดระหว่างเปิดหน้า กรุณาโหลดใหม่ หากยังพบปัญหาให้แจ้งผู้ดูแลพร้อมภาพหน้าจอนี้</p>
            {this.state.message && <code className="fatal-error-detail">{this.state.message}</code>}
            <button className="button button-dark" onClick={() => window.location.reload()}><RefreshCw size={16} /> โหลดหน้าใหม่</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
