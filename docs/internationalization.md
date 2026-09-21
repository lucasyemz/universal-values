# Product language

English is the default language of the dashboard, login and Webflow Designer extension. Brazilian Portuguese remains available.

## Switching language

- Dashboard: open the account menu and use **Language**.
- Login: use the language selector before signing in.
- Designer extension: use its own language selector.

The dashboard stores the choice in the `copyreplace-locale` cookie for one year. The extension stores its choice in local storage. Preferences are browser-specific; they do not synchronize between devices. URLs are unchanged. No database migration is needed.

## Translation boundaries

Customer names, CMS values, snippets and site content are not translated. Gemini continues to follow the CMS/site content language rather than the product interface language. Scan detection formats and write confirmation requirements are unchanged. The existing landing page remains in English.

## Development

Catalogs live in `src/i18n/messages/en.json` and `pt-BR.json`, with matching Portuguese source keys and numbered placeholders. Use `useText()` in synchronous components and `await getText()` in asynchronous server components. Only pass application-owned copy to the translator. Use `t.dateLocale` for display formatting, without changing stored dates or detection rules.

The locale provider uses next-intl. Tests cover locale validation, persisted preference, catalog parity, interpolation, historical messages and preservation of unknown content.
