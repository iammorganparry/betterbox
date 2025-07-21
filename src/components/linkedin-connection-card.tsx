"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Linkedin, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";

// Form schemas
const credentialsSchema = z.object({
  username: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

const cookieSchema = z.object({
  li_at_token: z.string().min(1, "LinkedIn cookie token is required"),
});

const checkpointSchema = z.object({
  value: z.string().min(1, "Verification code is required"),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type CookieForm = z.infer<typeof cookieSchema>;
type CheckpointForm = z.infer<typeof checkpointSchema>;

interface LinkedInConnectionCardProps {
  userId: string;
}

type AuthMethod = "credentials" | "cookies";
type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "checkpoint"
  | "error";

export function LinkedInConnectionCard({
  userId,
}: LinkedInConnectionCardProps) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [checkpointInfo, setCheckpointInfo] = useState<{
    checkpointId: string;
    checkpointType: string;
    title: string;
    description: string;
    inputType: string;
  } | null>(null);

  // tRPC queries and mutations
  const { data: accountsData, refetch: refetchAccounts } =
    api.linkedin.getAccounts.useQuery();

  // Set connection state based on accounts data
  const hasConnectedAccounts =
    accountsData?.accounts && accountsData.accounts.length > 0;

  useEffect(() => {
    if (hasConnectedAccounts && connectionState === "disconnected") {
      setConnectionState("connected");
    }
  }, [hasConnectedAccounts, connectionState]);

  const authenticateWithCredentialsMutation =
    api.linkedin.authenticateWithCredentials.useMutation({
      onSettled: (result, error) => {
        if (error) {
          setError(error.message);
          setConnectionState("error");
          return;
        }

        if (result?.success) {
          if (result.checkpoint_type && result.checkpoint_id) {
            // Get checkpoint info
            const checkpointInfo = api.linkedin.getCheckpointInfo.useQuery({
              checkpointType: result.checkpoint_type,
            });

            if (checkpointInfo.data) {
              setCheckpointInfo({
                checkpointId: result.checkpoint_id,
                checkpointType: result.checkpoint_type,
                ...checkpointInfo.data,
              });
              setConnectionState("checkpoint");
            }
          } else {
            handleSuccessfulConnection();
          }
        } else {
          setError(result?.error || "Authentication failed");
          setConnectionState("error");
        }
      },
    });

  const authenticateWithCookiesMutation =
    api.linkedin.authenticateWithCookies.useMutation({
      onSettled: (result, error) => {
        if (error) {
          setError(error.message);
          setConnectionState("error");
          return;
        }

        if (result?.success) {
          if (result.checkpoint_type && result.checkpoint_id) {
            // Get checkpoint info
            const checkpointInfo = api.linkedin.getCheckpointInfo.useQuery({
              checkpointType: result.checkpoint_type,
            });

            if (checkpointInfo.data) {
              setCheckpointInfo({
                checkpointId: result.checkpoint_id,
                checkpointType: result.checkpoint_type,
                ...checkpointInfo.data,
              });
              setConnectionState("checkpoint");
            }
          } else {
            handleSuccessfulConnection();
          }
        } else {
          setError(result?.error || "Authentication failed");
          setConnectionState("error");
        }
      },
    });

  const resolveCheckpointMutation = api.linkedin.resolveCheckpoint.useMutation({
    onSettled: (result, error) => {
      if (error) {
        setError(error.message);
        setConnectionState("checkpoint");
        return;
      }

      if (result?.success) {
        handleSuccessfulConnection();
      } else {
        setError(result?.error || "Checkpoint resolution failed");
        setConnectionState("checkpoint");
      }
    },
  });

  const disconnectMutation = api.linkedin.disconnect.useMutation({
    onSettled: (result, error) => {
      if (error) {
        setError(error.message);
        setConnectionState("error");
        return;
      }

      if (result?.success) {
        setConnectionState("disconnected");
        setError(null);
        refetchAccounts();
      } else {
        setError(result?.error || "Failed to disconnect account");
        setConnectionState("error");
      }
    },
  });

  const getCheckpointInfoQuery = api.linkedin.getCheckpointInfo.useQuery(
    { checkpointType: "" },
    { enabled: false }
  );

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { username: "", password: "" },
  });

  const cookieForm = useForm<CookieForm>({
    resolver: zodResolver(cookieSchema),
    defaultValues: { li_at_token: "" },
  });

  const checkpointForm = useForm<CheckpointForm>({
    resolver: zodResolver(checkpointSchema),
    defaultValues: { value: "" },
  });

  const handleCredentialsAuth = async (data: CredentialsForm) => {
    setConnectionState("connecting");
    setError(null);
    authenticateWithCredentialsMutation.mutate(data);
  };

  const handleCookieAuth = async (data: CookieForm) => {
    setConnectionState("connecting");
    setError(null);
    authenticateWithCookiesMutation.mutate(data);
  };

  const handleCheckpointResolution = async (data: CheckpointForm) => {
    if (!checkpointInfo) return;

    setConnectionState("connecting");
    setError(null);
    resolveCheckpointMutation.mutate({
      checkpointId: checkpointInfo.checkpointId,
      checkpointType: checkpointInfo.checkpointType,
      value: data.value,
    });
  };

  const handleSuccessfulConnection = () => {
    setConnectionState("connected");
    setCheckpointInfo(null);
    setError(null);

    // Reset forms
    credentialsForm.reset();
    cookieForm.reset();
    checkpointForm.reset();

    // Refetch accounts to update UI
    refetchAccounts();
  };

  const handleDisconnect = async () => {
    if (!accountsData?.accounts[0]) return;

    setConnectionState("connecting");
    disconnectMutation.mutate({
      accountId: accountsData.accounts[0].account_id,
    });
  };

  const getStatusBadge = () => {
    switch (connectionState) {
      case "connected":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Connecting...
          </Badge>
        );
      case "checkpoint":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="mr-1 h-3 w-3" />
            Verification Required
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  // Determine connection state based on accounts data
  const connectedAccount = accountsData?.accounts[0];
  const isConnected = !!connectedAccount && connectionState !== "connecting";
  const isConnecting = connectionState === "connecting";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="h-6 w-6 text-blue-600" />
            LinkedIn
          </div>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          {isConnected
            ? "Sync your LinkedIn messages and connections"
            : "Connect your LinkedIn account to start syncing messages"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected && connectedAccount && (
          <div className="space-y-4">
            <div className="text-muted-foreground text-sm">
              <p>Account ID: {connectedAccount.account_id}</p>
              <p>
                Connected:{" "}
                {new Date(connectedAccount.created_at).toLocaleDateString()}
              </p>
              <p>Status: {connectedAccount.status}</p>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect Account"
              )}
            </Button>
          </div>
        )}

        {connectionState === "checkpoint" && checkpointInfo && (
          <Form {...checkpointForm}>
            <form
              onSubmit={checkpointForm.handleSubmit(handleCheckpointResolution)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <h4 className="font-medium">{checkpointInfo.title}</h4>
                <p className="text-muted-foreground text-sm">
                  {checkpointInfo.description}
                </p>
              </div>

              <FormField
                control={checkpointForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      {checkpointInfo.inputType === "numeric" ? (
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      ) : checkpointInfo.inputType === "none" ? (
                        <div className="rounded-md bg-muted p-4 text-sm">
                          Please check your LinkedIn mobile app and approve the
                          login request.
                        </div>
                      ) : (
                        <Input
                          type={checkpointInfo.inputType}
                          placeholder="Enter verification code"
                          {...field}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {checkpointInfo.inputType !== "none" && (
                <Button type="submit" disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              )}
            </form>
          </Form>
        )}

        {(connectionState === "disconnected" || connectionState === "error") &&
          !isConnected && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant={authMethod === "credentials" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("credentials")}
                >
                  Username & Password
                </Button>
                <Button
                  variant={authMethod === "cookies" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("cookies")}
                >
                  Cookie Token
                </Button>
              </div>

              <Separator />

              {authMethod === "credentials" && (
                <Form {...credentialsForm}>
                  <form
                    onSubmit={credentialsForm.handleSubmit(
                      handleCredentialsAuth
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={credentialsForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your.email@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={credentialsForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Your LinkedIn password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isConnecting}
                      className="w-full"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect LinkedIn"
                      )}
                    </Button>
                  </form>
                </Form>
              )}

              {authMethod === "cookies" && (
                <Form {...cookieForm}>
                  <form
                    onSubmit={cookieForm.handleSubmit(handleCookieAuth)}
                    className="space-y-4"
                  >
                    <FormField
                      control={cookieForm.control}
                      name="li_at_token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn Cookie Token (li_at)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="AQEDATXNiYMAAAGK..."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Open LinkedIn in your browser, go to DevTools →
                            Application → Cookies, and copy the li_at value.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isConnecting}
                      className="w-full"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect with Cookies"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
