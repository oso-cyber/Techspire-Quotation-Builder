# Techspire IT Quotation Builder

Offline-first quotation builder for Techspire IT (Pty) Ltd. The desktop app uses React, TypeScript, Vite and Tauri 2. The Windows desktop app stores its SQLite database in the current Windows user's application configuration folder, so catalogue items, packages and quotations remain available after closing and reopening the app and are independent of browser data. When running in a regular browser, a separate SQLite database is persisted in that browser's IndexedDB for development and smoke testing.

## Requirements

- Node.js 20.19+ or 22.12+
- Rust stable toolchain with Cargo
- Visual Studio C++ Build Tools (MSVC)
- Microsoft Edge WebView2 Runtime

## Install and run the Windows desktop app

For normal day-to-day use, install the Windows desktop app using the generated setup executable. It runs locally and keeps data in the Windows user profile; it does not depend on the development server or browser storage.

To rebuild the Windows installer:

```powershell
npm run app:build
```

For development, run the desktop app from the project:

```powershell
npm install
npm run app:dev
```

## Frontend development

```powershell
npm run dev
```

The browser version is for development only. It has a separate SQLite database in that browser's IndexedDB; it does not share products, packages or quotations with the Windows desktop app. Use the app's Backup & restore page to transfer data between them.

## Verification

```powershell
npm run build
npm test
npm run lint
```

The calculation regression test includes the supplied reference quote’s expected subtotal of R371,180.00, VAT of R55,677.00 and total of R426,857.00.

## Current features

- Local client and product/service catalogue management, including CSV import/export
- Package-first quotation builder with saved package cards, reusable whole-quotation templates, client snapshots, editable quantities, discounts, per-line VAT, hourly service rates and live PDF preview
- Automatic local saving for valid quotation drafts, post-export finalisation, quotation history and status tracking
- PDF export directly to Downloads, followed by an in-app PDF viewer with a print action
- Reusable quotation templates created from saved quotations; using one starts a fresh draft with refreshed dates and editable client, items, quantities, prices, terms and notes
- Branded A4 PDFs using the Techspire logo from the supplied quotation reference, with an optional company-logo override, pricing schedule, continuation pages and acceptance section
- Company details, VAT defaults, validity, approved terms and optional logo settings
- SQLite backup and restore, native save/open dialogs in the desktop app

Hourly catalogue services multiply the saved hourly rate by the hours entered in a quotation; the hours are omitted from the exported pricing schedule. Packages accept multiple products or services. Valid drafts with a client and at least one valid line item are saved automatically while editing. Generated PDFs are saved directly to the user's Downloads folder and opened in the in-app viewer, where they can be printed. Save a quotation first, then create a reusable quotation template from the Quotation templates page. The company profile defaults (contact details, registration/VAT numbers and preparer) are taken from the supplied quotation reference and can be changed in Settings. Default ordering terms are included in new quotations and PDF exports and can be edited in Settings.
