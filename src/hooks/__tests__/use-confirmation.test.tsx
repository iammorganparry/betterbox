import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useConfirmation } from "../use-confirmation";

// Test component that uses the hook
function TestComponent() {
  const { confirm, ConfirmationDialog } = useConfirmation();

  const handleSyncAction = async () => {
    await confirm(
      () => {
        console.log("Sync action executed");
      },
      {
        title: "Sync Action",
        description: "This is a sync action",
        confirmText: "Execute",
        variant: "destructive",
      }
    );
  };

  const handleAsyncAction = async () => {
    await confirm(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        console.log("Async action executed");
      },
      {
        title: "Async Action",
        description: "This is an async action",
        confirmText: "Execute",
        variant: "default",
      }
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleSyncAction}
        data-testid="sync-button"
      >
        Sync Action
      </button>
      <button
        type="button"
        onClick={handleAsyncAction}
        data-testid="async-button"
      >
        Async Action
      </button>
      <ConfirmationDialog />
    </div>
  );
}

describe("useConfirmation", () => {
  it("should render confirmation dialog when confirm is called", async () => {
    render(<TestComponent />);

    const syncButton = screen.getByTestId("sync-button");
    fireEvent.click(syncButton);

    await waitFor(() => {
      // Check for dialog-specific elements, not button text
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("This is a sync action")).toBeInTheDocument();
      expect(screen.getByText("Execute")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  it("should close dialog when cancel is clicked", async () => {
    render(<TestComponent />);

    const syncButton = screen.getByTestId("sync-button");
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should execute action and close dialog when confirm is clicked", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<TestComponent />);

    const syncButton = screen.getByTestId("sync-button");
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText("Execute")).toBeInTheDocument();
    });

    const executeButton = screen.getByText("Execute");
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Sync action executed");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("should handle async actions with loading state", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<TestComponent />);

    const asyncButton = screen.getByTestId("async-button");
    fireEvent.click(asyncButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const executeButton = screen.getByText("Execute");
    fireEvent.click(executeButton);

    // Check that loading state is shown
    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    // Wait for async action to complete
    await waitFor(
      () => {
        expect(consoleSpy).toHaveBeenCalledWith("Async action executed");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      },
      { timeout: 200 }
    );

    consoleSpy.mockRestore();
  });

  it("should use destructive variant for delete actions", async () => {
    render(<TestComponent />);

    const syncButton = screen.getByTestId("sync-button");
    fireEvent.click(syncButton);

    await waitFor(() => {
      const executeButton = screen.getByText("Execute");
      // Check that the button has the destructive background class
      expect(executeButton).toHaveClass("bg-destructive");
    });
  });
});
