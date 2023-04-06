/*
  Warnings:

  - Made the column `room_user_count` on table `room` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `room` MODIFY `room_user_count` INTEGER NOT NULL DEFAULT 1;
