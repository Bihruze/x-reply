const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                chrome: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn"
        }
    },
    pluginJs.configs.recommended
];
