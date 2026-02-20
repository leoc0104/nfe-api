-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NFe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "access_key" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "issue_date" DATETIME NOT NULL,
    "issuer_name" TEXT NOT NULL,
    "issuer_cnpj" TEXT NOT NULL,
    "total_value" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NFeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "total_value" REAL NOT NULL,
    "nfe_id" TEXT NOT NULL,
    CONSTRAINT "NFeItem_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "NFe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NFe_access_key_key" ON "NFe"("access_key");
