"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Folder,
  Edit,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  Palette,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/lib/realtime/hooks";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChange?: () => void;
}

const COLOR_OPTIONS = [
  { value: "#e67c50", name: "Orange" },
  { value: "#3b82f6", name: "Blue" },
  { value: "#10b981", name: "Green" },
  { value: "#8b5cf6", name: "Purple" },
  { value: "#ef4444", name: "Red" },
  { value: "#f59e0b", name: "Amber" },
  { value: "#06b6d4", name: "Cyan" },
  { value: "#ec4899", name: "Pink" },
  { value: "#6366f1", name: "Indigo" },
  { value: "#84cc16", name: "Lime" },
  { value: "#14b8a6", name: "Teal" },
  { value: "#f97316", name: "Orange Red" },
];

export function CategoryManager({
  open,
  onOpenChange,
  onCategoriesChange,
}: CategoryManagerProps) {
  // Use realtime for live updates
  const { data: categories, loading } = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // New category form state
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#e67c50",
  });

  // Edit state
  const [editState, setEditState] = useState<{
    name: string;
    color: string;
  }>({ name: "", color: "" });

  // Reset form states when dialog opens
  useEffect(() => {
    if (open) {
      setShowAddForm(false);
      setEditingId(null);
      setDeleteConfirm(null);
      setNewCategory({ name: "", color: "#e67c50" });
    }
  }, [open]);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    // Check for duplicate
    if (categories && categories.some(c => c.name.toLowerCase() === newCategory.name.trim().toLowerCase())) {
      toast.error("A category with this name already exists");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("categories").insert({
        user_id: user.id,
        name: newCategory.name.trim(),
        icon: "folder",
        color: newCategory.color,
        sort_order: categories?.length || 0,
      });

      if (error) throw error;

      toast.success("Category created");
      setNewCategory({ name: "", color: "#e67c50" });
      setShowAddForm(false);
      // Realtime will automatically update all CategorySelect dropdowns
      onCategoriesChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    }
  };

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setEditState({ name: category.name, color: category.color });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editState.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    // Check for duplicate (excluding current)
    if (categories.some(c => c.id !== id && c.name.toLowerCase() === editState.name.trim().toLowerCase())) {
      toast.error("A category with this name already exists");
      return;
    }

    try {
      const { error } = await supabase
        .from("categories")
        .update({
          name: editState.name.trim(),
          color: editState.color,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Category updated");
      setEditingId(null);
      // Realtime will automatically update all CategorySelect dropdowns
      onCategoriesChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update category");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditState({ name: "", color: "" });
  };

  const handleDeleteCategory = async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (category?.name === "General") {
      toast.error("Cannot delete the General category");
      return;
    }

    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the General category for this user
      const { data: generalCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "General")
        .single();

      // Update passwords to use General category
      if (generalCategory) {
        await supabase
          .from("passwords")
          .update({ category_id: generalCategory.id })
          .eq("category_id", deleteConfirm);
      } else {
        // If no General category exists, remove category reference
        await supabase
          .from("passwords")
          .update({ category_id: null })
          .eq("category_id", deleteConfirm);
      }

      // Delete the category
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteConfirm);

      if (error) throw error;

      toast.success("Category deleted");
      setDeleteConfirm(null);
      // Realtime will automatically update all CategorySelect dropdowns
      onCategoriesChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-display">
            Manage Categories
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create and organize categories for your passwords
          </p>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add New Category Form */}
              {showAddForm ? (
                <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Category</span>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewCategory({ name: "", color: "#e67c50" });
                      }}
                      className="p-1 -mr-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Name Input */}
                  <Input
                    placeholder="Category name"
                    value={newCategory.name}
                    onChange={(e) =>
                      setNewCategory({ ...newCategory, name: e.target.value })
                    }
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    maxLength={30}
                  />

                  {/* Color Picker */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Palette className="h-3.5 w-3.5" />
                      <span>Choose a color</span>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewCategory({ ...newCategory, color: color.value })}
                          className={cn(
                            "aspect-square rounded-lg border-2 transition-all flex items-center justify-center",
                            newCategory.color === color.value
                              ? "border-foreground scale-105"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        >
                          {newCategory.color === color.value && (
                            <Check className="h-4 w-4 text-white drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleAddCategory}
                      disabled={!newCategory.name.trim()}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed py-6"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Category
                </Button>
              )}

              {/* Categories List */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground px-1">
                    Your Categories
                  </div>
                  {categories.map((category) => {
                    const isEditing = editingId === category.id;
                    const isDeleting = deleteConfirm === category.id;

                    return (
                      <div
                        key={category.id}
                        className={cn(
                          "group bg-card rounded-xl border border-border transition-all",
                          isEditing && "ring-2 ring-ring/20"
                        )}
                      >
                        {/* View Mode */}
                        {!isEditing && !isDeleting && (
                          <div className="flex items-center gap-3 p-3">
                            {/* Icon with color */}
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: `${category.color}15`,
                              }}
                            >
                              <Folder
                                className="h-5 w-5"
                                style={{ color: category.color }}
                              />
                            </div>

                            {/* Name */}
                            <span className="flex-1 font-medium">
                              {category.name}
                            </span>

                            {/* Actions */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleStartEdit(category)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {category.name !== "General" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteCategory(category.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Edit Mode */}
                        {isEditing && (
                          <div className="p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: `${editState.color}15`,
                                }}
                              >
                                <Folder
                                  className="h-4 w-4"
                                  style={{ color: editState.color }}
                                />
                              </div>
                              <Input
                                value={editState.name}
                                onChange={(e) =>
                                  setEditState({ ...editState, name: e.target.value })
                                }
                                className="flex-1 h-9"
                                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(category.id)}
                                placeholder="Category name"
                                maxLength={30}
                              />
                            </div>

                            {/* Color Picker */}
                            <div className="grid grid-cols-6 gap-1.5">
                              {COLOR_OPTIONS.map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  onClick={() => setEditState({ ...editState, color: color.value })}
                                  className={cn(
                                    "aspect-square rounded-md border-2 transition-all flex items-center justify-center",
                                    editState.color === color.value
                                      ? "border-foreground scale-105"
                                      : "border-transparent hover:scale-105"
                                  )}
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                >
                                  {editState.color === color.value && (
                                    <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                                  )}
                                </button>
                              ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(category.id)}
                                disabled={!editState.name.trim()}
                                className="flex-1"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="px-4"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Delete Confirmation Mode */}
                        {isDeleting && (
                          <div className="p-3 space-y-3">
                            <div className="flex items-start gap-2 text-sm text-destructive">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Delete "{category.name}"?</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Passwords in this category will be moved to General.
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={confirmDelete}
                                className="flex-1"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {!loading && categories.length === 0 && !showAddForm && (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Folder className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No categories yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create categories to organize your passwords
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
