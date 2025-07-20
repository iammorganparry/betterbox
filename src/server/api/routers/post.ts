import { z } from "zod";

import {
	createTRPCRouter,
	publicProcedure,
	protectedProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ text: z.string() }))
		.query(({ input }) => {
			return {
				greeting: `Hello ${input.text}`,
			};
		}),

	create: protectedProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.post.create({
				data: {
					name: input.name,
				},
			});
		}),

	getSecretMessage: protectedProcedure.query(() => {
		return "You can now see this secret message!";
	}),

	getLatest: publicProcedure.query(async ({ ctx }) => {
		const post = await ctx.db.post.findFirst({
			orderBy: { createdAt: "desc" },
		});

		return post ?? null;
	}),
});
