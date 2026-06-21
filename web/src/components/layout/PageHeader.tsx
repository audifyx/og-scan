import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  showBack?: boolean;
  backTo?: string; // explicit back destination, defaults to browser history
}

export const PageHeader = ({ title, description, children, showBack = true, backTo }: PageHeaderProps) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/[0.07]">
      <div className="relative px-4 py-4 lg:px-6">
        <div className="flex items-center justify-center">
          {showBack && (
            <button
              onClick={handleBack}
              className="absolute left-4 lg:left-6 flex items-center gap-1.5 px-2 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              {backTo && <span className="text-[11px] font-semibold hidden sm:inline">Back</span>}
            </button>
          )}
          <div className="text-center">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight gradient-text">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {children && <div className="absolute right-4 lg:right-6 flex items-center gap-2">{children}</div>}
        </div>
      </div>
    </header>
  );
};
