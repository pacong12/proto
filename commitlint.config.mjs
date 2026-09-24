export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-emoji': ({ raw }) => {
          const emojiRegex =
            /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
          const hasEmoji = emojiRegex.test(raw);
          return [
            !hasEmoji,
            'Commit message must not contain emojis per proto Zero Emojis policy',
          ];
        },
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'contracts',
        'api',
        'tokens',
        'frontoffice',
        'trade',
        'chart',
        'observability',
        'security',
        'shared-types',
        'infra',
        'deps',
        'docs',
        'scripts',
        'worker',
        'release',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 120],
    'no-emoji': [2, 'always'],
  },
};
