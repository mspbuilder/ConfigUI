# Configuration Hierarchy Display Feature

## Overview

The Configuration Manager now displays **inherited values from parent hierarchy levels**, making it easy to see where configuration values originate and understand the inheritance chain.

---

## Visual Layout

### Before (Original Layout)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Property Name         ?   Current Value                         [X] │
├─────────────────────────────────────────────────────────────────────┤
│ MaxRetries            ?   5                                          │
│ Timeout               ?   [empty textbox]                            │
│ EnableDebug           ?   Y  ▼                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### After (With ParentValue Column)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Property Name    ?   Parent Value          Current Value              [X] │
├──────────────────────────────────────────────────────────────────────────────┤
│ MaxRetries       ?   ↑ 3                   5                               │
│ Timeout          ?   ↑ 30                  [empty textbox]                 │
│ EnableDebug      ?   ↑ N                   Y  ▼                            │
│ NewProperty      ?                         custom_value                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Hierarchy Levels

The system supports 5 hierarchy levels:

```
Level 0: Global          (applies to all customers)
    ↓
Level 1: Customer        (applies to specific customer)
    ↓
Level 2: Organization    (applies to specific org within customer)
    ↓
Level 3: Site            (applies to specific site within org)
    ↓
Level 4: Agent           (applies to specific agent within site)
```

**Inheritance Rule**: Each level inherits values from its parent. Child values override parent values.

---

## Feature Details

### Parent Value Column

**Location**: Between tooltip indicator and current value

**Display Format**:
- **Arrow Icon**: ↑ (indicates inheritance from above)
- **Value**: Inherited value from parent level
- **Color**: Blue-tinted background (#f0f7ff) to distinguish from current values
- **Tooltip**: Hover to see which level it's from (e.g., "Inherited from Customer")

**When Empty**:
- No inheritance exists at higher levels
- Cell appears transparent/empty
- First time this property is defined at this level

### Example Scenarios

#### Scenario 1: Customer Overriding Global Default

```
Current Level: Customer
Property: MaxRetries

┌────────────────────────────────────────────┐
│ MaxRetries  ?  ↑ 3 (Global)     5         │
└────────────────────────────────────────────┘

Explanation:
- Global level sets MaxRetries = 3
- Customer overrides it to 5
- Parent Value shows "3" from Global
```

#### Scenario 2: Site Using Inherited Value

```
Current Level: Site
Property: Timeout

┌────────────────────────────────────────────┐
│ Timeout  ?  ↑ 30 (Customer)    [empty]    │
└────────────────────────────────────────────┘

Explanation:
- Customer level sets Timeout = 30
- Site has no override (empty value)
- Site will use inherited value of 30
- Parent Value shows "30" from Customer
```

#### Scenario 3: New Property at Current Level

```
Current Level: Organization
Property: CustomSetting

┌────────────────────────────────────────────┐
│ CustomSetting  ?              my_value     │
└────────────────────────────────────────────┘

Explanation:
- No parent levels define this property
- First time defined at Organization level
- Parent Value column is empty
```

#### Scenario 4: Multi-Level Inheritance Chain

```
Level 0 (Global):     MaxRetries = 3
Level 1 (Customer):   MaxRetries = 5
Level 2 (Org):        [viewing this level]

┌────────────────────────────────────────────┐
│ MaxRetries  ?  ↑ 5 (Customer)    [empty]  │
└────────────────────────────────────────────┘

Explanation:
- Global sets 3, Customer overrides to 5
- Org sees immediate parent (Customer) value: 5
- Org has no override, will use 5
```

---

## User Workflows

### Use Case 1: Understanding Inheritance

**Problem**: "Why does my site have this value? I didn't set it."

**Solution**: Look at Parent Value column
- If Parent Value shows a value → it's inherited from above
- Hover over it to see which level (Global, Customer, Org)
- You can override it by entering a new value in Current Value

### Use Case 2: Deciding Whether to Override

**Problem**: "Should I override this value or keep the default?"

**Solution**: Parent Value helps you decide
- See what the inherited value is
- Compare it to what you need
- If different, override in Current Value
- If same, leave empty to maintain inheritance

### Use Case 3: Troubleshooting Configuration Issues

**Problem**: "The agent is using the wrong value."

**Solution**: Check each hierarchy level
- Navigate from Customer → Org → Site → Agent
- At each level, check Parent Value vs Current Value
- Find where an unexpected override occurs
- Fix or remove the override

### Use Case 4: Cleaning Up Redundant Overrides

**Problem**: "Too many overrides, hard to maintain."

**Solution**: Identify unnecessary overrides
- If Current Value = Parent Value → override is redundant
- Clear the Current Value to use inherited value
- Reduces configuration complexity

---

## Technical Implementation

### Data Source

**TVF**: `Config.CfgOverridesWithHierarchy(@CUSTID, @CAT, @ORG, @SITE, @AGENT)`

**Columns Used**:
- `ParentValue` - The inherited value from parent level
- `ParentLevel` - Numeric level (0-4) of the parent
- `ParentConfigID` - ID of the parent configuration record

### Frontend Code

**Helper Functions** (ConfigManager.vue):

```javascript
// Extract parent value from config object
function getParentValue(config) {
  return config.ParentValue || config.parentvalue || '';
}

// Convert numeric level to human-readable name
function getParentLevel(config) {
  const level = config.ParentLevel || config.parentlevel;
  if (level === null || level === undefined) return null;
  const levelMap = ['Global', 'Customer', 'Org', 'Site', 'Agent'];
  return levelMap[level] || level;
}

// Check if config has an inherited value
function hasParentValue(config) {
  const parentVal = getParentValue(config);
  return parentVal !== null && parentVal !== undefined && parentVal !== '';
}
```

**Template**:

```vue
<!-- Parent Value (inherited from hierarchy) -->
<div v-if="hasParentValue(config)"
     class="parent-value-cell"
     :title="`Inherited from ${getParentLevel(config)}`">
  <span class="parent-label">↑</span>
  <span class="parent-value">{{ getParentValue(config) }}</span>
</div>
<div v-else class="parent-value-cell parent-empty"></div>
```

### Styling

```css
.parent-value-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  background: #f0f7ff;        /* Light blue background */
  border: 1px solid #d0e7ff;  /* Blue border */
  border-radius: 3px;
  font-size: 0.875rem;
  min-height: 1.75rem;
}

.parent-label {
  color: #0a5591;             /* Blue arrow */
  font-weight: bold;
  font-size: 0.9rem;
}

.parent-value {
  color: #555;
  font-style: italic;         /* Italic to indicate inheritance */
  overflow: hidden;
  text-overflow: ellipsis;    /* Truncate long values */
  white-space: nowrap;
}
```

---

## Grid Layout

**Desktop Layout** (>600px):

```
grid-template-columns: 180px auto 200px 1fr auto
                       ↑      ↑    ↑     ↑   ↑
                       │      │    │     │   └─ Delete button
                       │      │    │     └───── Current value (flexible)
                       │      │    └─────────── Parent value (200px)
                       │      └──────────────── Tooltip (auto-width)
                       └─────────────────────── Property name (180px)
```

**Mobile Layout** (≤600px):

```
grid-template-columns: auto 1fr auto
                       ↑    ↑   ↑
                       │    │   └─ Delete button
                       │    └───── Current value
                       └────────── Property name (full width, stacked)

Parent value column hidden on mobile
```

---

## Benefits

### For End Users
1. **Transparency**: See exactly where values come from
2. **Confidence**: Make informed decisions about overrides
3. **Efficiency**: Quickly identify and fix configuration issues
4. **Documentation**: Visual representation of inheritance chain

### For Administrators
1. **Troubleshooting**: Easier to diagnose configuration problems
2. **Maintenance**: Identify and remove redundant overrides
3. **Training**: Visual aid for explaining hierarchy to new users
4. **Auditing**: Clear view of configuration inheritance patterns

### For Support Teams
1. **Faster Resolution**: Quickly see configuration inheritance
2. **Clear Communication**: Show users why they're seeing certain values
3. **Root Cause Analysis**: Trace values back to their origin
4. **Validation**: Verify inheritance is working correctly

---

## Future Enhancements

Possible improvements for future versions:

1. **Clickable Parent Values**: Click to navigate to parent level
2. **Diff Highlighting**: Highlight differences between parent and current values
3. **Inheritance Chain**: Show full chain (Global → Customer → Org → Site)
4. **Override Recommendations**: Suggest removing redundant overrides
5. **Batch Operations**: Clear all overrides that match parent values
6. **History View**: Show when parent value changed and why
7. **Search Filter**: Find properties where current ≠ parent
8. **Export**: Include parent values in configuration exports

---

## Related Documentation

- [ASCX_SQL_extra.md](../../ref/ASCX_SQL_extra.md#tvf-migration-2026-01-14) - TVF Migration Details
- [ConfigDataFlagged TVF](../../ref/SQL/TVFs/ConfigDataFlagged.sql) - SQL Function
- [CHANGELOG.md](CHANGELOG.md) - Frontend Changes
