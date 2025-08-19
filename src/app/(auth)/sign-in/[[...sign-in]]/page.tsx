import { SignIn } from "@clerk/nextjs";
import { GalleryVerticalEnd } from "lucide-react";

export default function LoginPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-8">
				<div className="flex justify-center">
					<a href="/" className="flex items-center gap-2 font-medium">
						<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
							<GalleryVerticalEnd className="size-4" />
						</div>
						betterbox
					</a>
				</div>
				<div className="w-full">
					<SignIn signUpFallbackRedirectUrl="/" />
				</div>
			</div>
		</div>
	);
}
