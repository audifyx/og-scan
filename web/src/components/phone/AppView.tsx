import { StatusBar } from "./StatusBar";
import { ChevronLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface AppViewProps {
  children: ReactNode;
  title?: string;
}

export const AppView = ({ children, title }: AppViewProps) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[170] bg-background/90 backdrop-blur-sm flex flex-col animate-scale-in">
      <StatusBar />

      {/* App header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-primary active:opacity-60 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        {title && <span className="text-sm font-semibold font-display tracking-wide">{title}</span>}
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-lg text-muted-foreground active:opacity-60 transition-opacity"
        >
          <Home className="h-4 w-4" />
        </button>
      </div>

      {/* App content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* Home indicator bar */}
      <div className="flex justify-center pb-2 pt-1 bg-background">
        <div className="w-32 h-1 rounded-full bg-foreground/20" />
      </div>
    </div>
  );
};
