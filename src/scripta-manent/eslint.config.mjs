import nextPlugin from "eslint-config-next";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...(Array.isArray(nextPlugin) ? nextPlugin : [nextPlugin]),
];

export default eslintConfig;
