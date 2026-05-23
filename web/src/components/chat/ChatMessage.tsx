import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bot, User, Wallet, TrendingUp, TrendingDown, Eye, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, Zap, Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface Message {
  id: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  content: string;
  message_type: string;
  wallet_address: string | null;
  metadata: any;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  onWalletClick: (address: string) => void;
  isOwnMessage: boolean;
}

export const ChatMessage = ({ message, onWalletClick, isOwnMessage }: ChatMessageProps) => {
  const isBot = message.message_type === "bot" || message.message_type === "wallet_alert";
  const isSystem = message.message_type === "system";
  const [sendingDiscord, setSendingDiscord] = useState(false);

  const sendToDiscord = async (alertType: string) => {
    setSendingDiscord(true);
    try {
      const meta = message.metadata || {};
      const { data, error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: alertType,
          walletAddress: message.wallet_address,
          tokenSymbol: meta.token_symbol,
          tokenAmount: meta.token_amount,
          usdValue: meta.usd_value,
          message: message.content,
          username: message.username,
          txSignature: meta.tx_signature,
        },
      });

      if (error) throw error;
      toast({ title: "Sent to Discord!", description: "Alert shared with the community" });
    } catch (error) {
      console.error("Discord error:", error);
      toast({ title: "Error", description: "Failed to send to Discord", variant: "destructive" });
    } finally {
      setSendingDiscord(false);
    }
  };

  // Format wallet alerts with special styling
  const renderBotMessage = () => {
    const meta = message.metadata || {};
    
    if (meta.action === "buy") {
      return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="p-2 rounded-lg bg-green-500/20">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-green-500">BUY ALERT</span>
              <Badge variant="outline" className="text-xs">
                {meta.token_symbol || "Token"}
              </Badge>
            </div>
            <p className="text-sm">{message.content}</p>
            <div className="flex items-center gap-2 mt-2">
              {message.wallet_address && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => onWalletClick(message.wallet_address!)}
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"
                onClick={() => sendToDiscord("buy")}
                disabled={sendingDiscord}
              >
                <Send className="h-3 w-3" />
                Discord
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (meta.action === "sell") {
      return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="p-2 rounded-lg bg-red-500/20">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-red-500">SELL ALERT</span>
              <Badge variant="outline" className="text-xs">
                {meta.token_symbol || "Token"}
              </Badge>
            </div>
            <p className="text-sm">{message.content}</p>
            <div className="flex items-center gap-2 mt-2">
              {message.wallet_address && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => onWalletClick(message.wallet_address!)}
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"
                onClick={() => sendToDiscord("sell")}
                disabled={sendingDiscord}
              >
                <Send className="h-3 w-3" />
                Discord
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (meta.action === "whale_alert") {
      return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="p-2 rounded-lg bg-primary/20">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-primary">WHALE ALERT</span>
              <Zap className="h-3 w-3 text-yellow-500" />
            </div>
            <p className="text-sm">{message.content}</p>
            <div className="flex items-center gap-2 mt-2">
              {message.wallet_address && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => onWalletClick(message.wallet_address!)}
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"
                onClick={() => sendToDiscord("whale_alert")}
                disabled={sendingDiscord}
              >
                <Send className="h-3 w-3" />
                Discord
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Default bot message (wallet_added)
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">SolanaBot</span>
            <Badge variant="secondary" className="text-xs">Bot</Badge>
          </div>
          <p className="text-sm">{message.content}</p>
          <div className="flex items-center gap-2 mt-2">
            {message.wallet_address && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onWalletClick(message.wallet_address!)}
              >
                <Eye className="h-3 w-3" />
                View
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"
              onClick={() => sendToDiscord(meta.action || "wallet_added")}
              disabled={sendingDiscord}
            >
              <Send className="h-3 w-3" />
              Discord
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (isBot) {
    return renderBotMessage();
  }

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  // Regular user message
  return (
    <div className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
      <div className="p-2 rounded-full bg-muted h-fit">
        {message.avatar_url ? (
          <img src={message.avatar_url} alt="" className="h-5 w-5 rounded-full" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </div>
      <div className={`max-w-[70%] ${isOwnMessage ? "items-end" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{message.username || "Anon"}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
};
