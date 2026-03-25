CREATE TABLE `chatEntitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`chatToken` varchar(128) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`messageCount` int NOT NULL DEFAULT 0,
	`messageLimit` int NOT NULL DEFAULT 1000,
	`extensionCount` int NOT NULL DEFAULT 0,
	`status` enum('active','expired','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatEntitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `chatEntitlements_chatToken_unique` UNIQUE(`chatToken`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entitlementId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `reviewEmailScheduledAt` timestamp;