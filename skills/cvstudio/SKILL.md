---
name: proamine-cvstudio
description: Build and maintain ProAmineCVStudio, its glass editor, reference-inspired two-column CV template, QR codes, and PDF, editable Word, image, and JSON exports. Use for changes to this repository or its GitHub Pages publication.
---

# ProAmineCVStudio

Keep the app browser-local and free to create and export. Preserve the repository's AGPL license. Never publish a real person's CV, portrait, or private test data as demonstration content.

## Structure

- `src/model.ts`: versioned, validated project data, demo content, and URL safety.
- `src/layout.ts`: shared pagination and drawing commands for SVG preview and vector PDF.
- `src/CvCanvas.tsx`: readable SVG preview and image-export rendering.
- `src/qr.ts`: deterministic high-correction QR generation with preserved white margins.
- `src/exports.tsx`: PDF, editable DOCX, image, and JSON output.
- `src/App.tsx` and `src/style.css`: glass editor, form controls, local autosave, and responsive styling.

## Visual contract

Keep the editor soft, translucent, and calm: blurred surfaces, clear typography, fine borders, restrained ambient motion. Respect reduced motion. Keep the exported CV readable and print-focused.

Preserve the Signature template's two columns, colored profile sidebar, circular photo, clear section headings, skill circles, and labeled project QR codes. Keep Minimal as the plain single-column alternative. Never imply that decorative skill circles measure proficiency.

## Editing and export contract

Preserve every field through JSON save/import. Allow content to continue to additional pages instead of clipping or shrinking everything to unreadable sizes. Keep PDF text selectable and links clickable. Keep DOCX text and skill-circle labels genuinely editable, embed the regular and bold fonts, and preserve labeled QR grids. Word pagination may differ from PDF. Report unsupported PDF glyphs and offer browser Print / Save PDF rather than silently losing text.

Generate QR data with the QR library, never an image generator. Keep error correction high when adding center icons; decode exported QR codes during QA. Permit only ordinary HTTP(S) link targets and safe raster photos. Keep user data local, and make autosave failures visible. Apply schema limits in the editor, isolate QR encoding errors, keep JSON backups independent of QR readiness, and preserve invalid saved data before replacing it. Never let a storage quota failure erase the original saved data.

## Validation

Run `npm test` and `npm run build`. Match the preview and exported PDF for headings, text, links, and pagination; inspect native editable Word shapes and embedded fonts. Exercise long text, several QR cards, all export types, new/imported projects, photo uploads, accent changes, and the two templates. Inspect the exported DOCX after rendering and extract PDF text. Use the supported browser preview workflow, never a second browser driver.

## Publication

Publish the static build under the repository's GitHub Pages path. Use relative assets. Preserve existing files and concurrent changes. The Pages workflow needs the repository's initial Pages source configured to GitHub Actions; report a missing configuration rather than claiming a live deployment.
