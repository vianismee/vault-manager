"use client";

import { useState } from "react";
import { Folder, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/lib/realtime/hooks";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface CategorySelectProps {
  value?: string | null;
  onChange: (categoryId: string | null) => void;
  className?: string;
  placeholder?: string;
}

export function CategorySelect({
  value,
  onChange,
  className,
  placeholder = "Select category",
}: CategorySelectProps) {
  const { data: categories, loading } = useCategories();
  const [open, setOpen] = useState(false);

  const selectedCategory = categories?.find((c) => c.id === value);

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
      >
        {selectedCategory ? (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ backgroundColor: `${selectedCategory.color}15` }}
            >
              <Folder
                className="h-4 w-4"
                style={{ color: selectedCategory.color }}
              />
            </div>
            <span className="text-sm font-medium">{selectedCategory.name}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {/* No Category Option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                <Folder className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm">No category</span>
                {!value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </button>

            {/* Divider */}
            {categories && categories.length > 0 && (
              <div className="border-t border-border" />
            )}

            {/* Category Options */}
            <div className="max-h-48 overflow-y-auto">
              {categories?.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    onChange(category.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left",
                    value === category.id && "bg-muted/50"
                  )}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}15` }}
                  >
                    <Folder
                      className="h-4 w-4"
                      style={{ color: category.color }}
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm">{category.name}</span>
                    {value === category.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Empty State */}
            {!loading && (!categories || categories.length === 0) && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No categories created yet
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Loading categories...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
