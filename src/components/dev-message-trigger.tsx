"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { MessageCircle, Send, Loader2, Zap, Code, X } from "lucide-react";
import { toast } from "sonner";
import {
  triggerIncomingMessageFromClient,
  isDevelopment,
} from "~/mocks/dev-triggers";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

interface DevMessageTriggerProps {
  chatId: string;
  accountId: string;
  onMessageTriggered?: () => void;
}

export function DevMessageTrigger({
  chatId,
  accountId,
  onMessageTriggered,
}: DevMessageTriggerProps) {
  // Don't render in production or when mocking is disabled
  if (!isDevelopment) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleTriggerMessage = async (text?: string) => {
    setIsLoading(true);

    try {
      const success = await triggerIncomingMessageFromClient(
        chatId,
        accountId,
        text
      );

      if (success) {
        toast.success("Mock incoming message triggered!");
        setCustomText("");
        onMessageTriggered?.();
      } else {
        toast.error("Failed to trigger message");
      }
    } catch (error) {
      console.error("Failed to trigger message:", error);
      toast.error("Failed to trigger message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerBurst = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/mock-unipile/dev-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "conversation_burst",
          chatId,
          accountId,
          messageCount: 3,
        }),
      });

      if (response.ok) {
        toast.success("Mock conversation burst triggered!");
        onMessageTriggered?.();
      } else {
        toast.error("Failed to trigger conversation burst");
      }
    } catch (error) {
      console.error("Failed to trigger burst:", error);
      toast.error("Failed to trigger conversation burst");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-20 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="glass-card border-orange-200/20 bg-orange-500/10 text-orange-600 shadow-lg backdrop-blur-sm hover:bg-orange-500/20"
          >
            <Code className="mr-2 h-4 w-4" />
            Dev Tools
            <Badge
              variant="secondary"
              className="ml-2 bg-orange-100/50 text-orange-700 text-xs"
            >
              MOCK
            </Badge>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <Card className="glass-card w-80 border-orange-200/20 bg-orange-50/10 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-medium text-orange-700 text-sm">
                  Mock Message Triggers
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-orange-600"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {/* Quick trigger button */}
              <div>
                <Button
                  onClick={() => handleTriggerMessage()}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="w-full border-orange-200/30 text-orange-700 hover:bg-orange-100/20"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <MessageCircle className="mr-2 h-3 w-3" />
                  )}
                  Random Incoming Message
                </Button>
              </div>

              {/* Custom message */}
              <div className="space-y-2">
                <Input
                  placeholder="Custom message text..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="border-orange-200/30 bg-white/50 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customText.trim()) {
                      handleTriggerMessage(customText.trim());
                    }
                  }}
                />
                <Button
                  onClick={() => handleTriggerMessage(customText.trim())}
                  disabled={isLoading || !customText.trim()}
                  size="sm"
                  variant="outline"
                  className="w-full border-orange-200/30 text-orange-700 hover:bg-orange-100/20"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-3 w-3" />
                  )}
                  Send Custom Message
                </Button>
              </div>

              {/* Conversation burst */}
              <div>
                <Button
                  onClick={handleTriggerBurst}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="w-full border-orange-200/30 text-orange-700 hover:bg-orange-100/20"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-3 w-3" />
                  )}
                  Conversation Burst (3 msgs)
                </Button>
              </div>

              <div className="border-orange-200/20 border-t pt-2">
                <p className="text-orange-600/70 text-xs">
                  Development only - triggers mock incoming messages via webhook
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
