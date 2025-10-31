import express from "express";

const router = express.Router();

/* =========================================================
   📁 DOCUMENT PLACEHOLDERS
   ========================================================= */

// List all documents (placeholder)
router.get("/", (req, res) => {
  res.json({
    message: "📄 Document list endpoint placeholder",
    data: [],
  });
});

// List document categories (placeholder)
router.get("/categories", (req, res) => {
  res.json({
    message: "📂 Document categories endpoint placeholder",
    categories: ["Policies", "Offers", "Resumes", "Reports"],
  });
});

export default router;
