'use client';

import * as React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { motion } from 'framer-motion';

export const PreviewCard = HoverCardPrimitive.Root;
export const PreviewCardTrigger = HoverCardPrimitive.Trigger;

export const PreviewCardPanel = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = 'center', sideOffset = 8, children, ...props }, ref) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={`z-50 w-64 rounded-xl border border-neutral-200 bg-white p-4 text-neutral-950 shadow-xl outline-none dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-50 ${className || ''}`}
      {...props}
      asChild
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {children}
      </motion.div>
    </HoverCardPrimitive.Content>
  </HoverCardPrimitive.Portal>
));
PreviewCardPanel.displayName = HoverCardPrimitive.Content.displayName;
