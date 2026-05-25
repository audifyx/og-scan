import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  showBack?: boolean;
}

export const PageHeader = ({ title, description, children, showBack = true }: PageHeaderProps) => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/[0.07]">
      <div className="px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 text-white/70" />
              </button>
            )}
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
      </div>
    </header>
  );
};
