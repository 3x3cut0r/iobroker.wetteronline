const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    {
        ignores: [
            ".prettierrc.js",
            "**/.eslintrc.js",
            "admin/words.js",
        ],
    },
    {
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.es2021,
                ...globals.node,
                ...globals.mocha,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            indent: ["error", 4, { SwitchCase: 1 }],
            "no-console": "off",
            "no-unused-vars": [
                "error",
                {
                    ignoreRestSiblings: true,
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "no-var": "error",
            "no-trailing-spaces": "error",
            "prefer-const": "error",
            quotes: [
                "error",
                "double",
                { avoidEscape: true, allowTemplateLiterals: true },
            ],
            semi: ["error", "always"],
        },
    },
];
