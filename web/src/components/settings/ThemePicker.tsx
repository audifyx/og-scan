import { Card } from "@/components/ui/card";

export const ThemePicker = () => {

  return (
    <div className="space-y-6">
      <Card className="p-5 glass-card border-border/30">
        <h3 className="font-semibold mb-3 text-foreground">Theme System Disabled</h3>
        <p className="text-sm text-muted-foreground">The theme system has been removed from this application.</p>
      </Card>
    </div>
  );
};
