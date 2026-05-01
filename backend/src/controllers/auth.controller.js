const authService = require('../services/auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const { refresh_token } = req.body;
      const result = await authService.refreshToken(refresh_token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      // In this simple JWT implementation, logout is mostly handled on frontend by deleting the token.
      // If we had a token blacklist, we would add the token here.
      res.json({ data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
