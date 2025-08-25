import { setupServer } from "msw/node";
import { unipileHandlers } from "./handlers/unipile";

// Create MSW server for Node.js environment
export const server = setupServer(...unipileHandlers);
