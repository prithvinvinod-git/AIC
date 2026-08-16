"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, LayoutGroup, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { Layers, LayoutList } from "lucide-react";

export type LayoutMode = "stack" | "list";

export interface CardData {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
}

export interface MorphingCardStackProps {
  cards?: CardData[];
  className?: string;
  defaultLayout?: LayoutMode;
  onCardClick?: (card: CardData) => void;
}

const layoutIcons = {
  stack: Layers,
  list: LayoutList,
};

const SWIPE_THRESHOLD = 50;

export function MorphingCardStack({
  cards = [],
  className,
  defaultLayout = "stack",
  onCardClick,
}: MorphingCardStackProps) {
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!cards || cards.length === 0) return null;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;
    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      setActiveIndex((prev) => (prev + 1) % cards.length);
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }
    setIsDragging(false);
  };

  const getStackOrder = () => {
    const reordered = [];
    for (let i = 0; i < cards.length; i++) {
      const index = (activeIndex + i) % cards.length;
      reordered.push({ ...cards[index], stackPosition: i });
    }
    return reordered.reverse();
  };

  const getLayoutStyles = (stackPosition: number) => {
    if (layout === "stack") {
      return {
        top: stackPosition * 10,
        left: stackPosition * 10,
        zIndex: cards.length - stackPosition,
        rotate: (stackPosition - 1) * 2,
      };
    }
    return { top: 0, left: 0, zIndex: 1, rotate: 0 };
  };

  const containerStyles = {
    stack: "relative h-60 w-64",
    list: "flex flex-col gap-3",
  };

  const displayCards =
    layout === "stack"
      ? getStackOrder()
      : cards.map((c, i) => ({ ...c, stackPosition: i }));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Layout Toggle */}
      <div className="flex items-center justify-center gap-1 rounded-lg bg-smoke p-1 w-fit mx-auto">
        {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
          const Icon = layoutIcons[mode];
          return (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              className={cn(
                "rounded-md p-2 transition-all",
                layout === mode
                  ? "bg-accent text-white"
                  : "text-slate hover:text-ink hover:bg-silver"
              )}
              aria-label={`Switch to ${mode} layout`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Cards Container */}
      <LayoutGroup>
        <motion.div
          layout
          className={cn(containerStyles[layout], layout === "stack" && "mx-auto")}
        >
          <AnimatePresence mode="popLayout">
            {displayCards.map((card) => {
              const styles = getLayoutStyles(card.stackPosition);
              const isExpanded = expandedCard === card.id;
              const isTopCard = layout === "stack" && card.stackPosition === 0;

              return (
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: isExpanded ? 1.05 : 1,
                    x: 0,
                    ...styles,
                  }}
                  exit={{ opacity: 0, scale: 0.8, x: -200 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  drag={isTopCard ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                  onClick={() => {
                    if (isDragging) return;
                    setExpandedCard(isExpanded ? null : card.id);
                    onCardClick?.(card);
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border border-silver bg-white p-4 transition-colors flex flex-col",
                    "hover:border-accent/50",
                    layout === "stack" && "absolute w-64 h-56",
                    layout === "stack" && isTopCard && "cursor-grab active:cursor-grabbing",
                    layout === "list" && "w-full",
                    isExpanded && "ring-2 ring-accent"
                  )}
                >
                  {/* Icon + heading at top */}
                  <div className="flex items-center gap-3">
                    {card.icon && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-accent">
                        {card.icon}
                      </div>
                    )}
                    <h3 className="font-display text-lg font-semibold text-accent break-words">
                      {card.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-sm text-slate text-center flex items-center justify-center break-words",
                      layout === "stack" ? "mt-12" : "mt-3"
                    )}
                  >
                    {card.description}
                  </p>

                  {isTopCard && (
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="text-xs text-stone/50">Swipe to navigate</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {layout === "stack" && cards.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex
                  ? "w-4 bg-accent"
                  : "w-1.5 bg-silver hover:bg-stone"
              )}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
