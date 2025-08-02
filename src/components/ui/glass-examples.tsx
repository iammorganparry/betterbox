import * as React from "react";
import { cn } from "~/lib/utils";

/**
 * Example components showcasing different frosted glass utilities
 * Using Tailwind's backdrop-blur utilities as documented at:
 * https://tailwindcss.com/docs/backdrop-filter-blur
 */

export function GlassCard({
    children,
    variant = "default",
    className,
    ...props
}: React.ComponentProps<"div"> & {
    variant?: "default" | "strong" | "subtle" | "white";
}) {
    const variants = {
        default: "glass",
        strong: "glass-strong",
        subtle: "glass-subtle",
        white: "glass-white",
    };

    return (
        <div
            className={cn(
                "rounded-xl p-6",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function GlassPanel({
    children,
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "glass-card rounded-2xl p-8",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function GlassNavbar({
    children,
    className,
    ...props
}: React.ComponentProps<"nav">) {
    return (
        <nav
            className={cn(
                "glass-subtle fixed top-0 left-0 right-0 z-50 px-6 py-4",
                className
            )}
            {...props}
        >
            {children}
        </nav>
    );
}

export function GlassModal({
    children,
    isOpen,
    onClose,
    className,
    ...props
}: React.ComponentProps<"div"> & {
    isOpen: boolean;
    onClose: () => void;
}) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 backdrop-blur-sm bg-black/20" />

            {/* Modal Content */}
            <div
                className={cn(
                    "glass-strong relative max-w-md w-full rounded-2xl p-6",
                    className
                )}
                onClick={(e) => e.stopPropagation()}
                {...props}
            >
                {children}
            </div>
        </div>
    );
}

// Example usage component for testing
export function GlassShowcase() {
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    return (
        <div className="space-y-8 p-8">
            <h2 className="text-2xl font-bold text-center">Frosted Glass Examples</h2>

            {/* Different glass variants */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GlassCard variant="subtle">
                    <h3 className="font-semibold mb-2">Subtle Glass</h3>
                    <p className="text-sm text-muted-foreground">
                        backdrop-blur-lg with light opacity
                    </p>
                </GlassCard>

                <GlassCard variant="default">
                    <h3 className="font-semibold mb-2">Default Glass</h3>
                    <p className="text-sm text-muted-foreground">
                        backdrop-blur-xl with medium opacity
                    </p>
                </GlassCard>

                <GlassCard variant="strong">
                    <h3 className="font-semibold mb-2">Strong Glass</h3>
                    <p className="text-sm text-muted-foreground">
                        backdrop-blur-2xl with higher opacity
                    </p>
                </GlassCard>

                <GlassCard variant="white">
                    <h3 className="font-semibold mb-2 text-gray-800">White Glass</h3>
                    <p className="text-sm text-gray-600">
                        High opacity white for light themes
                    </p>
                </GlassCard>
            </div>

            {/* Panel example */}
            <GlassPanel>
                <h3 className="text-xl font-semibold mb-4">Glass Panel</h3>
                <p className="text-muted-foreground mb-4">
                    This panel uses the glass-card utility for a strong frosted glass effect
                    perfect for main content areas.
                </p>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="glass-subtle px-4 py-2 rounded-lg hover:glass transition-all duration-300"
                >
                    Open Glass Modal
                </button>
            </GlassPanel>

            {/* Modal example */}
            <GlassModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            >
                <h3 className="text-lg font-semibold mb-4">Glass Modal</h3>
                <p className="text-muted-foreground mb-4">
                    This modal demonstrates backdrop-blur effects with a glass panel
                    floating over a blurred background.
                </p>
                <button
                    onClick={() => setIsModalOpen(false)}
                    className="glass-subtle px-4 py-2 rounded-lg w-full hover:glass transition-all duration-300"
                >
                    Close
                </button>
            </GlassModal>
        </div>
    );
}