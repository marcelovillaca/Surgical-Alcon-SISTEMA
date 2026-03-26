import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL UI ERROR:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isEnvError = this.state.error?.message?.includes("VITE_SUPABASE");
      
      return (
        <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4 text-white font-sans">
          <div className="max-w-md w-full bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl text-center space-y-6">
            <div className={`h-20 w-20 ${isEnvError ? 'bg-amber-500/20' : 'bg-red-500/20'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isEnvError ? (
                <ShieldAlert className="h-10 w-10 text-amber-500" />
              ) : (
                <AlertCircle className="h-10 w-10 text-red-500" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold">
              {isEnvError ? "Configuración Requerida" : "Algo salió mal"}
            </h1>
            
            <div className="bg-black/40 p-4 rounded-xl text-left border border-white/5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Detalles del Error:</p>
              <p className="text-sm font-mono text-amber-200/80 break-words">
                {this.state.error?.message || "Error inesperado no identificado."}
              </p>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {isEnvError 
                ? "Este error ocurre cuando faltan las variables de conexión con la base de datos en Vercel. Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY."
                : "Se ha producido un error durante la renderización de la interfaz. Puedes intentar recargar la aplicación."}
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-6 font-bold"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Recargar Sistema
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full border-white/10 hover:bg-white/5 text-gray-300 rounded-xl"
              >
                Volver al Inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
