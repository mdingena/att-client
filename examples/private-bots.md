# Restrict your bot to specific server groups

You can configure your bot to only manage allowlisted server groups, or conversely, to explicitly not manage blocklisted server groups. You must specify numerical group IDs.

```ts
// my-bot-config.js
export const myBotConfig = {
  includedGroups: [11111, 22222, 33333]
  // the rest of your configuration...
};
```

```ts
// my-bot-config.js
export const myBotConfig = {
  excludedGroups: [77777, 88888, 99999]
  // the rest of your configuration...
};
```

:warning: If you configure both an allowlist and a blocklist, **the blocklist is ignored** and only the allowlist is used.

```ts
export const myBotConfig = {
  excludedGroups: [77777, 88888, 99999], // will be ignored
  includedGroups: [11111, 22222, 33333] // will be used
  // the rest of your configuration...
};
```
