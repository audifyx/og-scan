import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditsUsagePanel } from "@/components/credits/CreditsUsagePanel";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { 
  DollarSign, Bell, User, Shield, Webhook, Palette
} from "lucide-react";

const Settings = () => {
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [notifications, setNotifications] = useState({
    priceAlerts: true, whaleAlerts: true, walletActivity: true, creditWarnings: true,
  });

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Manage your account and preferences" />
      <div className="p-4 lg:p-6 relative z-10">
        <Tabs defaultValue="themes" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-5 bg-muted/50 mb-6">
            <TabsTrigger value="themes" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Themes</span>
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Credits</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Webhook className="h-4 w-4" />
              <span className="hidden sm:inline">Hooks</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="themes">
            <div className="max-w-4xl">
              <ThemePicker />
            </div>
          </TabsContent>

          <TabsContent value="credits">
            <div className="max-w-3xl"><CreditsUsagePanel /></div>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="p-6 max-w-2xl glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Notification Preferences
              </h3>
              <div className="space-y-4">
                {[
                  { key: "priceAlerts", label: "Price Alerts", desc: "Get notified when token prices hit your targets" },
                  { key: "whaleAlerts", label: "Whale Alerts", desc: "Track large wallet movements" },
                  { key: "walletActivity", label: "Wallet Activity", desc: "Updates from tracked wallets" },
                  { key: "creditWarnings", label: "Credit Warnings", desc: "Alert when credits are running low" },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between">
                    <div>
                      <Label>{n.label}</Label>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[n.key as keyof typeof notifications]}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, [n.key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card className="p-6 max-w-2xl glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" /> Discord Webhook
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <p className="text-xs text-muted-foreground mb-2">Enter your Discord webhook URL to receive alerts</p>
                  <Input placeholder="https://discord.com/api/webhooks/..." value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} />
                </div>
                <Button className="btn-3d">Save Webhook</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card className="p-6 max-w-2xl glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Account Security
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input disabled placeholder="user@example.com" className="mt-1" />
                </div>
                <Button variant="outline" className="btn-3d">Change Password</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
