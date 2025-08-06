import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function truncate(text: string, length: number) {
	return text.length > length ? `${text.slice(0, length)}...` : text;
}
