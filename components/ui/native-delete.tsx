"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";

export interface NativeDeleteProps {
  onConfirm?: () => void;
  onDelete: () => void;
  buttonText?: string;
  confirmText?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

const sizeVariants = { sm: "h-8 text-xs px-3", md: "h-10 text-sm px-4", lg: "h-12 text-base px-6" };
const iconSizeVariants = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };
const cancelButtonSizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };

const spring = { type: "spring" as const, stiffness: 260, damping: 24, mass: 0.5 };

export function NativeDelete({
  onConfirm,
  onDelete,
  buttonText = "Eliminar",
  confirmText = "Confirmar",
  size = "md",
  showIcon = true,
  compact = false,
  className,
  disabled = false,
}: NativeDeleteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDeleteClick = () => {
    if (!disabled) { setIsExpanded(true); onConfirm?.(); }
  };

  const handleConfirm = () => { onDelete(); setIsExpanded(false); };
  const handleCancel = () => { setIsExpanded(false); };

  const cancelBtn = (
    <motion.div
      initial={false}
      animate={isExpanded
        ? { opacity: 1, scale: 1, width: "auto", pointerEvents: "auto" as const }
        : compact
          ? { opacity: 0, scale: 0.7, width: 0, pointerEvents: "none" as const }
          : { opacity: 0, scale: 0.7, pointerEvents: "none" as const }}
      transition={spring}
      style={{ overflow: "hidden", pointerEvents: isExpanded ? "auto" : "none" }}
      whileHover={isExpanded ? { scale: 1.06 } : undefined}
      whileTap={isExpanded ? { scale: 0.94 } : undefined}
    >
      <Button
        variant="outline"
        size="icon"
        className={cn(cancelButtonSizes[size], "cursor-pointer")}
        onClick={handleCancel}
        aria-label="Cancelar"
        tabIndex={isExpanded ? 0 : -1}
      >
        <X className={iconSizeVariants[size]} />
      </Button>
    </motion.div>
  );

  const actionBtn = (
    <motion.div
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      transition={spring}
    >
      <Button
        variant="destructive"
        className={cn(
          compact ? cancelButtonSizes[size] : sizeVariants[size],
          "cursor-pointer text-white"
        )}
        onClick={isExpanded ? handleConfirm : handleDeleteClick}
        disabled={disabled}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isExpanded ? "check" : "trash"}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.12 }}
            className={cn("flex items-center", !compact && showIcon ? "mr-2" : "")}
          >
            {isExpanded
              ? <Check className={iconSizeVariants[size]} />
              : <Trash2 className={iconSizeVariants[size]} />}
          </motion.span>
        </AnimatePresence>
        {!compact && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isExpanded ? "confirm" : "delete"}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.12 }}
            >
              {isExpanded ? confirmText : buttonText}
            </motion.span>
          </AnimatePresence>
        )}
      </Button>
    </motion.div>
  );

  return (
    // In compact mode: [X][action] so cancel grows to the LEFT, pushing action right-ward
    // within a justify-end parent — the whole group shifts left naturally.
    // In normal mode: [action][X] with X always mounted for no layout shift.
    <div className={cn("inline-flex items-center gap-2", className)}>
      {compact ? <>{cancelBtn}{actionBtn}</> : <>{actionBtn}{cancelBtn}</>}
    </div>
  );
}
