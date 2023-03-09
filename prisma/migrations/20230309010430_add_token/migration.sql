-- CreateTable
CREATE TABLE `Token` (
    `token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_email` VARCHAR(191) NOT NULL,
    `access_token` MEDIUMTEXT NOT NULL,
    `refresh_token` MEDIUMTEXT NOT NULL,

    UNIQUE INDEX `Token_user_email_key`(`user_email`),
    PRIMARY KEY (`token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
