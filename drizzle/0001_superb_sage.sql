ALTER TABLE "Message" RENAME TO "message";--> statement-breakpoint
ALTER TABLE "Post" RENAME TO "post";--> statement-breakpoint
ALTER TABLE "ProfileView" RENAME TO "profile_view";--> statement-breakpoint
ALTER TABLE "Profile" RENAME TO "profile";--> statement-breakpoint
ALTER TABLE "UnipileAccount" RENAME TO "unipile_account";--> statement-breakpoint
ALTER TABLE "UnipileChat" RENAME TO "unipile_chat";--> statement-breakpoint
ALTER TABLE "UnipileContact" RENAME TO "unipile_contact";--> statement-breakpoint
ALTER TABLE "User" RENAME TO "user";--> statement-breakpoint
ALTER TABLE "ChatFolderAssignment" RENAME TO "chat_folder_assignment";--> statement-breakpoint
ALTER TABLE "ChatFolder" RENAME TO "chat_folder";--> statement-breakpoint
ALTER TABLE "PaymentMethod" RENAME TO "payment_method";--> statement-breakpoint
ALTER TABLE "Subscription" RENAME TO "subscription";--> statement-breakpoint
ALTER TABLE "UnipileChatAttendee" RENAME TO "unipile_chat_attendee";--> statement-breakpoint
ALTER TABLE "UnipileMessageAttachment" RENAME TO "unipile_message_attachment";--> statement-breakpoint
ALTER TABLE "UnipileMessage" RENAME TO "unipile_message";--> statement-breakpoint
ALTER TABLE "UnipileProfileView" RENAME TO "unipile_profile_view";--> statement-breakpoint
ALTER TABLE "profile" DROP CONSTRAINT "Profile_linkedin_urn_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "User_email_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "User_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "payment_method" DROP CONSTRAINT "PaymentMethod_stripe_payment_method_id_unique";--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "Subscription_user_id_unique";--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "Subscription_stripe_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "message" DROP CONSTRAINT "Message_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "profile_view" DROP CONSTRAINT "ProfileView_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_account" DROP CONSTRAINT "UnipileAccount_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_chat" DROP CONSTRAINT "UnipileChat_unipile_account_id_UnipileAccount_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_contact" DROP CONSTRAINT "UnipileContact_unipile_account_id_UnipileAccount_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_folder_assignment" DROP CONSTRAINT "ChatFolderAssignment_chat_id_UnipileChat_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_folder_assignment" DROP CONSTRAINT "ChatFolderAssignment_folder_id_ChatFolder_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_folder_assignment" DROP CONSTRAINT "ChatFolderAssignment_assigned_by_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_folder" DROP CONSTRAINT "ChatFolder_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_method" DROP CONSTRAINT "PaymentMethod_subscription_id_Subscription_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "Subscription_user_id_User_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_chat_attendee" DROP CONSTRAINT "UnipileChatAttendee_chat_id_UnipileChat_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_chat_attendee" DROP CONSTRAINT "UnipileChatAttendee_contact_id_UnipileContact_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_message_attachment" DROP CONSTRAINT "UnipileMessageAttachment_message_id_UnipileMessage_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_message" DROP CONSTRAINT "UnipileMessage_unipile_account_id_UnipileAccount_id_fk";
--> statement-breakpoint
ALTER TABLE "unipile_message" DROP CONSTRAINT "UnipileMessage_chat_id_UnipileChat_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "Post_name_idx";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message" ADD CONSTRAINT "message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_view" ADD CONSTRAINT "profile_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_account" ADD CONSTRAINT "unipile_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat" ADD CONSTRAINT "unipile_chat_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_contact" ADD CONSTRAINT "unipile_contact_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_folder_id_chat_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folder"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder" ADD CONSTRAINT "chat_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat_attendee" ADD CONSTRAINT "unipile_chat_attendee_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat_attendee" ADD CONSTRAINT "unipile_chat_attendee_contact_id_unipile_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."unipile_contact"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message_attachment" ADD CONSTRAINT "unipile_message_attachment_message_id_unipile_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."unipile_message"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message" ADD CONSTRAINT "unipile_message_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message" ADD CONSTRAINT "unipile_message_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_name_idx" ON "post" USING btree ("name");--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_linkedin_urn_unique" UNIQUE("linkedin_urn");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id");--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");