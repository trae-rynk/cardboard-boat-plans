CREATE TABLE `downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`assetType` enum('pdf_plans','video_series','design_hacks') NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`fileSizeBytes` int,
	`downloadCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `downloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `downloads_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`productTier` enum('basic','premium') NOT NULL,
	`amountCents` int NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`stripeClientSecret` varchar(512),
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
