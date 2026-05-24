'use client';

import * as React from 'react';
import { useTheme } from '@/components/theme-provider';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThemeSelection = 'light' | 'dark' | 'system';

export function ThemeTogglerButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const getIcon = () => {
    const activeTheme = theme === 'system' ? resolvedTheme : theme;
    return activeTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />;
  };

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    // Simple toggle between light and dark
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <button
      data-slot="theme-toggler-button"
      className={cn(
        "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 h-10 w-10 text-neutral-900 dark:text-neutral-50 backdrop-blur-md shadow-lg",
        className
      )}
      onClick={handleToggle}
      {...props}
    >
      {getIcon()}
    </button>
  );
}
