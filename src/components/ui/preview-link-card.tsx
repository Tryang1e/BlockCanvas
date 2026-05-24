'use client';

import React, { useState } from 'react';
import { PreviewCard, PreviewCardTrigger, PreviewCardPanel } from './preview-card';
import { ExternalLink } from 'lucide-react';

interface PreviewLinkCardProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function PreviewLinkCard({ href, children, className, asChild = false }: PreviewLinkCardProps) {
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Basic validation to avoid breaking on relative links
  const isExternal = href.startsWith('http');

  const fetchMetadata = async () => {
    if (!isExternal || metadata || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(href)}`);
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isExternal) {
    if (asChild) return <>{children}</>;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <PreviewCard onOpenChange={(open) => { if (open) fetchMetadata(); }}>
      <PreviewCardTrigger asChild>
        {asChild ? (
          children
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
          </a>
        )}
      </PreviewCardTrigger>
      <PreviewCardPanel className="w-[320px] p-0 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#1a1a1a]">
        {loading && !metadata ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="h-32 w-full animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-lg"></div>
            <div className="h-4 w-3/4 animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded"></div>
            <div className="h-3 w-1/2 animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded"></div>
          </div>
        ) : metadata ? (
          <div className="flex flex-col text-sm">
            {metadata.image && (
              <div className="w-full h-[160px] relative overflow-hidden bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <img src={metadata.image} alt={metadata.title || ''} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {metadata.favicon && <img src={metadata.favicon} alt="" className="w-4 h-4 rounded-sm" />}
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 truncate">
                  {new URL(href).hostname}
                </span>
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                {metadata.title || new URL(href).hostname}
              </h3>
              {metadata.description && (
                <p className="text-neutral-500 dark:text-neutral-400 line-clamp-2 text-xs">
                  {metadata.description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 flex items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400">
            <ExternalLink size={16} />
            <span className="text-sm font-medium">{new URL(href).hostname}</span>
          </div>
        )}
      </PreviewCardPanel>
    </PreviewCard>
  );
}
