-- AlterTable
ALTER TABLE "StatementImport" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileSize" INTEGER;
