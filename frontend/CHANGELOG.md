# ConfigUI Frontend Changelog

## 2026-01-14 - ParentValue Column Added to Detail View

### Summary
Added ParentValue column to the configuration detail view, displaying inherited values from parent hierarchy levels.

### Changes

#### New Features
- **ParentValue Display**: Shows inherited configuration values from parent levels
- **Hierarchy Indicator**: Displays upward arrow (↑) to indicate inherited values
- **Tooltip**: Hover over parent value to see which level it's inherited from (Global, Customer, Org, Site)
- **Visual Design**: Light blue background (#f0f7ff) to distinguish from current values

#### Layout
The configuration item grid now includes:
1. Property Name (180px)
2. Tooltip indicator (auto)
3. **Parent Value (200px)** ← NEW
4. Current Value (flexible, 1fr)
5. Delete button (auto)

#### Helper Functions Added
- `getParentValue(config)` - Extracts ParentValue from config object
- `getParentLevel(config)` - Converts numeric level to human-readable name
- `hasParentValue(config)` - Checks if a parent value exists

#### Files Modified
- [src/components/ConfigManager.vue](src/components/ConfigManager.vue)
  - Lines 265-281: Helper functions
  - Lines 121-124: Parent value column template
  - Lines 737-760: Parent value cell styling
  - Line 737: Updated grid layout from 4 to 5 columns
  - Lines 911-913: Mobile responsive handling

#### Visual Example

```
Property Name    ?    Parent Value         Current Value
────────────────────────────────────────────────────────────
MaxRetries       ?    ↑ 3                  5
Timeout          ?    ↑ 30                 (empty)
Debug            ?    ↑ N                  Y
NewProperty      ?    (empty)              value
```

### Data Source
ParentValue data comes from the new TVF migration:
- TVF: `Config.CfgOverridesWithHierarchy`
- Source View: `Config.cfg_overrides_with_parent`
- Additional columns: `ParentValue`, `ParentLevel`, `ParentConfigID`

### Responsive Design
- **Desktop (>600px)**: Parent value column visible
- **Mobile (≤600px)**: Parent value column hidden to save space

### User Benefits
1. **Visibility**: Users can immediately see what value is inherited from parent levels
2. **Context**: Helps understand configuration hierarchy and inheritance
3. **Decision Making**: Easier to decide whether to override or keep inherited values
4. **Traceability**: Shows the hierarchy level where the value originates

### Technical Notes
- Empty parent values show as transparent cell (no visual noise)
- Parent values are read-only (display only)
- Styling uses existing color scheme (#0a5591 blue theme)
- Compatible with existing dropdown, secure field, and textarea controls

### Browser Compatibility
- CSS Grid layout (all modern browsers)
- Flexbox for internal cell layout
- Text truncation with ellipsis for long values

---

## Previous Changes

(Add previous changelog entries here as they occur)
