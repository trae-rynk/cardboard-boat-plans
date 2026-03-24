CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`productTier` enum('basic','premium') NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(120),
	`body` text,
	`displayName` varchar(100),
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `guestReviewToken` varchar(128);--> statement-breakpoint
ALTER TABLE `orders` ADD `reviewEmailSentAt` timestamp;