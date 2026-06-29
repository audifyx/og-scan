import { Card } from "@/components/ui/card";



export const CustomThemeCreator = () => {
  return (
    <Card className="p-5 glass-card border-border/30">
      <h3 className="font-semibold mb-3 text-foreground">Custom Theme Creator Disabled</h3>
      <p className="text-sm text-muted-foreground">The custom theme system has been removed from this application.</p>
    </Card>
  );
};
