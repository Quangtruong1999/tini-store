const Foods = require('../../models/foods');


exports.get_all_foods = async (req, res) => {
  try {
    const [allGet] = await Foods.get_all_foods();
    res.status(200).json(allGet);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
  }
};