import React from "react";
import { vi } from "vitest";

// Mock toast notifications
export const mockToast = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
};

export const mockSonnerModule = () => {
	vi.mock("sonner", () => ({
		toast: mockToast,
	}));

	return mockToast;
};

// Mock sidebar components
export const mockSidebarModule = () => {
	vi.mock("~/components/ui/sidebar", async () => {
		const actual = await vi.importActual("~/components/ui/sidebar");

		return {
			...actual,
			useSidebar: () => ({
				state: "expanded" as const,
				open: true,
				setOpen: vi.fn(),
				openMobile: false,
				setOpenMobile: vi.fn(),
				isMobile: false,
				toggleSidebar: vi.fn(),
			}),
		};
	});
};

// Mock mobile hook
export const mockMobileHook = (isMobile = false) => {
	vi.mock("~/hooks/use-mobile", () => ({
		useIsMobile: () => isMobile,
	}));
};

// Mock router hooks
export const mockNextRouter = (overrides: Partial<any> = {}) => {
	const mockRouter = {
		push: vi.fn(),
		replace: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
		pathname: "/",
		query: {},
		asPath: "/",
		...overrides,
	};

	vi.mock("next/navigation", () => ({
		useRouter: () => mockRouter,
		useParams: () => overrides.params || {},
		usePathname: () => mockRouter.pathname,
		useSearchParams: () => new URLSearchParams(),
	}));

	return mockRouter;
};

// Mock dropdown menu components
export const mockDropdownMenuModule = () => {
	vi.mock("~/components/ui/dropdown-menu", () => ({
		DropdownMenu: ({ children }: { children: React.ReactNode }) =>
			React.createElement("div", { "data-testid": "dropdown-menu" }, children),
		DropdownMenuTrigger: ({ children, ...props }: any) =>
			React.createElement("button", props, children),
		DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
			React.createElement(
				"div",
				{ "data-testid": "dropdown-menu-content" },
				children,
			),
		DropdownMenuItem: ({
			children,
			onClick,
		}: { children: React.ReactNode; onClick?: () => void }) =>
			React.createElement("div", { onClick, role: "menuitem" }, children),
	}));
};
