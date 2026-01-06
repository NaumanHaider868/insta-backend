/*
  Warnings:

  - You are about to drop the column `discountPercentage` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `productimage` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `productimage` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `productvariant` table. All the data in the column will be lost.
  - You are about to drop the column `stockCount` on the `productvariant` table. All the data in the column will be lost.
  - Added the required column `variantId` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `productimage` DROP FOREIGN KEY `ProductImage_productId_fkey`;

-- DropIndex
DROP INDEX `ProductImage_productId_fkey` ON `productimage`;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `discountPercentage`,
    ADD COLUMN `discountPercent` DECIMAL(65, 30) NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `productimage` DROP COLUMN `color`,
    DROP COLUMN `productId`,
    ADD COLUMN `variantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `productvariant` DROP COLUMN `size`,
    DROP COLUMN `stockCount`;

-- CreateTable
CREATE TABLE `ProductSize` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variantId` INTEGER NOT NULL,
    `size` VARCHAR(191) NOT NULL,
    `stockCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSize` ADD CONSTRAINT `ProductSize_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
