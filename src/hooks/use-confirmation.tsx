"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface ConfirmationOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  variant: "default" | "destructive";
  onConfirm: (() => void) | (() => Promise<void>) | null;
  onCancel: (() => void) | null;
  isLoading: boolean;
}

export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: "Are you sure?",
    description: "This action cannot be undone.",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "default",
    onConfirm: null,
    onCancel: null,
    isLoading: false,
  });

  const confirm = useCallback(
    (
      action: (() => void) | (() => Promise<void>),
      options: ConfirmationOptions = {}
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          isOpen: true,
          title: options.title ?? "Are you sure?",
          description: options.description ?? "This action cannot be undone.",
          confirmText: options.confirmText ?? "Confirm",
          cancelText: options.cancelText ?? "Cancel",
          variant: options.variant ?? "default",
          onConfirm: action,
          onCancel: () => resolve(false),
          isLoading: false,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!state.onConfirm) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = state.onConfirm();

      // Check if it's a Promise (async operation)
      if (result instanceof Promise) {
        await result;
      }

      setState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
    } catch (error) {
      console.error("Confirmation action failed:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      // Keep dialog open on error so user can see what happened
    }
  }, [state.onConfirm]);

  const handleCancel = useCallback(() => {
    if (state.onCancel) {
      state.onCancel();
    }
    setState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
  }, [state.onCancel]);

  const ConfirmationDialog = useCallback(() => {
    return (
      <Dialog
        open={state.isOpen}
        onOpenChange={(open: boolean) => !open && handleCancel()}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            <DialogDescription>{state.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={state.isLoading}
            >
              {state.cancelText}
            </Button>
            <Button
              variant={state.variant}
              onClick={handleConfirm}
              disabled={state.isLoading}
            >
              {state.isLoading ? "Processing..." : state.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [state, handleConfirm, handleCancel]);

  return {
    confirm,
    ConfirmationDialog,
  };
}
