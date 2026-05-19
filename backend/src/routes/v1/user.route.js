const express = require('express');
const userController = require('../../controllers/user.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// All user management routes require ADMIN role
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.patch('/:id', userController.updateUser);

module.exports = router;
