# playwright-utils

Some utils to login and post to social media using Playwright.

Usage

## Twitter

Set the right variables in your `.env` file.

### Logging in

Create an empty folder to keep the authenticated session

```bash
mkdir - p playwright/.auth
```

Log in.

```ts
npm run twitter login
```

### Tweeting

```ts
npm run twitter tweet "My new tweet"
```
