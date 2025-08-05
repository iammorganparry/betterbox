import type { InferSelectModel } from "drizzle-orm";
import type { unipileProfileViews } from "./schema";

export type UnipileProfileView = InferSelectModel<typeof unipileProfileViews>;
