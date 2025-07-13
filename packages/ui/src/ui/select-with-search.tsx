"use client"

import { cn } from "@/lib/utils"
import { Check } from "@phosphor-icons/react/Check";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretUp } from "@phosphor-icons/react/CaretUp";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";

import * as SelectPrimitive from "@radix-ui/react-select"
import * as React from "react"

interface SelectWithSearchContextValue {
  searchValue: string;
  setSearchValue: (value: string) => void;
}

const SelectWithSearchContext = React.createContext<SelectWithSearchContextValue | undefined>(undefined);

function useSelectWithSearch() {
  const context = React.useContext(SelectWithSearchContext);
  if (!context) {
    throw new Error("useSelectWithSearch must be used within SelectWithSearch");
  }
  return context;
}

interface SelectWithSearchProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  children: React.ReactNode;
}

function SelectWithSearch({ children, ...props }: SelectWithSearchProps) {
  const [searchValue, setSearchValue] = React.useState("");

  // Reset search when select closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchValue("");
    }
    props.onOpenChange?.(open);
  };

  return (
    <SelectWithSearchContext.Provider value={{ searchValue, setSearchValue }}>
      <SelectPrimitive.Root {...props} onOpenChange={handleOpenChange}>
        {children}
      </SelectPrimitive.Root>
    </SelectWithSearchContext.Provider>
  );
}

function SelectSearchInput({
  className,
  placeholder = "Search...",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const { searchValue, setSearchValue } = useSelectWithSearch();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus search input when dropdown opens
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative px-2 pb-2">
      <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-input bg-background px-8 py-1.5 text-sm",
          "placeholder:text-muted-foreground",
          "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
          className
        )}
        onKeyDown={(e) => {
          // Prevent select from closing on Enter in search
          if (e.key === "Enter") {
            e.preventDefault();
          }
          // Stop propagation to prevent interference with select keyboard nav
          e.stopPropagation();
        }}
        {...props}
      />
    </div>
  );
}

interface SelectSearchableContentProps extends React.ComponentProps<typeof SelectPrimitive.Content> {
  searchPlaceholder?: string;
}

function SelectSearchableContent({
  className,
  children,
  position = "popper",
  searchPlaceholder,
  ...props
}: SelectSearchableContentProps) {
  const { searchValue } = useSelectWithSearch();

  // Filter children based on search
  const filteredChildren = React.useMemo(() => {
    if (!searchValue) return children;

    const searchLower = searchValue.toLowerCase();

    return React.Children.toArray(children).filter((child) => {
      if (!React.isValidElement(child)) return true;
      
      // Keep non-item elements (like groups, labels)
      if (child.type !== SelectSearchableItem) return true;

      // Check if item text includes search value
      const childProps = child.props as { children?: React.ReactNode };
      const itemText = getItemText(childProps.children);
      return itemText.toLowerCase().includes(searchLower);
    });
  }, [children, searchValue]);

  // Show no results message
  const hasResults = Array.isArray(filteredChildren) && filteredChildren.length > 0;

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-background text-secondary-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border shadow-sm backdrop-blur-xl",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <div className="sticky top-0 bg-background border-b">
          <SelectSearchInput placeholder={searchPlaceholder} />
        </div>
        
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
          )}
        >
          {hasResults ? (
            filteredChildren
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

// Helper function to extract text from children
function getItemText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  
  if (React.isValidElement(children)) {
    const childProps = children.props as { children?: React.ReactNode };
    if (childProps.children) {
      return getItemText(childProps.children);
    }
  }
  
  if (Array.isArray(children)) {
    return children.map(getItemText).join("");
  }
  
  return "";
}

// Create searchable item that works with filtering
const SelectSearchableItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectSearchableItem.displayName = "SelectSearchableItem";

// Export all components with "WithSearch" suffix to avoid conflicts
export {
  SelectWithSearch,
  SelectSearchInput,
  SelectSearchableContent,
  SelectSearchableItem,
};

// Re-export from regular select with "WithSearch" suffix
export { 
  SelectGroup as SelectGroupWithSearch,
  SelectValue as SelectValueWithSearch,
  SelectTrigger as SelectTriggerWithSearch,
  SelectLabel as SelectLabelWithSearch,
  SelectSeparator as SelectSeparatorWithSearch
} from "./select";

// Re-export scroll buttons with proper styling
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <CaretUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <CaretDown className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}