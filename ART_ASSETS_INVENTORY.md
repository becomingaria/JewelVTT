# Jewel VTT - Art Assets Inventory

This document lists all current art assets and identifies areas where custom artwork could enhance the user experience.

## 🎨 Current Art Assets

### Logo & Branding

-   **Logo/Icon**: `/public/jewelvtt.png` - Used in TopBar and as favicon
    -   Current: PNG format
    -   Suggested: Could create SVG version for scalability
    -   Also used as favicon in `index.html`

### Default Assets

-   **React Logo**: `/src/assets/react.svg` - Default Vite template asset (unused)

## 🖱️ Cursor States & Interactive Elements

### Current Cursor Usage

The application uses various cursor states that could be replaced with custom cursor sprites:

1. **Grab Cursors**

    - `cursor: grab` - Default open hand for draggable elements
    - `cursor: grabbing` - Closed hand when dragging
    - Locations: Humbugs, rotate handles, whiteboard panning

2. **Resize Cursors**

    - `cursor: nw-resize` - Northwest resize
    - `cursor: ne-resize` - Northeast resize
    - `cursor: sw-resize` - Southwest resize
    - `cursor: se-resize` - Southeast resize
    - `cursor: n-resize` - North resize
    - `cursor: s-resize` - South resize
    - `cursor: e-resize` - East resize
    - `cursor: w-resize` - West resize
    - `cursor: nwse-resize` - General diagonal resize

3. **Pointer Cursors**
    - `cursor: pointer` - Used for buttons and clickable elements
    - `cursor: default` - Standard cursor for locked elements

### 🎨 **Suggested Custom Cursor Sheets**

Create a cursor sprite sheet with themed cursors for:

-   **Grab Hand** (open) - Fantasy/medieval style hand
-   **Grabbing Hand** (closed) - Matching closed hand
-   **Resize Arrows** - 8-directional resize cursors with medieval styling
-   **Pointer** - Custom pointer/sword cursor
-   **Default** - Custom default cursor
-   **Pan Mode** - Special cursor when shift-panning is active

## 📱 UI Icons & Emojis

### Current Emoji Usage

These emojis are currently used and could be replaced with custom icons:

#### **Sidebar Interface**

-   **📤** - Export button
-   **📥** - Import button
-   **🖼️** - Select texture button
-   **🗑️** - Clear texture button

#### **Context Menu (Right-click)**

-   **📝** - Text Box creation
-   **🖼️** - Image element
-   **🗺️** - Map element
-   **🪙** - Token element
-   **📍** - Map Pin element
-   **🟦** - Solid Color element

#### **Humbug Context Menu**

-   **✏️** - Edit option

#### **Humbug Interaction Elements**

-   **🔄** - Rotate handle (normal mode)
-   **↻** - Rotate handle (snap-to-grid mode)
-   **×** - Delete handle (text character, could be icon)

### 🎨 **Suggested Custom Icon Replacements**

#### **File Operations**

-   Export: Custom upload/export icon
-   Import: Custom download/import icon

#### **Content Creation**

-   Text: Quill/scroll icon
-   Image: Picture frame icon
-   Map: Rolled map/compass icon
-   Token: Coin/medallion icon
-   Map Pin: Location marker icon
-   Solid Color: Paint bucket/palette icon

#### **Actions**

-   Edit: Pencil/quill icon
-   Delete: Trash/destroy icon
-   Rotate: Circular arrows icon
-   Clear: Broom/eraser icon

## 🎭 Visual States & Effects

### Current Visual Feedback

1. **Shift Pan Mode**: Elements become semi-transparent with filter effects
2. **Selected Elements**: Visual outline/border
3. **Hover States**: Various cursor changes
4. **Dragging State**: Grabbing cursor

### 🎨 **Suggested Visual Enhancements**

-   **Custom selection highlights** instead of CSS borders
-   **Particle effects** for interactions
-   **Custom drag shadows** instead of CSS opacity
-   **Themed hover glows** for interactive elements

## 🎨 Themed Art Direction Suggestions

### Medieval/Fantasy Theme

-   **Cursors**: Medieval gauntlet hands, sword pointers
-   **Icons**: Scrolls, quills, shields, swords, magical symbols
-   **UI Elements**: Stone/wood textures, metal buttons
-   **Handles**: Gem-studded resize corners, ornate rotation symbols

### Modern/Tech Theme

-   **Cursors**: Clean geometric hands, precision pointers
-   **Icons**: Clean line art, tech symbols
-   **UI Elements**: Glass/metal materials, neon accents
-   **Handles**: Circuit-pattern resize corners, digital rotation symbols

### Paper/Board Game Theme

-   **Cursors**: Hand-drawn style cursors
-   **Icons**: Sketched/hand-drawn icons
-   **UI Elements**: Paper textures, pencil-drawn borders
-   **Handles**: Hand-drawn corner brackets, sketched rotation arrows

## 📋 Priority Levels for Art Asset Creation

### **High Priority** (Core UX Impact)

1. Logo refinement (SVG version)
2. Custom cursor set (grab, resize, pointer)
3. Core action icons (edit, delete, rotate)

### **Medium Priority** (Visual Polish)

1. Content creation icons (text, image, map, token, etc.)
2. File operation icons (import/export)
3. Selection and hover state graphics

### **Low Priority** (Nice to Have)

1. Particle effects and transitions
2. Themed UI element backgrounds
3. Custom drag shadows and visual effects

## 🛠️ Technical Implementation Notes

### Cursor Implementation

-   Custom cursors can be implemented via CSS `cursor: url('cursor.png'), auto;`
-   Recommended cursor size: 32x32 pixels
-   Need fallback cursors for compatibility

### Icon Implementation

-   Icons can replace emoji via CSS or direct SVG/PNG replacement
-   Consistent sizing needed across interface
-   Consider icon font vs individual image files

### Asset Organization

Suggested folder structure:

```
/public/assets/
  /cursors/
    - grab.png
    - grabbing.png
    - resize-nw.png
    - etc.
  /icons/
    - export.svg
    - import.svg
    - text.svg
    - etc.
  /ui/
    - selection-corner.svg
    - handle-rotate.svg
    - etc.
```

## 🎯 Conclusion

The application currently uses 15+ emoji icons and 10+ cursor states that could be replaced with custom themed artwork. Creating a cohesive art style would significantly enhance the professional appearance and user experience of Jewel VTT.
