module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: [
    "eslint:recommended", // Removes "google"
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "quotes": ["error", "double"],
    "no-unused-vars": "warn",
    "max-len": "off",
    "indent": "off",
    "comma-dangle": "off",
    "semi": ["error", "always"],
  },
};





