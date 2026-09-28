CREATE TABLE `Story` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('IMAGE', 'VIDEO', 'TEXT') NOT NULL,
    `mediaUrl` TEXT NULL,
    `text` TEXT NULL,
    `background` VARCHAR(191) NULL DEFAULT '#1e3a8a',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Story_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `Story_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StoryView` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `viewerId` VARCHAR(191) NOT NULL,
    `viewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StoryView_storyId_viewerId_key`(`storyId`, `viewerId`),
    INDEX `StoryView_viewerId_idx`(`viewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Story` ADD CONSTRAINT `Story_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StoryView` ADD CONSTRAINT `StoryView_storyId_fkey`
    FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StoryView` ADD CONSTRAINT `StoryView_viewerId_fkey`
    FOREIGN KEY (`viewerId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;