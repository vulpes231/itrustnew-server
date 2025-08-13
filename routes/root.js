const { Router } = require("express");

const router = Router();

router.get("/", async (req, res) => {
	res.status(200).json({ message: "iTrust New Server available." });
});

module.exports = router;
