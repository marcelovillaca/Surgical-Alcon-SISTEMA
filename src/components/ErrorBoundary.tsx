import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full glass p-8 rounded-2xl border border-destructive/20 shadow-2xl text-center space-y-6">
            <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Algo salió mal</h1>
            <p className="text-muted-foreground italic text-sm">
              "{this.state.error?.message || "Error inesperado en el sistema"}"
            </p>
            <p className="text-xs text-muted-foreground">
              Se ha registrado el error para el equipo técnico. Por favor, intenta recargar la página.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="w-full gradient-emerald"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Recargar Sistema
            </Button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}

export default ErrorBoundary;
