# Sefaria HTML Formatting Implementation

## Overview
Updated the frontend TextViewer component to properly render HTML formatting that comes from the Sefaria API, including footnotes, emphasis, and other markup.

## Changes Made

### 1. Updated TextContent Component (`frontend/src/components/TextViewer/TextContent.tsx`)

#### Added HTML Sanitization
- Created `sanitizeHtml()` function to safely handle HTML content
- Removes dangerous elements like `<script>` tags and event handlers
- Allows safe HTML tags: `sup`, `sub`, `big`, `small`, `span`, `i`, `b`, `strong`, `em`

#### Added HtmlContent Component
- New component to render sanitized HTML using `dangerouslySetInnerHTML`
- Supports both Hebrew and English text with appropriate CSS classes
- Detects HTML content automatically using regex pattern

#### Updated HighlightedText Component
- Added `isHebrew` prop to distinguish between Hebrew and English text
- Renders HTML content when detected, falls back to plain text highlighting
- Maintains search highlighting functionality for plain text

### 2. Added CSS Styles (`frontend/src/index.css`)

#### Sefaria-Specific Styling
- `.sefaria-text` - Base class for all Sefaria text content
- `.footnote-marker` - Styling for footnote superscript markers
- `.footnote` - Styling for footnote content
- `.mam-spi-samekh` - Special letter spacing for Hebrew text
- Standard HTML tags: `sup`, `sub`, `big`, `small`, `i`, `b`, `strong`, `em`

#### Language-Specific Classes
- `.sefaria-hebrew` - RTL direction and Hebrew font family
- `.sefaria-english` - LTR direction for English text

#### Interactive Features
- Hover effects for footnote markers
- Proper spacing and typography for readability

### 3. Added Test Coverage (`frontend/src/test/HtmlTextRendering.test.tsx`)

#### Test Cases
- Renders HTML content with proper formatting
- Preserves HTML elements (sup, i, b, big)
- Renders Hebrew text with HTML formatting
- Sanitizes dangerous HTML content
- Maintains safe HTML elements

### 4. Created Example Component (`frontend/src/examples/SefariaHtmlExample.tsx`)

#### Demonstration Features
- Shows real Sefaria text with HTML formatting
- Displays both Hebrew and English content
- Documents supported HTML features
- Provides visual example of the implementation

## Supported HTML Elements

### Text Formatting
- `<sup>` - Superscript (footnote markers)
- `<sub>` - Subscript
- `<big>` - Larger text
- `<small>` - Smaller text
- `<i>`, `<em>` - Italic/emphasis
- `<b>`, `<strong>` - Bold text

### Sefaria-Specific Classes
- `footnote-marker` - Footnote reference markers
- `footnote` - Footnote content
- `mam-spi-samekh` - Special Hebrew text spacing

## Security Considerations

### HTML Sanitization
- Removes `<script>` tags and content
- Strips event handlers (`onclick`, `onload`, etc.)
- Only allows whitelisted HTML tags
- Uses React's `dangerouslySetInnerHTML` safely

### Future Improvements
- Consider using a dedicated HTML sanitization library like DOMPurify
- Add support for more complex HTML structures if needed
- Implement HTML-aware search highlighting

## Usage

The TextContent component automatically detects and renders HTML content:

```tsx
<TextContent
  text={sefariaTextWithHtml}
  section={textSection}
  highlights={searchHighlights}
  searchQuery="search term"
/>
```

HTML content is rendered with proper styling, while plain text maintains full search highlighting functionality.