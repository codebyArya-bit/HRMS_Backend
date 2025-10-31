import { PrismaClient } from "@prisma/client";

// For Free plan deployment - uses in-memory database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.NODE_ENV === 'production' 
        ? 'file::memory:?cache=shared' 
        : process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
});

export default prisma;