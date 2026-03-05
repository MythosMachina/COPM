CREATE TABLE "DomNexApexDomain" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DomNexApexDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DomNexApexDomain_domain_key" ON "DomNexApexDomain"("domain");
