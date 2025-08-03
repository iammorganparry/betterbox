import { beforeEach, describe, expect, it, vi } from "vitest";
import drizzleMock from "../../../test/setup";
import { UnipileAccountService } from "../accounts";

describe("UnipileAccountService", () => {
	let service: UnipileAccountService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new UnipileAccountService(drizzleMock);
	});

	describe("findByAccountId", () => {
		it("should find account without user when includeUser is false", async () => {
			const mockAccount = {
				id: "account-1",
				user_id: "user-1",
				provider: "linkedin",
				account_id: "linkedin-123",
				status: "connected",
				is_deleted: false,
			};

			drizzleMock.query.unipileAccounts.findFirst.mockResolvedValue(
				mockAccount,
			);

			const result = await service.findByAccountId(
				"linkedin-123",
				"linkedin",
				false,
			);

			expect(drizzleMock.query.unipileAccounts.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function), // and() function
			});
			expect(result).toEqual(mockAccount);
		});

		it("should find account with user when includeUser is true", async () => {
			const mockAccountWithUser = {
				id: "account-1",
				user_id: "user-1",
				provider: "linkedin",
				account_id: "linkedin-123",
				status: "connected",
				is_deleted: false,
				user: {
					id: "user-1",
					email: "test@example.com",
				},
			};

			drizzleMock.query.unipileAccounts.findFirst.mockResolvedValue(
				mockAccountWithUser,
			);

			const result = await service.findByAccountId(
				"linkedin-123",
				"linkedin",
				true,
			);

			expect(drizzleMock.query.unipileAccounts.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function),
				with: {
					user: true,
				},
			});
			expect(result).toEqual(mockAccountWithUser);
		});

		it("should return null when account not found", async () => {
			drizzleMock.query.unipileAccounts.findFirst.mockResolvedValue(undefined);

			const result = await service.findByAccountId(
				"linkedin-123",
				"linkedin",
				false,
			);

			expect(result).toBeNull();
		});
	});

	describe("findByUserId", () => {
		it("should find all accounts for a user", async () => {
			const mockAccounts = [
				{
					id: "account-1",
					user_id: "user-1",
					provider: "linkedin",
					account_id: "linkedin-123",
					status: "connected",
					is_deleted: false,
				},
				{
					id: "account-2",
					user_id: "user-1",
					provider: "whatsapp",
					account_id: "whatsapp-456",
					status: "connected",
					is_deleted: false,
				},
			];

			drizzleMock.query.unipileAccounts.findMany.mockResolvedValue(
				mockAccounts,
			);

			const result = await service.findByUserId("user-1");

			expect(drizzleMock.query.unipileAccounts.findMany).toHaveBeenCalledWith({
				where: expect.any(Function),
				orderBy: expect.any(Array),
			});
			expect(result).toEqual(mockAccounts);
		});
	});

	describe("create", () => {
		it("should create a new account", async () => {
			const createData = {
				user_id: "user-1",
				provider: "linkedin",
				account_id: "linkedin-123",
			};

			const createdAccount = {
				id: "account-1",
				...createData,
				status: "connected",
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			drizzleMock
				.insert()
				.values()
				.returning.mockResolvedValue([createdAccount]);

			const result = await service.create(createData);

			expect(drizzleMock.insert).toHaveBeenCalledWith(expect.any(Object)); // unipileAccounts table
			expect(drizzleMock.insert().values).toHaveBeenCalledWith({
				...createData,
				status: "connected",
			});
			expect(result).toEqual(createdAccount);
		});

		it("should throw error when creation fails", async () => {
			drizzleMock.insert().values().returning.mockResolvedValue([]);

			await expect(
				service.create({
					user_id: "user-1",
					provider: "linkedin",
					account_id: "linkedin-123",
				}),
			).rejects.toThrow("Failed to create unipile account");
		});
	});

	describe("update", () => {
		it("should update an account", async () => {
			const updateData = { status: "disconnected" as const };
			const updatedAccount = {
				id: "account-1",
				user_id: "user-1",
				provider: "linkedin",
				account_id: "linkedin-123",
				status: "disconnected",
				is_deleted: false,
			};

			drizzleMock
				.update()
				.set()
				.where()
				.returning.mockResolvedValue([updatedAccount]);

			const result = await service.update("account-1", updateData);

			expect(drizzleMock.update).toHaveBeenCalledWith(expect.any(Object)); // unipileAccounts table
			expect(drizzleMock.update().set).toHaveBeenCalledWith({
				...updateData,
				updated_at: expect.any(Date),
			});
			expect(result).toEqual(updatedAccount);
		});
	});

	describe("delete", () => {
		it("should soft delete an account", async () => {
			const deletedAccount = {
				id: "account-1",
				user_id: "user-1",
				provider: "linkedin",
				account_id: "linkedin-123",
				status: "connected",
				is_deleted: true,
			};

			drizzleMock
				.update()
				.set()
				.where()
				.returning.mockResolvedValue([deletedAccount]);

			const result = await service.delete("account-1");

			expect(drizzleMock.update).toHaveBeenCalledWith(expect.any(Object));
			expect(drizzleMock.update().set).toHaveBeenCalledWith({
				is_deleted: true,
				updated_at: expect.any(Date),
			});
			expect(result).toEqual(deletedAccount);
		});
	});

	describe("getAccountStats", () => {
		it("should return account statistics", async () => {
			const mockAccounts = [
				{
					id: "account-1",
					user_id: "user-1",
					provider: "linkedin",
					account_id: "linkedin-123",
					status: "connected",
					is_deleted: false,
				},
				{
					id: "account-2",
					user_id: "user-1",
					provider: "linkedin",
					account_id: "linkedin-456",
					status: "disconnected",
					is_deleted: false,
				},
				{
					id: "account-3",
					user_id: "user-1",
					provider: "whatsapp",
					account_id: "whatsapp-789",
					status: "connected",
					is_deleted: false,
				},
			];

			drizzleMock.query.unipileAccounts.findMany.mockResolvedValue(
				mockAccounts,
			);

			const result = await service.getAccountStats("user-1");

			expect(result).toEqual({
				total: 3,
				byProvider: {
					linkedin: 2,
					whatsapp: 1,
				},
				connected: 2,
				disconnected: 1,
			});
		});
	});
});
