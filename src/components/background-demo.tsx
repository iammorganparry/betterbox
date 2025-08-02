"use client";

import * as React from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

/**
 * Demo component showing how the persistent gradient background
 * works throughout the app with frosted glass elements
 */
export function BackgroundDemo() {
    const [showContent, setShowContent] = React.useState(false);

    return (
        <div className="min-h-screen p-8 space-y-8">
            {/* Demo Header */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold">Persistent Background Demo</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    The subtle gradient orbs are now persistent throughout the entire app.
                    They appear as a fixed background on the body element, creating a
                    beautiful atmospheric effect behind all content.
                </p>
            </div>

            {/* Interactive Demo */}
            <div className="max-w-4xl mx-auto space-y-6">
                <Card className="p-6">
                    <h2 className="text-2xl font-semibold mb-4">Frosted Glass Cards</h2>
                    <p className="text-muted-foreground mb-4">
                        These cards use the frosted glass effect with backdrop-blur,
                        allowing the background gradients to show through beautifully.
                    </p>
                    <Button
                        onClick={() => setShowContent(!showContent)}
                        className="glass-subtle hover:glass transition-all duration-300"
                    >
                        {showContent ? "Hide" : "Show"} More Content
                    </Button>
                </Card>

                {showContent && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="p-6">
                            <h3 className="font-semibold text-lg mb-2">Dashboard</h3>
                            <p className="text-muted-foreground text-sm">
                                Main app dashboard with analytics and overview
                            </p>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-semibold text-lg mb-2">Inbox</h3>
                            <p className="text-muted-foreground text-sm">
                                Message management and communication center
                            </p>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-semibold text-lg mb-2">Settings</h3>
                            <p className="text-muted-foreground text-sm">
                                User preferences and configuration options
                            </p>
                        </Card>
                    </div>
                )}

                {/* Background Information */}
                <Card className="p-6 glass-strong">
                    <h3 className="font-semibold text-lg mb-4">Background Implementation</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-pink-400 mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-foreground">Fixed Attachment:</strong> Background stays in place during scrolling
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-foreground">Global Coverage:</strong> Applied to body element for app-wide visibility
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-foreground">Transparent Containers:</strong> Main content areas have transparent backgrounds
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-foreground">Glass Effects:</strong> Frosted glass components enhance the background visibility
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Color Palette */}
                <Card className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Gradient Color Palette</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center space-y-2">
                            <div className="w-full h-16 rounded-lg gradient-orb-pink opacity-80"></div>
                            <p className="text-sm font-medium">Pink Gradient</p>
                            <p className="text-xs text-muted-foreground">Bottom left (20%, 80%)</p>
                        </div>
                        <div className="text-center space-y-2">
                            <div className="w-full h-16 rounded-lg gradient-orb-purple opacity-80"></div>
                            <p className="text-sm font-medium">Purple Gradient</p>
                            <p className="text-xs text-muted-foreground">Top right (80%, 20%)</p>
                        </div>
                        <div className="text-center space-y-2">
                            <div className="w-full h-16 rounded-lg gradient-orb-blue opacity-80"></div>
                            <p className="text-sm font-medium">Blue Gradient</p>
                            <p className="text-xs text-muted-foreground">Center (40%, 40%)</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Utility Info */}
            <div className="max-w-2xl mx-auto">
                <Card className="p-6 glass-subtle">
                    <h3 className="font-semibold mb-3">Available Utilities</h3>
                    <div className="space-y-2 text-sm">
                        <code className="bg-muted px-2 py-1 rounded">.app-background</code>
                        <span className="text-muted-foreground"> - Apply background to any element</span>
                        <br />
                        <code className="bg-muted px-2 py-1 rounded">.glass</code>
                        <span className="text-muted-foreground"> - Standard frosted glass effect</span>
                        <br />
                        <code className="bg-muted px-2 py-1 rounded">.glass-strong</code>
                        <span className="text-muted-foreground"> - Enhanced glass effect</span>
                        <br />
                        <code className="bg-muted px-2 py-1 rounded">.glass-subtle</code>
                        <span className="text-muted-foreground"> - Light glass effect</span>
                    </div>
                </Card>
            </div>
        </div>
    );
}