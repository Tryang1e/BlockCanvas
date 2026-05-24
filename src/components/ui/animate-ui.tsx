import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TextRotate({ texts, rotationInterval = 2500, className = '' }: { texts: string[], rotationInterval?: number, className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % texts.length), rotationInterval);
    return () => clearInterval(id);
  }, [texts, rotationInterval]);

  const justifyClass = className.includes('text-left') ? 'justify-start' : className.includes('text-right') ? 'justify-end' : 'justify-center';
  const originClass = className.includes('text-left') ? 'origin-left' : className.includes('text-right') ? 'origin-right' : 'origin-center';

  return (
    <div className={`relative inline-block overflow-hidden h-[1.5em] align-bottom ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={index}
          initial={{ y: '100%', opacity: 0, rotateX: -90 }}
          animate={{ y: '0%', opacity: 1, rotateX: 0 }}
          exit={{ y: '-100%', opacity: 0, rotateX: 90 }}
          transition={{ type: 'spring', damping: 15, stiffness: 150 }}
          className={`whitespace-nowrap flex items-center ${justifyClass} h-full ${originClass}`}
        >
          {texts[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function TextMorph({ texts, rotationInterval = 3000, className = '' }: { texts: string[], rotationInterval?: number, className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % texts.length), rotationInterval);
    return () => clearInterval(id);
  }, [texts, rotationInterval]);

  const justifyClass = className.includes('text-left') ? 'justify-start' : className.includes('text-right') ? 'justify-end' : 'justify-center';
  const alignPosition = className.includes('text-left') ? 'left-0' : className.includes('text-right') ? 'right-0' : '';

  return (
    <div className={`relative inline-flex items-center ${justifyClass} h-[1.5em] min-w-[100px] ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.9, y: 5 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 }}
          exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.1, y: -5 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`absolute whitespace-nowrap ${alignPosition}`}
        >
          {texts[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function TypingText({ text, className = '' }: { text: string, className?: string }) {
  const chars = text.split('');
  return (
    <motion.span className={`inline-block ${className}`} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
      {chars.map((char, i) => (
        <motion.span key={i} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>{char}</motion.span>
      ))}
      <motion.span 
        animate={{ opacity: [1, 0] }} 
        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        className="inline-block w-[2px] h-[1em] bg-black dark:bg-white ml-[1px] align-middle -mt-[0.2em]"
      />
    </motion.span>
  );
}

export function SplittingText({ text, className = '' }: { text: string, className?: string }) {
  const chars = text.split('');
  return (
    <motion.span className={`inline-block ${className}`} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }}>
      {chars.map((char, i) => (
        <motion.span key={i} className="inline-block" variants={{ hidden: { opacity: 0, filter: 'blur(4px)', x: -5, scale: 1.2 }, visible: { opacity: 1, filter: 'blur(0px)', x: 0, scale: 1 } }} transition={{ duration: 0.4 }}>{char === ' ' ? '\u00A0' : char}</motion.span>
      ))}
    </motion.span>
  );
}

export function SlidingText({ text, className = '' }: { text: string, className?: string }) {
  const words = text.split(' ');
  return (
    <motion.span className={`inline-block overflow-hidden align-bottom ${className}`} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
      {words.map((word, i) => (
        <motion.span key={i} className="inline-block mr-[0.25em]" variants={{ hidden: { y: '100%', opacity: 0 }, visible: { y: '0%', opacity: 1 } }} transition={{ type: 'spring', damping: 15, stiffness: 100 }}>{word}</motion.span>
      ))}
    </motion.span>
  );
}

export function ShimmeringText({ text, className = '' }: { text: string, className?: string }) {
  return (
    <motion.span 
      className={`inline-block bg-gradient-to-r from-neutral-400 via-neutral-900 to-neutral-400 dark:from-neutral-500 dark:via-neutral-100 dark:to-neutral-500 bg-[length:200%_auto] bg-clip-text text-transparent ${className}`}
      animate={{ backgroundPosition: ['200% center', '0% center'] }}
      transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
    >
      {text}
    </motion.span>
  );
}

export function RollingText({ text, className = '' }: { text: string, className?: string }) {
  const chars = text.split('');
  return (
    <motion.span className={`inline-block overflow-hidden h-[1.5em] align-bottom ${className}`} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }}>
      {chars.map((char, i) => (
        <motion.span key={i} className="inline-block h-full" variants={{ hidden: { y: '100%', opacity: 0 }, visible: { y: '0%', opacity: 1 } }} transition={{ type: 'spring', damping: 12, stiffness: 120 }}>{char === ' ' ? '\u00A0' : char}</motion.span>
      ))}
    </motion.span>
  );
}

export function HighlightText({ text, className = '' }: { text: string, className?: string }) {
  return (
    <motion.span className={`relative inline-block mx-1 px-1 ${className}`}>
      <span className="relative z-10">{text}</span>
      <motion.span 
        className="absolute bottom-1 left-0 h-1/2 bg-yellow-300 dark:bg-yellow-500/50 -z-10 origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
      />
    </motion.span>
  );
}

export function GradientText({ text, className = '' }: { text: string, className?: string }) {
  return (
    <motion.span 
      className={`inline-block bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_auto] bg-clip-text text-transparent ${className}`}
      animate={{ backgroundPosition: ['200% center', '0% center'] }}
      transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
    >
      {text}
    </motion.span>
  );
}

// --- Button Components ---

export const DefaultButton = React.forwardRef<HTMLAnchorElement, any>(({ href, children, className, style, ...props }, ref) => {
  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all shadow-xs hover:opacity-90 !no-underline cursor-pointer ${className}`}
      style={style}
      {...props}
    >
      {children}
    </a>
  );
});
DefaultButton.displayName = "DefaultButton";

export const FlipButton = React.forwardRef<HTMLAnchorElement, any>(({ href, children, className, style, ...props }, ref) => {
  const frontVariants = {
    initial: { opacity: 1, rotateX: 0, y: '0%' },
    hover: { opacity: 0, rotateX: 90, y: '50%' },
  };
  const backVariants = {
    initial: { opacity: 0, rotateX: 90, y: '-50%' },
    hover: { opacity: 1, rotateX: 0, y: '0%' },
  };

  const { backgroundColor, color, padding, fontSize, fontFamily, fontWeight, fontStyle, ...wrapperStyle } = style || {};

  return (
    <motion.a
      ref={ref as any}
      href={href}
      target="_blank"
      initial="initial"
      whileHover="hover"
      whileTap={{ scale: 0.95 }}
      style={{ display: 'inline-grid', placeItems: 'center', perspective: '1000px', ...wrapperStyle }}
      className={`!p-0 bg-transparent !no-underline cursor-pointer ${className}`}
      {...props}
    >
      <motion.span
        variants={frontVariants}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium shadow-xs"
        style={{ gridArea: '1 / 1', backgroundColor: style?.backgroundColor, color: style?.color, padding: style?.padding, fontSize: style?.fontSize, fontFamily: style?.fontFamily, fontWeight: style?.fontWeight, fontStyle: style?.fontStyle, width: '100%', height: '100%' }}
      >
        {children}
      </motion.span>
      <motion.span
        variants={backVariants}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium shadow-md"
        style={{ 
          gridArea: '1 / 1', 
          backgroundColor: '#ffffff', 
          color: (style?.backgroundColor === '#ffffff' || style?.backgroundColor?.toLowerCase() === '#fff') ? '#171717' : style?.backgroundColor, 
          padding: style?.padding, 
          fontSize: style?.fontSize, 
          fontFamily: style?.fontFamily, 
          fontWeight: style?.fontWeight, 
          fontStyle: style?.fontStyle, 
          width: '100%', 
          height: '100%' 
        }}
      >
        {children}
      </motion.span>
    </motion.a>
  );
});
FlipButton.displayName = "FlipButton";

export const RippleButton = React.forwardRef<HTMLAnchorElement, any>(({ href, children, className, style, onClick, ...props }, ref) => {
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples([...ripples, { id: Date.now(), x, y }]);
    if (onClick) onClick(e);
  };

  return (
    <motion.a
      ref={ref as any}
      href={href}
      target="_blank"
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      className={`relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-md font-medium shadow-xs !no-underline cursor-pointer ${className}`}
      style={style}
      onClick={handleClick}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 10, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none w-5 h-5 bg-white/40 -translate-x-1/2 -translate-y-1/2"
            style={{ left: ripple.x, top: ripple.y }}
            onAnimationComplete={() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id))}
          />
        ))}
      </AnimatePresence>
    </motion.a>
  );
});
RippleButton.displayName = "RippleButton";

export const LiquidButton = React.forwardRef<HTMLAnchorElement, any>(({ href, children, className, style, ...props }, ref) => {
  return (
    <motion.a
      ref={ref as any}
      href={href}
      target="_blank"
      whileTap={{ scale: 0.95 }}
      whileHover={{
        scale: 1.05,
        '--liquid-button-fill-width': '100%',
        '--liquid-button-fill-height': '100%',
        '--liquid-button-delay': '0.3s',
        transition: {
          '--liquid-button-fill-width': { duration: 0 },
          '--liquid-button-fill-height': { duration: 0 },
          '--liquid-button-delay': { duration: 0 },
        },
      } as any}
      style={{
        '--liquid-button-fill-width': '-1%',
        '--liquid-button-fill-height': '3px',
        '--liquid-button-delay': '0s',
        '--liquid-button-color': 'rgba(255,255,255,0.25)',
        background: 'linear-gradient(var(--liquid-button-color) 0 0) no-repeat calc(200% - var(--liquid-button-fill-width, -1%)) 100% / 200% var(--liquid-button-fill-height, 0.2em)',
        transition: `background 0.3s var(--liquid-button-delay, 0s), color 0.3s 0.3s, background-position 0.3s calc(0.3s - var(--liquid-button-delay, 0s))`,
        ...style
      } as any}
      className={`relative inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium shadow-xs !no-underline cursor-pointer ${className}`}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.a>
  );
});
LiquidButton.displayName = "LiquidButton";
