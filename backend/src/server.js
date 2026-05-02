require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

function isMissing(value) {
  return !value || !value.trim();
}

function isPlaceholderSecret(value) {
  return isMissing(value) || /change-me|default|your-/i.test(value);
}

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const invalidVariables = [];

  if (isMissing(process.env.DATABASE_URL)) {
    invalidVariables.push('DATABASE_URL');
  }

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (isPlaceholderSecret(process.env[name])) {
      invalidVariables.push(name);
    }
  }

  if (invalidVariables.length > 0) {
    throw new Error(`Missing or invalid production env vars: ${invalidVariables.join(', ')}`);
  }
}

validateProductionConfig();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
