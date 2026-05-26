import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const Terms = () => (
  <AppLayout>
    <PageHeader title="Terms of Use" description="Last updated: April 2026" />
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        {[
          { title: "1. Acceptance of Terms", content: "By accessing or using Sol Tools, you agree to these Terms of Use. If you do not agree, you must not use the platform. Sol Tools reserves the right to update these terms at any time." },
          { title: "2. Platform Description", content: "Sol Tools is a free Solana blockchain analytics and trading toolkit. It provides wallet tracking, token analysis, social trading lobbies, and community features. The platform is funded by the $SOLTOOLS token." },
          { title: "3. User Accounts", content: "Users must provide a valid email to create an account. You are responsible for maintaining account security. Sharing accounts is prohibited. Sol Tools may suspend accounts that violate these terms." },
          { title: "4. Platform Access", content: "Sol Tools is free to use. Users have access to all tools and features without paywalls or subscription fees. The platform is supported by the $SOLTOOLS ecosystem." },
          { title: "5. Acceptable Use", content: "Users must not:  spam communities or chat, impersonate others, share malicious content, attempt to exploit platform vulnerabilities, or use automated bots without authorization." },
          { title: "6. Communities & Social Features", content: "Users can create and join communities, post content, and participate in voice chat. Community creators can moderate their spaces. Sol Tools reserves the right to remove harmful content." },
          { title: "7. No Financial Advice", content: "Sol Tools provides analytical tools and data only. Nothing on this platform constitutes financial, investment, or trading advice. Cryptocurrency markets are volatile and carry significant risk of loss." },
          { title: "8. Risk Disclaimer", content: "Trading cryptocurrencies involves substantial risk. You may lose some or all of your investment. Past performance is not indicative of future results. You are solely responsible for your trading decisions." },
          { title: "9. Intellectual Property", content: "All Sol Tools branding, code, and content are owned by the Sol Tools team. User-generated content remains the property of users, but Sol Tools has a license to display it on the platform." },
          { title: "10. Limitation of Liability", content: "Sol Tools is provided 'as is' without warranties. We are not liable for trading losses, data inaccuracies, service interruptions, or any damages arising from platform use." },
          { title: "11. Termination", content: "Sol Tools may suspend or terminate accounts at any time for violations of these terms. Users may delete their accounts at any time through Settings." },
          { title: "12. Contact", content: "For questions about these terms, contact us through in-app support or our Telegram community at t.me/soltoolsv2." },
        ].map((s, i) => (
          <Card key={i} className="glass-card">
            <CardHeader><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p></CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  </AppLayout>
);

export default Terms;
