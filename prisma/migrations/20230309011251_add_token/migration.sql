/*
  Warnings:

  - Added the required column `admin_token` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `token` ADD COLUMN `admin_token` MEDIUMTEXT NOT NULL;
