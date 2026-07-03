const { analyzeFoodPhoto } = require('../services/nutrition/nutritionService');

async function postFoodImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image file required' });
    const result = await analyzeFoodPhoto({
      imageBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
      userId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { postFoodImage };
