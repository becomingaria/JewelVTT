# Design Guidelines for Jewel VTT

This document outlines the design system guidelines for the Jewel VTT infinite whiteboard application. These guidelines ensure visual consistency, accessibility, and maintainability across all UI components.

## Color Palette

### Primary Colors

-   **Background**: `#ffffff` (White) - Main application background
-   **Primary Blue**: `#3498db` - Primary actions, focus states, active elements
-   **Primary Blue (Hover)**: `#2980b9` - Hover state for primary blue elements

### Neutral Colors

-   **Text Primary**: `#333333` - Main text content, headings
-   **Text Secondary**: `#555555` - Secondary text, labels
-   **Text Muted**: `#666666` - Disabled text, placeholders
-   **Text Light**: `#999999` - Form separators, subtle text

### UI Colors

-   **Border Light**: `#e0e0e0` - Default borders, dividers
-   **Border Medium**: `#ddd` - Input borders, subtle separations
-   **Border Dark**: `#ccc` - Hover state borders

### Background Colors

-   **Surface**: `#f8f9fa` - Card headers, footers, secondary surfaces
-   **Surface Hover**: `#e9ecef` - Hover states for surfaces
-   **Surface Active**: `#dee2e6` - Active/pressed states
-   **Disabled**: `#bdc3c7` - Disabled element backgrounds

### Overlay Colors

-   **Modal Backdrop**: `rgba(0, 0, 0, 0.5)` - Semi-transparent overlays
-   **Shadow Light**: `rgba(0, 0, 0, 0.1)` - Subtle shadows
-   **Shadow Medium**: `rgba(0, 0, 0, 0.2)` - Card/modal shadows
-   **Focus Ring**: `rgba(52, 152, 219, 0.1)` - Focus state highlight

## Typography

### Font Family

-   **Primary**: System font stack (inherits from browser defaults)
-   **Monospace**: Used for color values and code display

### Font Sizes

-   **Large Title**: `24px` - Main application titles
-   **Section Title**: `18px` - Modal headers, section headings
-   **Subsection**: `16px` - Subsection headings
-   **Body**: `14px` - Default body text, form labels, buttons
-   **Small**: `12px` - Secondary information, captions

### Font Weights

-   **Bold**: `600` - Headings, important labels
-   **Medium**: `500` - Form labels, button text
-   **Normal**: `400` - Body text, default weight

### Line Height

-   Default line heights should provide comfortable reading spacing
-   Form elements use consistent vertical rhythm

## Spacing System

### Grid System

-   **Base Unit**: `32px` - Canvas grid squares
-   **Component Spacing**: `4px` increments for consistent spacing

### Common Spacing Values

-   **Extra Small**: `4px` - Tight spacing within components
-   **Small**: `6px` - Form element internal padding
-   **Medium**: `8px` - Standard padding, gaps between related elements
-   **Large**: `12px` - Section spacing, button gaps
-   **Extra Large**: `16px` - Form group margins, component separation
-   **Section**: `20px` - Major section padding
-   **Container**: `24px` - Modal body padding, large container spacing

### Layout Dimensions

-   **Top Bar Height**: `60px` - Fixed header height
-   **Sidebar Width**: `300px` - Standard sidebar width
-   **Modal Max Width**: `500px` - Maximum modal dialog width
-   **Modal Max Height**: `80vh` - Maximum modal height relative to viewport

## Component Styling Patterns

### Buttons

```css
/* Primary Button */
background-color: #3498db;
color: white;
padding: 10px 20px;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
border: none;
cursor: pointer;
transition: all 0.2s ease;

/* Primary Button Hover */
background-color: #2980b9;

/* Secondary Button */
background-color: #e9ecef;
color: #666;

/* Secondary Button Hover */
background-color: #dee2e6;
color: #333;
```

### Form Elements

```css
/* Input Fields */
width: 100%;
padding: 8px 12px;
border: 1px solid #ddd;
border-radius: 6px;
font-size: 14px;
transition: border-color 0.2s ease;

/* Focus State */
border-color: #3498db;
box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
outline: none;
```

### Cards and Modals

```css
/* Card/Modal Container */
background: white;
border-radius: 12px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
overflow: hidden;

/* Card Header/Footer */
background-color: #f8f9fa;
border-bottom: 1px solid #e0e0e0; /* or border-top for footer */
padding: 20px 24px;
```

### Interactive Elements

```css
/* Standard Hover State */
transition: all 0.2s ease;

/* Close/Icon Buttons */
width: 30px;
height: 30px;
border-radius: 4px;
display: flex;
align-items: center;
justify-content: center;
```

## Border Radius System

-   **Small**: `4px` - Small buttons, form controls
-   **Medium**: `6px` - Standard inputs, buttons
-   **Large**: `12px` - Cards, modals, major containers

## Shadow System

-   **Subtle**: `0 2px 4px rgba(0, 0, 0, 0.1)` - Light elevation
-   **Medium**: `0 4px 8px rgba(0, 0, 0, 0.15)` - Standard cards
-   **Strong**: `0 8px 32px rgba(0, 0, 0, 0.2)` - Modals, overlays

## Animation Guidelines

### Transition Duration

-   **Fast**: `0.15s` - Quick hover effects
-   **Standard**: `0.2s` - Most UI interactions
-   **Slow**: `0.3s` - Complex state changes

### Easing

-   **Standard**: `ease` - General purpose easing
-   **Custom**: Define specific cubic-bezier values for complex animations

## Responsive Design

### Breakpoints

-   **Mobile**: `max-width: 600px`
    -   Reduce modal width to 95%
    -   Stack form rows vertically
    -   Reduce padding on smaller screens

### Mobile Adaptations

-   Modal padding reduces from `24px` to `16px`
-   Form rows change from grid to single column
-   Touch-friendly button sizes maintained

## Accessibility Guidelines

### Focus States

-   All interactive elements must have visible focus indicators
-   Use consistent focus ring: `0 0 0 3px rgba(52, 152, 219, 0.1)`
-   Maintain keyboard navigation support

### Color Contrast

-   Ensure sufficient contrast ratios for text readability
-   Don't rely solely on color to convey information

### Interactive Element Sizing

-   Minimum touch target size: `30px x 30px`
-   Provide adequate spacing between clickable elements

## Implementation Notes

### CSS Architecture

-   Use CSS Modules or scoped styles for component isolation
-   Follow BEM naming conventions where applicable
-   Group related properties logically
-   Use CSS custom properties (variables) for consistency

### Performance Considerations

-   Optimize for large canvas rendering
-   Use efficient viewport culling
-   Consider CSS containment for large lists
-   Minimize layout thrashing during animations

### Browser Compatibility

-   Use modern CSS features with appropriate fallbacks
-   Test across major browsers and devices
-   Consider progressive enhancement

## Future Enhancements

### Design Tokens

Consider implementing a design token system for:

-   Color management
-   Spacing consistency
-   Typography scales
-   Animation timing

### Theme Support

Plan for potential dark mode or theme switching:

-   Abstract color values into CSS custom properties
-   Design neutral component structures
-   Consider user preference detection

### Component Library

As the application grows, consider:

-   Extracting reusable components
-   Creating a style guide/documentation
-   Implementing design system tooling
