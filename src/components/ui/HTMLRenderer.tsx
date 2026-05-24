import React, { useState } from 'react';
import parse, { attributesToProps, domToReact, Element } from 'html-react-parser';
import DOMPurify from 'isomorphic-dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { 
  TypingText, 
  SplittingText, 
  SlidingText, 
  ShimmeringText, 
  RollingText, 
  TextRotate, 
  HighlightText, 
  TextMorph, 
  GradientText,
  DefaultButton,
  FlipButton,
  RippleButton,
  LiquidButton
} from '@/components/ui/animate-ui';
import { PreviewLinkCard } from '@/components/ui/preview-link-card';

// HTMLRenderer 내부 전용 고품격 아코디언 컴포넌트
function FaqAccordion({ 
  question, 
  answer, 
  styles = {} 
}: { 
  question: string, 
  answer: string, 
  styles?: Record<string, string> 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cleanQuestion = (question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');

  const qFont = styles['q-font'] || 'inherit'
  const qSize = styles['q-size'] || '15px'
  const qColor = styles['q-color'] || ''
  const qBold = styles['q-bold'] === 'true'
  const qItalic = styles['q-italic'] === 'true'

  const aFont = styles['a-font'] || 'inherit'
  const aSize = styles['a-size'] || '14px'
  const aColor = styles['a-color'] || ''
  const aBold = styles['a-bold'] === 'true'
  const aItalic = styles['a-italic'] === 'true'

  const borderStyle = styles['border-style'] || 'minimal'
  const hoverBg = styles['hover-bg'] || 'tint'

  let wrapperClass = "transition-all duration-300 select-none group/faq relative overflow-hidden "
  let decorationLeftBar = null
  let listDotIndicator = null

  if (borderStyle === 'glass') {
    wrapperClass += "bg-gradient-to-br from-white/95 to-white/40 dark:from-neutral-900/95 dark:to-neutral-900/40 backdrop-blur-md border border-white/80 dark:border-neutral-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] rounded-2xl px-6 py-5 my-4 hover:border-blue-500/30 dark:hover:border-blue-400/30 transform hover:-translate-y-0.5 "
  } else if (borderStyle === 'solid') {
    wrapperClass += "border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl pl-6 pr-5 py-4.5 my-3 "
    decorationLeftBar = (
      <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-blue-600 dark:bg-blue-500" />
    )
  } else {
    wrapperClass += "border-b border-neutral-200/80 dark:border-neutral-800/60 py-5 "
    listDotIndicator = (
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mr-2.5 shrink-0 transition-transform duration-300 group-hover/faq:scale-130" />
    )
  }

  if (hoverBg === 'tint' && borderStyle !== 'glass') {
    wrapperClass += "hover:bg-blue-50/20 dark:hover:bg-blue-950/5 rounded-lg px-2.5 -mx-2.5 "
  }

  const questionStyle: React.CSSProperties = {
    fontFamily: qFont !== 'inherit' ? qFont : undefined,
    fontSize: qSize,
    color: qColor || undefined,
    fontWeight: qBold ? 'bold' : 'normal',
    fontStyle: qItalic ? 'italic' : 'normal',
  }

  const answerStyle: React.CSSProperties = {
    fontFamily: aFont !== 'inherit' ? aFont : undefined,
    fontSize: aSize,
    color: aColor || undefined,
    fontWeight: aBold ? 'bold' : 'normal',
    fontStyle: aItalic ? 'italic' : 'normal',
  }

  return (
    <div className={wrapperClass}>
      {decorationLeftBar}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer text-neutral-900 dark:text-neutral-100 pr-1 gap-6 hover:opacity-85 transition-opacity"
      >
        <div className="flex items-center select-text">
          {listDotIndicator}
          <span 
            style={questionStyle}
            className="tracking-tight leading-relaxed font-semibold"
          >
            {cleanQuestion || '질문이 비어있습니다.'}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          strokeWidth={2.5}
          className={`text-neutral-450 dark:text-neutral-550 transition-all duration-300 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-450 scale-105' : 'group-hover/faq:text-neutral-700 dark:group-hover/faq:text-neutral-300'
          }`}
        />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              overflow: 'hidden',
            }}
          >
            <p 
              style={answerStyle}
              className="leading-relaxed whitespace-pre-wrap mt-3.5 pr-2 text-left select-text"
            >
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface HTMLRendererProps {
  html: string;
}

export default function HTMLRenderer({ html }: HTMLRendererProps) {
  const cleanHtml = DOMPurify.sanitize(html || '<p></p>', {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'data-animated-group', 'data-texts', 'data-text-size', 'data-is-bold', 'data-is-italic', 'data-font-family', 'data-align', 
      'allowfullscreen', 'frameborder', 'scrolling', 
      'data-button-link', 'data-style', 'data-bg-color', 'data-text', 'data-text-color', 'data-button-width', 'data-button-height',
      'data-type', 'data-question', 'data-answer', 'data-q-font', 'data-q-size', 'data-q-color', 'data-q-bold', 'data-q-italic', 
      'data-a-font', 'data-a-size', 'data-a-color', 'data-a-bold', 'data-a-italic', 'data-border-style', 'data-hover-bg'
    ]
  });

  const options = {
    replace: (domNode: any) => {
      if (domNode instanceof Element && domNode.attribs && domNode.attribs['data-type'] === 'faq-block') {
        const question = domNode.attribs['data-question'] || '';
        const answer = domNode.attribs['data-answer'] || '';
        
        const styles: Record<string, string> = {
          'q-font': domNode.attribs['data-q-font'] || 'inherit',
          'q-size': domNode.attribs['data-q-size'] || '15px',
          'q-color': domNode.attribs['data-q-color'] || '',
          'q-bold': domNode.attribs['data-q-bold'] || 'true',
          'q-italic': domNode.attribs['data-q-italic'] || 'false',
          'a-font': domNode.attribs['data-a-font'] || 'inherit',
          'a-size': domNode.attribs['data-a-size'] || '14px',
          'a-color': domNode.attribs['data-a-color'] || '',
          'a-bold': domNode.attribs['data-a-bold'] || 'false',
          'a-italic': domNode.attribs['data-a-italic'] || 'false',
          'border-style': domNode.attribs['data-border-style'] || 'minimal',
          'hover-bg': domNode.attribs['data-hover-bg'] || 'tint'
        };

        return <FaqAccordion question={question} answer={answer} styles={styles} />;
      }

      if (domNode instanceof Element && domNode.attribs && domNode.attribs['data-animated-group']) {
        const animationType = domNode.attribs['data-animated-group'];
        const textsRaw = domNode.attribs['data-texts'];
        const textSize = domNode.attribs['data-text-size'] || '1.25rem';
        const isBold = domNode.attribs['data-is-bold'] !== 'false';
        const isItalic = domNode.attribs['data-is-italic'] === 'true';
        const fontFamily = domNode.attribs['data-font-family'] || 'inherit';
        const align = domNode.attribs['data-align'] || 'center';
        const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';

        let parsedTexts = [''];
        try {
          if (textsRaw) parsedTexts = JSON.parse(textsRaw);
        } catch (e) {
          // ignore parsing error
        }

        const appliedClass = `${isBold ? 'font-bold' : ''} ${isItalic ? 'italic' : ''} whitespace-pre-wrap break-words max-w-full inline-block`;
        
        let styleStr = '';
        if (fontFamily !== 'inherit') styleStr += `font-family: ${fontFamily}; `;
        styleStr += `font-size: ${textSize};`;

        const renderProps = {
          className: appliedClass,
          style: {
            fontFamily: fontFamily !== 'inherit' ? fontFamily : undefined,
            fontSize: textSize,
            fontWeight: isBold ? 'bold' : 'normal',
            fontStyle: isItalic ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '100%'
          } as React.CSSProperties
        };

        const renderComponent = () => {
          switch (animationType) {
            case 'typing': return <TypingText text={parsedTexts[0]} />;
            case 'splitting': return <SplittingText text={parsedTexts[0]} />;
            case 'sliding': return <SlidingText text={parsedTexts[0]} />;
            case 'shimmering': return <ShimmeringText text={parsedTexts[0]} />;
            case 'rolling': return <RollingText text={parsedTexts[0]} />;
            case 'rotating': return <TextRotate texts={parsedTexts} className={`w-full ${alignClass} min-w-[120px]`} />;
            case 'highlight': return <HighlightText text={parsedTexts[0]} />;
            case 'morphing': return <TextMorph texts={parsedTexts} className={`w-full ${alignClass}`} />;
            case 'gradient': return <GradientText text={parsedTexts[0]} />;
            default: return <TypingText text={parsedTexts[0]} />;
          }
        };

        return (
          <div className={`my-4 block ${alignClass}`}>
            <span {...renderProps}>
              {renderComponent()}
            </span>
          </div>
        );
      }
      
      if (domNode instanceof Element && domNode.name === 'div' && domNode.attribs && domNode.attribs['data-button-link'] !== undefined) {
        const buttonStyle = domNode.attribs['data-style'] || 'default';
        const bgColor = domNode.attribs['data-bg-color'] || '#171717';
        const textColor = domNode.attribs['data-text-color'] || '#ffffff';
        const buttonWidth = domNode.attribs['data-button-width'] || '';
        const buttonHeight = domNode.attribs['data-button-height'] || '';
        const textSize = domNode.attribs['data-text-size'] || '14';
        const fontFamily = domNode.attribs['data-font-family'] || '';
        const isBold = domNode.attribs['data-is-bold'] === 'true';
        const isItalic = domNode.attribs['data-is-italic'] === 'true';
        const text = domNode.attribs['data-text'] || '버튼';
        const align = domNode.attribs['data-align'] || 'center';
        
        const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
        const aTag = domNode.children?.find(c => c instanceof Element && c.name === 'a') as Element | undefined;
        const href = aTag?.attribs?.href || '#';

        const styleObj: any = { backgroundColor: bgColor, color: textColor, fontSize: `${textSize}px` };
        if (buttonWidth) styleObj.width = `${buttonWidth}px`;
        if (buttonHeight) styleObj.height = `${buttonHeight}px`;
        if (fontFamily) styleObj.fontFamily = fontFamily;
        if (isBold) styleObj.fontWeight = 'bold';
        if (isItalic) styleObj.fontStyle = 'italic';

        const renderComponent = () => {
          let btn;
          switch (buttonStyle) {
            case 'flip': btn = <FlipButton href={href} style={styleObj}>{text}</FlipButton>; break;
            case 'ripple': btn = <RippleButton href={href} style={styleObj}>{text}</RippleButton>; break;
            case 'liquid': btn = <LiquidButton href={href} style={styleObj}>{text}</LiquidButton>; break;
            default: btn = <DefaultButton href={href} style={styleObj}>{text}</DefaultButton>; break;
          }
          
          if (href && href.startsWith('http')) {
            return (
              <PreviewLinkCard href={href} asChild>
                {btn}
              </PreviewLinkCard>
            );
          }
          return btn;
        }

        return (
          <div className={`my-4 block ${alignClass}`}>
            {renderComponent()}
          </div>
        );
      }
      if (domNode instanceof Element && domNode.name === 'a') {
        const href = domNode.attribs?.href;
        if (href && href.startsWith('http')) {
          const props = attributesToProps(domNode.attribs);
          return (
            <PreviewLinkCard href={href} asChild>
              <a {...props} target="_blank" rel="noopener noreferrer">
                {domToReact(domNode.children as any, options)}
              </a>
            </PreviewLinkCard>
          );
        }
      }
    }
  };

  return <>{parse(cleanHtml, options)}</>;
}
