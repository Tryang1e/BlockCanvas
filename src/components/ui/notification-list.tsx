'use client';

import * as React from 'react';
import { Mail, ArrowUpRight } from 'lucide-react';
import { motion, type Transition } from 'framer-motion';

export interface NotificationMessage {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  is_read: boolean;
}

interface NotificationListProps {
  notifications: NotificationMessage[];
  onViewAll?: () => void;
}

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' as any },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' as any },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' as any },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' as any },
};

export function NotificationList({ notifications, onViewAll }: NotificationListProps) {
  if (!notifications || notifications.length === 0) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 p-6 rounded-3xl w-full max-w-sm text-center">
        <p className="text-neutral-400 font-medium">새로운 메시지가 없습니다.</p>
      </div>
    )
  }

  // Show up to 4 notifications to prevent huge stack
  const displayNotifs = notifications.slice(0, 4);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <motion.div
      className="bg-neutral-200 dark:bg-neutral-900 p-3 rounded-3xl w-full max-w-sm space-y-3 shadow-md border border-neutral-300 dark:border-neutral-800"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {displayNotifs.map((notification, i) => (
          <motion.div
            key={notification.id}
            className={`bg-white dark:bg-neutral-800 rounded-xl px-4 py-3 shadow-sm hover:shadow-lg transition-shadow duration-200 relative border ${notification.is_read ? 'border-transparent' : 'border-blue-500/30 dark:border-blue-500/50'}`}
            variants={getCardVariants(i)}
            transition={transition}
            style={{
              zIndex: displayNotifs.length - i,
            }}
          >
            <div className="flex justify-between items-center mb-1">
              <h1 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 truncate pr-2">
                {notification.title}
              </h1>
              {!notification.is_read && (
                <div className="flex items-center text-[10px] gap-1 font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Mail className="size-3" />
                  <span>New</span>
                </div>
              )}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate flex items-center justify-between">
              <span className="truncate pr-4">{notification.subtitle}</span>
              <span className="shrink-0 text-[10px] opacity-70">{notification.time}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-2">
        <div className={`size-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${unreadCount > 0 ? 'bg-blue-500' : 'bg-neutral-400 dark:bg-neutral-700'}`}>
          {notifications.length}
        </div>
        <span className="grid relative overflow-hidden h-6 w-full cursor-pointer" onClick={onViewAll}>
          <motion.span
            className="text-sm font-bold text-neutral-700 dark:text-neutral-300 row-start-1 col-start-1 flex items-center h-full"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            {unreadCount > 0 ? `${unreadCount}개의 새 메시지` : '받은 메시지함'}
          </motion.span>
          <motion.span
            className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1 h-full"
            variants={viewAllTextVariants}
            transition={textSwitchTransition}
          >
            모두 보기 <ArrowUpRight className="size-4" />
          </motion.span>
        </span>
      </div>
    </motion.div>
  );
}
