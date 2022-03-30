const express = require('express')
const router = express.Router()
const blog_controller = require('../app/controllers/BlogControllers')

router.use('/', blog_controller.index)

module.exports = router