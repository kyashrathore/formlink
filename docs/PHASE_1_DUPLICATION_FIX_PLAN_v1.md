# Phase 1: Critical Component Duplication Fix Plan

## Overview

**Objective**: Eliminate component duplication across FormLink apps to restore development velocity and code maintainability.

**Timeline**: 2-4 weeks (aggressive but necessary)

**Success Criteria**:

- <10% component duplication (down from ~40%)
- Single source of truth for all reusable components
- Clear governance preventing future duplication

---

## Week 1: Audit & Strategy

### Day 1-2: Complete Duplication Audit

#### 1.1 Inventory All Duplicate Components

**Critical Locations to Audit:**

```bash
# Primary duplication sources:
apps/formcraft/app/dashboard/forms/[formId]/components/custom/
apps/formcraft/app/dashboard/forms/[formId]/components/chat/
apps/formcraft/app/dashboard/forms/[formId]/components/data-table/
apps/formfiller/components/chat/
apps/formfiller/components/typeform/
```

**Audit Script:**

```bash
# Create audit report
find apps/ -name "*.tsx" -o -name "*.ts" | \
  grep -E "(components|chat|custom)" | \
  xargs grep -l "export.*function\|export.*const.*=" | \
  sort > component_inventory.txt

# Find potential duplicates by name similarity
find apps/ -name "*.tsx" | basename -s .tsx | sort | uniq -c | sort -nr
```

#### 1.2 Categorize Components by Migration Strategy

Create migration matrix:

| Component             | Location              | Reusability | Migration Strategy  | Effort |
| --------------------- | --------------------- | ----------- | ------------------- | ------ |
| **Data Table Suite**  | formcraft/data-table/ | High        | Move to packages/ui | High   |
| **Chat Components**   | Both apps             | High        | Consolidate & move  | Medium |
| **Custom Controls**   | formcraft/custom/     | Medium      | Evaluate & move     | Low    |
| **Layout Components** | formcraft/            | High        | Move to packages/ui | Medium |

### Day 3-5: Create Migration Strategy

#### 1.3 Establish Component Governance

**New Rules (Non-negotiable):**

1. **Default to packages/ui** - App-specific components require written justification
2. **No duplicate implementations** - Use existing or extend packages/ui
3. **Review gate** - All new components reviewed for reusability
4. **Documentation required** - Usage examples for all shared components

#### 1.4 Plan Migration Order (Risk-Based)

```
Priority 1 (Week 1): Low-risk, high-impact
- Custom form controls (date-picker, input-with-addons, etc.)
- Utility components (kbd, sortable)

Priority 2 (Week 2): Medium-risk, critical impact
- Chat components consolidation
- Data table core primitives

Priority 3 (Week 3): High-risk, architectural impact
- Layout components (FloatingPanel, TwoColumnLayout)
- Complex data table features

Priority 4 (Week 4): Cleanup & documentation
- Remove duplicate files
- Update documentation
- Create usage guidelines
```

---

## Week 2: Execute Core Migrations

### Day 6-8: Move Custom Components

#### 2.1 Migrate Custom Form Controls

**Target Components:**

```typescript
// Move these to packages/ui/src/components/form/
date-picker-with-range.tsx    → DatePickerWithRange
input-with-addons.tsx         → InputWithAddons
kbd.tsx                       → Kbd
slider.tsx                    → Slider
sortable.tsx                  → Sortable
```

**Migration Process:**

1. **Copy component to packages/ui**
2. **Update exports in packages/ui/src/index.ts**
3. **Test component in isolation**
4. **Update imports in consuming apps**
5. **Remove duplicate files**

#### 2.2 Create Component Migration Script

```bash
#!/bin/bash
# migrate-component.sh
COMPONENT_NAME=$1
SOURCE_PATH=$2
TARGET_PATH="packages/ui/src/components/"

echo "Migrating $COMPONENT_NAME..."

# Copy component
cp "$SOURCE_PATH" "$TARGET_PATH"

# Update exports
echo "export { default as $COMPONENT_NAME } from './components/$COMPONENT_NAME'" >> packages/ui/src/index.ts

# Find and list all import locations
grep -r "from.*$SOURCE_PATH" apps/ || echo "No imports found"

echo "Migration setup complete. Update imports manually."
```

### Day 9-12: Chat Components Consolidation

#### 2.3 Analyze Chat Component Differences

**Current State:**

```
formcraft/chat/
├── ChatPanel.tsx              # Form creation chat
├── MessageWithParts.tsx       # AI message rendering
├── chat-components/
│   ├── chat-input.tsx         # Message input
│   └── chat.tsx              # Chat container

formfiller/chat/
├── conversation.tsx           # Form filling chat
├── message-assistant.tsx     # AI responses
├── message-user.tsx          # User messages
└── QuestionWrapper.tsx       # Question context
```

**Consolidation Strategy:**

1. **Create unified chat system** in packages/ui
2. **Mode-aware components** (creation vs. filling)
3. **Shared message types** and rendering logic
4. **Context-specific customization** via props

#### 2.4 Design Unified Chat Architecture

```typescript
// packages/ui/src/components/chat/
ChatContainer.tsx; // Main chat wrapper
MessageRenderer.tsx; // Unified message display
ChatInput.tsx; // Unified input component
MessageTypes.tsx; // Shared type definitions

// Mode-specific behavior via props:
interface ChatContainerProps {
  mode: "creation" | "filling" | "assistance";
  context: FormContext | SubmissionContext;
  customizations?: ChatCustomizations;
}
```

---

## Week 3: Complex Component Migration

### Day 13-15: Data Table System Migration

#### 3.1 Rationalize Data Table Components

**Current State (15+ components):**

```
data-table/
├── data-table.tsx                      # Core table
├── data-table-provider.tsx             # Context provider
├── data-table-toolbar.tsx              # Action toolbar
├── data-table-pagination.tsx           # Pagination controls
├── data-table-filter-*.tsx            # 8 filter components
├── data-table-view-options.tsx        # Column visibility
└── dataTableStore.ts                  # State management
```

**Simplified Architecture:**

```typescript
// packages/ui/src/components/data-table/
DataTable.tsx                    // Core table with composition API
DataTableProvider.tsx            // Context & state management
DataTableToolbar.tsx            // Composable toolbar
DataTableFilter.tsx             // Unified filter component
DataTablePagination.tsx         // Pagination controls

// Usage pattern:
<DataTable>
  <DataTableToolbar>
    <DataTableFilter type="search" />
    <DataTableFilter type="select" options={...} />
  </DataTableToolbar>
  <DataTableContent columns={...} data={...} />
  <DataTablePagination />
</DataTable>
```

#### 3.2 Migration Strategy

1. **Create simplified core** in packages/ui
2. **Maintain backward compatibility** during transition
3. **Update formcraft usage** gradually
4. **Remove complex filters** not actively used
5. **Document composition patterns**

### Day 16-19: Layout Component Migration

#### 3.3 Extract Layout Primitives

**Target Components:**

```typescript
// High-value layout components to extract:
FloatingPanel.tsx; // Draggable panel with constraints
TwoColumnLayout.tsx; // Resizable column layout
ResizeHandle.tsx; // Resize interaction primitive
```

**Migration Approach:**

1. **Analyze current usage patterns**
2. **Extract core functionality** to packages/ui
3. **Create composable API** for different use cases
4. **Maintain app-specific customizations** via props/styling

---

## Week 4: Cleanup & Documentation

### Day 20-22: File Cleanup & Import Updates

#### 4.1 Mass Import Update Strategy

```bash
# Create import mapping file
echo "Creating import mapping..."
cat > import-mapping.json << EOF
{
  "../../components/custom/date-picker-with-range": "@formlink/ui",
  "../../components/custom/input-with-addons": "@formlink/ui",
  "../../components/custom/kbd": "@formlink/ui",
  "../../components/data-table/data-table": "@formlink/ui",
  "../chat/ChatPanel": "@formlink/ui"
}
EOF

# Update imports across codebase
for file in $(find apps/ -name "*.tsx" -o -name "*.ts"); do
  # Replace imports using sed or custom script
  sed -i.bak -f import-replacements.sed "$file"
done
```

#### 4.2 Remove Duplicate Files

```bash
# After confirming all imports updated:
rm -rf apps/formcraft/app/dashboard/forms/[formId]/components/custom/
rm -rf apps/formcraft/app/dashboard/forms/[formId]/components/data-table/
# Remove other duplicate directories after verification
```

### Day 23-26: Documentation & Governance

#### 4.3 Create Component Documentation

**Structure:**

```
docs/
├── COMPONENT_GUIDELINES_v1.md          # Development guidelines
├── SHARED_COMPONENTS_v1.md             # Usage documentation
└── MIGRATION_RESULTS_v1.md             # Post-migration report
```

#### 4.4 Implement Governance Tools

```bash
# Pre-commit hook to prevent app-specific components
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
# Check for new app-specific components
if git diff --cached --name-only | grep -E "apps/.*/components/.*\.tsx$"; then
  echo "❌ App-specific components detected. Use packages/ui instead."
  echo "📋 See docs/COMPONENT_GUIDELINES.md for guidance"
  exit 1
fi
EOF
```

---

## Risk Mitigation & Rollback Plan

### High-Risk Areas

1. **Chat component integration** - Complex state management
2. **Data table migration** - Heavy usage in formcraft
3. **Layout components** - Core UX dependencies

### Mitigation Strategies

1. **Feature flags** for component migrations
2. **Parallel implementation** during transition
3. **Comprehensive testing** before removal
4. **Staged rollout** with monitoring

### Rollback Plan

```bash
# Emergency rollback script
git stash                    # Save current work
git checkout backup-branch   # Pre-migration backup
pnpm install                # Restore dependencies
pnpm dev                    # Verify functionality
```

---

## Testing & Validation Plan

### Testing Strategy

1. **Unit tests** for migrated components
2. **Integration tests** for critical paths
3. **Visual regression tests** for UI components
4. **Manual testing** of all affected workflows

### Validation Checklist

- [ ] All apps build successfully
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] No runtime errors in development
- [ ] Form creation workflow functional
- [ ] Form filling workflow functional
- [ ] Chat functionality preserved
- [ ] Data table operations working

---

## Success Metrics

### Technical Metrics

- **Component duplication**: <10% (target from ~40%)
- **Build time improvement**: 15-20% faster builds
- **Bundle size**: Reduced through better tree-shaking
- **Import count**: Fewer import paths per component

### Development Metrics

- **PR velocity**: Faster feature development
- **Bug reduction**: Fewer component-related issues
- **Developer onboarding**: Clearer component structure
- **Maintenance**: Single location for component fixes

---

## Post-Migration Actions

### Immediate (Week 5)

1. **Monitor for regressions** - 48 hour watch period
2. **Update team documentation** - New component guidelines
3. **Team training** - Component usage patterns
4. **Performance baseline** - Measure improvements

### Short-term (Month 2)

1. **Component usage analytics** - Track adoption patterns
2. **Developer feedback** - Identify friction points
3. **Optimization opportunities** - Further consolidation
4. **Storybook enhancement** - Better component demos

This aggressive but necessary plan will eliminate the duplication crisis and establish FormLink on a solid foundation for rapid, maintainable development.
