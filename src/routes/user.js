const express = require('express')
const router = express.Router()
const user_controller = require('../app/controllers/UserControllers')

router.use('/', user_controller.index)

module.exports = router