const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getSummaries,
  deleteSummary,
} = require("../controllers/memoryController");

const router = express.Router();
router.get("/summaries", requireAuth, getSummaries);
router.delete("/summaries/:id", requireAuth, deleteSummary);

module.exports = router;
