import axios, {
	type AxiosInstance,
	type AxiosRequestConfig,
	type AxiosResponse,
} from "axios";

/**
 * Default axios configuration
 */
const defaultConfig: AxiosRequestConfig = {
	timeout: 30000, // 30 seconds
	headers: {
		"Content-Type": "application/json",
	},
};

/**
 * Create a base HTTP client with default configuration
 */
export const httpClient = axios.create(defaultConfig);

/**
 * Create a configured HTTP client for Unipile API
 */
export function createUnipileClient(
	apiKey: string,
	dsn: string,
): AxiosInstance {
	return axios.create({
		...defaultConfig,
		baseURL: `https://${dsn}/api/v1`,
		headers: {
			...defaultConfig.headers,
			Authorization: `Bearer ${apiKey}`,
		},
	});
}

/**
 * Generic HTTP request wrapper with error handling
 */
export async function makeRequest<T = unknown>(
	config: AxiosRequestConfig,
): Promise<T> {
	try {
		const response: AxiosResponse<T> = await httpClient(config);
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			// Enhanced error information for debugging
			const errorMessage = error.response?.data?.message || error.message;
			const status = error.response?.status;

			throw new Error(`HTTP ${status || "Unknown"}: ${errorMessage}`);
		}
		throw error;
	}
}

/**
 * Convenient methods for common HTTP operations
 */
export const http = {
	get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
		makeRequest<T>({ ...config, method: "GET", url }),

	post: <T, TD>(
		url: string,
		data?: TD,
		config?: AxiosRequestConfig,
	): Promise<T> => makeRequest<T>({ ...config, method: "POST", url, data }),

	put: <T, TD>(
		url: string,
		data?: TD,
		config?: AxiosRequestConfig,
	): Promise<T> => makeRequest<T>({ ...config, method: "PUT", url, data }),

	patch: <T>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig,
	): Promise<T> => makeRequest<T>({ ...config, method: "PATCH", url, data }),

	delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
		makeRequest<T>({ ...config, method: "DELETE", url }),
};

/**
 * Request interceptor for logging (development only)
 */
if (process.env.NODE_ENV === "development") {
	httpClient.interceptors.request.use(
		(config) => {
			console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
			return config;
		},
		(error) => {
			console.error("❌ Request error:", error);
			return Promise.reject(error);
		},
	);
}

/**
 * Response interceptor for logging and error handling
 */
httpClient.interceptors.response.use(
	(response) => {
		if (process.env.NODE_ENV === "development") {
			console.log(`✅ ${response.status} ${response.config.url}`);
		}
		return response;
	},
	(error) => {
		if (process.env.NODE_ENV === "development") {
			console.error(
				`❌ ${error.response?.status || "Network"} ${error.config?.url}:`,
				error.response?.data || error.message,
			);
		}
		return Promise.reject(error);
	},
);

export default httpClient;
