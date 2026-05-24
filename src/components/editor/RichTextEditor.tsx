'use client'

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Link } from '@tiptap/extension-link'
import { FontFamily } from '@tiptap/extension-font-family'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension, Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    // AnimatedText Mark is completely removed.
    animatedTextGroup: {
      insertAnimatedTextGroup: (options: any) => ReturnType,
    }
    columnBlock: {
      insertTwoColumns: () => ReturnType,
      insertColumns: (ratio: '50-50' | '30-70' | '70-30' | '40-60' | '60-40' | '33-33-33') => ReturnType,
    }
  }
}

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  MousePointerSquareDashed,
  Columns2,
  GripVertical,
  ChevronDown,
  X
} from 'lucide-react'
import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from '@tiptap/extension-image'
import { Node, mergeAttributes } from '@tiptap/core'
import { uploadFileAction } from '@/app/actions/upload'
import { motion, AnimatePresence } from 'framer-motion'
import { TextRotate, TextMorph, TypingText, SplittingText, SlidingText, ShimmeringText, RollingText, HighlightText, GradientText } from '@/components/ui/animate-ui'
import { DefaultButton, FlipButton, RippleButton, LiquidButton } from '@/components/ui/animate-ui'
import Tooltip from '@/components/ui/Tooltip'

const ImageSizeInputs = ({ editor }: { editor: Editor }) => {
  const [naturalWidth, setNaturalWidth] = useState<string>('')
  const [naturalHeight, setNaturalHeight] = useState<string>('')

  useEffect(() => {
    const updateSize = () => {
      setTimeout(() => {
        const { view, state } = editor
        if ('node' in state.selection) {
          const node = (state.selection as any).node
          if (node && (node.type.name === 'customImage' || node.type.name === 'image')) {
            const dom = view.nodeDOM(state.selection.from) as HTMLImageElement
            if (dom && dom.tagName === 'IMG') {
              setNaturalWidth(dom.clientWidth.toString())
              setNaturalHeight(dom.clientHeight.toString())
            } else if (dom) {
              const img = dom.querySelector('img')
              if (img) {
                setNaturalWidth(img.clientWidth.toString())
                setNaturalHeight(img.clientHeight.toString())
              }
            }
          }
        }
      }, 0)
    }

    editor.on('selectionUpdate', updateSize)
    updateSize()

    return () => {
      editor.off('selectionUpdate', updateSize)
    }
  }, [editor])

  const attrs = editor.getAttributes('customImage')

  return (
    <>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400 px-1">가로</span>
        <input
          type="number"
          value={attrs.width || ''}
          onChange={e => editor.chain().updateImageAttrs({ width: e.target.value }).run()}
          placeholder={naturalWidth || "자동"}
          className="w-12 px-1 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none placeholder:text-neutral-600"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400 px-1">세로</span>
        <input
          type="number"
          value={attrs.height || ''}
          onChange={e => editor.chain().updateImageAttrs({ height: e.target.value }).run()}
          placeholder={naturalHeight || "자동"}
          className="w-12 px-1 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none placeholder:text-neutral-600"
        />
      </div>
    </>
  )
}

const ImageLinkInput = ({ editor }: { editor: Editor }) => {
  const attrs = editor.getAttributes('customImage')
  const [localUrl, setLocalUrl] = useState(attrs.href || '')

  useEffect(() => {
    setLocalUrl(attrs.href || '')
  }, [attrs.href])

  const handleBlur = () => {
    let finalUrl = localUrl.trim()
    if (finalUrl && !finalUrl.match(/^https?:\/\//)) {
      finalUrl = `https://${finalUrl}`
      setLocalUrl(finalUrl)
    }
    if (!finalUrl) {
      editor.chain().focus().updateImageAttrs({ href: undefined }).run()
    } else {
      editor.chain().focus().updateImageAttrs({ href: finalUrl }).run()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
        ; (e.target as HTMLElement).blur()
    }
  }

  return (
    <div className="flex items-center gap-2 w-full bg-[#1e1e1e] border border-neutral-700/60 rounded px-2 py-1 mt-1">
      <LinkIcon size={12} className="text-neutral-400 shrink-0" />
      <input
        type="text"
        value={localUrl}
        onChange={e => setLocalUrl(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="링크 (https://...)"
        className="w-full text-[11px] font-bold bg-transparent text-neutral-300 outline-none placeholder:text-neutral-600"
      />
    </div>
  )
}

// --- Custom FontSize Extension ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    }
  },
})

// --- Custom Image Extension ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      setImageAlign: (align: 'left' | 'center' | 'right') => ReturnType
      updateImageAttrs: (options: { width?: string, height?: string, href?: string }) => ReturnType
    }
    buttonLink: {
      insertButtonLink: (options: { href: string, text: string, bgColor?: string, textColor?: string, buttonWidth?: string, buttonHeight?: string, textSize?: string, fontFamily?: string, isBold?: boolean, isItalic?: boolean, align?: string, buttonStyle?: string }) => ReturnType
    }
  }
}

export const CustomImage = Image.extend({
  name: 'customImage',
  inline() {
    return false
  },
  group: 'block',
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width') || element.style.width?.replace('px', ''),
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height') || element.style.height?.replace('px', ''),
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
      },
      href: {
        default: null,
        parseHTML: element => {
          // If the image is wrapped in an anchor, get its href
          if (element.parentElement?.tagName.toLowerCase() === 'a') {
            return element.parentElement.getAttribute('href');
          }
          return element.getAttribute('data-href'); // fallback
        }
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'a[href] img',
      },
      {
        tag: 'img[src]',
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const { href, align, width, height, ...rest } = HTMLAttributes;

    let alignClass = '!block !mx-auto !my-6 rounded-xl max-w-full max-h-[800px] shadow-sm border border-neutral-100 object-cover';
    if (align === 'left') {
      alignClass = 'float-left mr-6 mb-4 max-w-[90%] sm:max-w-[40%] lg:max-w-[400px] rounded-xl shadow-sm border border-neutral-100 object-cover';
    } else if (align === 'right') {
      alignClass = 'float-right ml-6 mb-4 max-w-[90%] sm:max-w-[40%] lg:max-w-[400px] rounded-xl shadow-sm border border-neutral-100 object-cover';
    }

    let style = '';
    if (width) style += `width: ${width}px;`;
    if (height) style += `height: ${height}px;`;

    const imgAttributes = mergeAttributes(this.options.HTMLAttributes, rest, {
      class: alignClass,
      'data-align': align || 'center',
      'data-href': href, // save it for parsing
      width,
      height,
      style: style || null
    });

    const imgHTML = ['img', imgAttributes];

    if (href) {
      return ['a', { href, target: '_blank', rel: 'noopener noreferrer' }, imgHTML];
    }
    return imgHTML as any;
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign: (align) => ({ commands }) => {
        return commands.updateAttributes('customImage', { align })
      },
      updateImageAttrs: (options) => ({ commands }) => {
        return commands.updateAttributes('customImage', options)
      }
    }
  }
})

// --- Columns Extension ---
export const ColumnBlock = Node.create({
  name: 'columnBlock',
  group: 'block',
  content: 'column+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'column-block',
      class: 'flex flex-col md:flex-row gap-6 my-6 w-full items-start'
    }), 0]
  },
  addCommands() {
    return {
      insertTwoColumns: () => ({ commands }) => {
        return commands.insertColumns('50-50');
      },
      insertColumns: (ratio) => ({ tr, dispatch }) => {
        if (dispatch) {
          const schema = this.editor.schema;
          let columns: any[] = [];

          if (ratio === '50-50') {
            columns = [
              schema.nodes.column.create({ width: 'flex-1' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'flex-1' }, schema.nodes.paragraph.create()),
            ];
          } else if (ratio === '30-70') {
            columns = [
              schema.nodes.column.create({ width: 'w-full md:w-[30%]' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'w-full md:w-[70%]' }, schema.nodes.paragraph.create()),
            ];
          } else if (ratio === '70-30') {
            columns = [
              schema.nodes.column.create({ width: 'w-full md:w-[70%]' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'w-full md:w-[30%]' }, schema.nodes.paragraph.create()),
            ];
          } else if (ratio === '40-60') {
            columns = [
              schema.nodes.column.create({ width: 'w-full md:w-[40%]' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'w-full md:w-[60%]' }, schema.nodes.paragraph.create()),
            ];
          } else if (ratio === '60-40') {
            columns = [
              schema.nodes.column.create({ width: 'w-full md:w-[60%]' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'w-full md:w-[40%]' }, schema.nodes.paragraph.create()),
            ];
          } else if (ratio === '33-33-33') {
            columns = [
              schema.nodes.column.create({ width: 'flex-1' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'flex-1' }, schema.nodes.paragraph.create()),
              schema.nodes.column.create({ width: 'flex-1' }, schema.nodes.paragraph.create()),
            ];
          }

          const node = this.type.create(null, columns);
          tr.replaceSelectionWith(node);
        }
        return true
      }
    }
  }
})

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      width: {
        default: 'flex-1',
        parseHTML: element => element.getAttribute('data-width') || 'flex-1',
        renderHTML: attributes => {
          return {
            'data-width': attributes.width,
          }
        }
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'column',
      class: `${HTMLAttributes['data-width'] || 'flex-1'} min-w-0 transition-all relative group`
    }), 0]
  },
})

// --- Custom ButtonLink Extension ---
export const ButtonLinkNodeView = (props: NodeViewProps) => {
  const { node, updateAttributes, selected, getPos, editor } = props;
  const { href, text, bgColor, textColor, buttonWidth, buttonHeight, textSize, fontFamily, isBold, isItalic, buttonStyle, align } = node.attrs;

  const [isEditing, setIsEditing] = useState(false);
  const [editHref, setEditHref] = useState(href || '');
  const [editText, setEditText] = useState(text || '');
  const [editStyle, setEditStyle] = useState(buttonStyle || 'default');
  const [editBgColor, setEditBgColor] = useState(bgColor || '#171717');
  const [editTextColor, setEditTextColor] = useState(textColor || '#ffffff');
  const [editButtonWidth, setEditButtonWidth] = useState(buttonWidth || '');
  const [editButtonHeight, setEditButtonHeight] = useState(buttonHeight || '');
  const [editTextSize, setEditTextSize] = useState(textSize || '14');
  const [editAlign, setEditAlign] = useState(align || 'center');
  const [editFontFamily, setEditFontFamily] = useState(fontFamily || '');
  const [editIsBold, setEditIsBold] = useState(isBold || false);
  const [editIsItalic, setEditIsItalic] = useState(isItalic || false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // 스크롤 시 자동 닫기 훅
  useEffect(() => {
    if (!isEditing) return;
    const handleScroll = () => {
      setIsEditing(false);
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isEditing]);

  // 바깥 클릭(Click Outside) 및 에디터 타이핑/상호작용 시 자동 닫기 콤보 훅
  useEffect(() => {
    if (!isEditing || !editor) return;

    const handleClickOutside = (e: MouseEvent) => {
      const popupEl = document.querySelector('[data-button-popup="true"]');
      if (popupEl && popupEl.contains(e.target as globalThis.Node)) {
        return;
      }
      // 수정 버튼 클릭 시 닫히는 오작동 방지 (버튼 클릭은 handleEdit가 우선함)
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="edit-button-link"]')) {
        return;
      }
      setIsEditing(false);
    };

    const handleEditorInteraction = () => {
      setIsEditing(false);
    };

    editor.on('update', handleEditorInteraction);
    editor.on('selectionUpdate', handleEditorInteraction);
    document.addEventListener('mousedown', handleClickOutside, { capture: true });

    return () => {
      editor.off('update', handleEditorInteraction);
      editor.off('selectionUpdate', handleEditorInteraction);
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
    };
  }, [isEditing, editor]);

  const buttonRef = useRef<HTMLDivElement>(null);
  const [naturalWidth, setNaturalWidth] = useState<string>('');
  const [naturalHeight, setNaturalHeight] = useState<string>('');

  useEffect(() => {
    if (isEditing && buttonRef.current) {
      // Find the actual button inside (usually the first child that is not absolute)
      const btn = buttonRef.current.querySelector(':scope > a, :scope > div > a, :scope > div > button') as HTMLElement || buttonRef.current.firstElementChild as HTMLElement;
      if (btn) {
        setNaturalWidth(btn.clientWidth.toString());
        setNaturalHeight(btn.clientHeight.toString());
      }
    }
  }, [isEditing, editButtonWidth, editButtonHeight, editText, editStyle, editTextSize, editFontFamily, editIsBold, editIsItalic]);

  const handleEdit = (e: any) => {
    e.stopPropagation();
    if (typeof getPos === 'function' && editor) {
      const pos = getPos();
      if (typeof pos === 'number') {
        editor.chain().focus().setNodeSelection(pos).run();
      }
    }
    setEditHref(href || '');
    setEditText(text || '');
    setEditStyle(buttonStyle || 'default');
    setEditBgColor(bgColor || '#171717');
    setEditTextColor(textColor || '#ffffff');
    setEditButtonWidth(buttonWidth || '');
    setEditButtonHeight(buttonHeight || '');
    setEditTextSize(textSize || '14');
    setEditAlign(align || 'center');
    setEditFontFamily(fontFamily || '');
    setEditIsBold(isBold || false);
    setEditIsItalic(isItalic || false);

    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    });
    setIsEditing(true);
  }

  const handleSave = () => {
    updateAttributes({
      href: editHref, text: editText, buttonStyle: editStyle, bgColor: editBgColor,
      textColor: editTextColor, buttonWidth: editButtonWidth, buttonHeight: editButtonHeight,
      textSize: editTextSize, align: editAlign, fontFamily: editFontFamily, isBold: editIsBold, isItalic: editIsItalic
    });
    setIsEditing(false);
  }

  const renderButton = () => {
    const styleObj: any = { backgroundColor: bgColor, color: textColor, textDecoration: 'none', fontSize: `${textSize}px` };
    if (buttonWidth) styleObj.width = `${buttonWidth}px`;
    if (buttonHeight) styleObj.height = `${buttonHeight}px`;
    if (fontFamily) styleObj.fontFamily = fontFamily;
    if (isBold) styleObj.fontWeight = 'bold';
    if (isItalic) styleObj.fontStyle = 'italic';

    const preventClick = (e: any) => e.preventDefault();

    switch (buttonStyle) {
      case 'flip':
        return <FlipButton href={href} style={styleObj} onClick={preventClick}>{text}</FlipButton>;
      case 'ripple':
        return <RippleButton href={href} style={styleObj} onClick={preventClick}>{text}</RippleButton>;
      case 'liquid':
        return <LiquidButton href={href} style={styleObj} onClick={preventClick}>{text}</LiquidButton>;

      default:
        return <DefaultButton href={href} style={styleObj} onClick={preventClick}>{text}</DefaultButton>;
    }
  }

  return (
    <NodeViewWrapper 
      className={`my-4 py-8 px-4 border rounded-xl shadow-sm block relative group/btnwrapper transition-colors ${
        editAlign === 'left' ? 'text-left' : editAlign === 'right' ? 'text-right' : 'text-center'
      } ${
        isEditing 
          ? 'border-blue-500 bg-blue-50/20 z-30 shadow-md' 
          : selected 
            ? 'border-blue-400 bg-blue-50/10 z-20' 
            : 'border-neutral-200 bg-neutral-50 z-10'
      }`} 
      data-button-link 
      data-style={buttonStyle}
    >
      <div ref={buttonRef} className="inline-block">
        {renderButton()}
      </div>

      {/* 텍스트 수정 버튼 */}
      <button data-action="edit-button-link" onClick={handleEdit} className="absolute top-2 right-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-600 text-xs px-2 py-1 rounded shadow-sm opacity-0 group-hover/btnwrapper:opacity-100 transition-opacity z-10 whitespace-nowrap">
        버튼 수정
      </button>

      {/* 수정 모달 */}
      {isEditing && mounted && typeof document !== 'undefined' && coords && createPortal(
        <div
          data-button-popup="true"
          className="fixed bg-[#252525] border border-neutral-700/60 rounded-xl shadow-2xl p-4 w-max min-w-[340px] flex flex-col gap-3 z-[99999] cursor-default text-left origin-top animate-in fade-in zoom-in-95 duration-150 font-sans text-neutral-200"
          style={{
            top: `${coords.top - window.scrollY + coords.height + 8}px`,
            left: `${coords.left - window.scrollX + coords.width / 2}px`,
            transform: 'translateX(-50%)',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          onKeyUp={e => e.stopPropagation()}
          onKeyPress={e => e.stopPropagation()}
          data-lenis-prevent="true"
          contentEditable={false}
        >
          <div className="text-xs font-bold text-neutral-300">버튼 링크 설정</div>

          <div className="flex flex-col gap-2">
            <input value={editText} onChange={e => { setEditText(e.target.value); updateAttributes({ text: e.target.value }); }} placeholder="버튼 텍스트" className="w-full p-2 text-xs bg-[#1e1e1e] border border-neutral-700/60 rounded text-neutral-200 focus:outline-none focus:border-neutral-500" />
            <input value={editHref} onChange={e => { setEditHref(e.target.value); updateAttributes({ href: e.target.value }); }} placeholder="연결할 링크 (URL)" className="w-full p-2 text-xs bg-[#1e1e1e] border border-neutral-700/60 rounded text-neutral-200 focus:outline-none focus:border-neutral-500" />
          </div>

          <div className="flex justify-between items-center mt-1 gap-2">
            <div className="flex gap-1.5 items-center">
              <select value={editStyle} onChange={e => { setEditStyle(e.target.value); updateAttributes({ buttonStyle: e.target.value }); }} className="px-1.5 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none cursor-pointer max-w-[80px] truncate">
                <option value="default">기본</option>
                <option value="flip">플립</option>
                <option value="ripple">물결</option>
                <option value="liquid">액체</option>
              </select>

              <div className="flex items-center gap-0.5 border border-neutral-700/60 bg-[#1e1e1e] rounded px-1 shrink-0 h-[22px]">
                <span className="text-[9px] text-neutral-400 pl-0.5 scale-90">배경</span>
                <input type="color" value={editBgColor} onChange={e => { setEditBgColor(e.target.value); updateAttributes({ bgColor: e.target.value }); }} className="w-3.5 h-3.5 rounded cursor-pointer bg-transparent border-0 p-0" title="배경색상" />
              </div>
              <div className="flex items-center gap-0.5 border border-neutral-700/60 bg-[#1e1e1e] rounded px-1 shrink-0 h-[22px]">
                <span className="text-[9px] text-neutral-400 pl-0.5 scale-90">글자</span>
                <input type="color" value={editTextColor} onChange={e => { setEditTextColor(e.target.value); updateAttributes({ textColor: e.target.value }); }} className="w-3.5 h-3.5 rounded cursor-pointer bg-transparent border-0 p-0" title="텍스트색상" />
              </div>

              <div className="w-[1px] h-4 bg-neutral-600 mx-0.5" />
              <button type="button" onClick={() => { setEditAlign('left'); updateAttributes({ align: 'left' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'left' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignLeft size={12} /></button>
              <button type="button" onClick={() => { setEditAlign('center'); updateAttributes({ align: 'center' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'center' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignCenter size={12} /></button>
              <button type="button" onClick={() => { setEditAlign('right'); updateAttributes({ align: 'right' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'right' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignRight size={12} /></button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-1 gap-2 border-t border-neutral-800 pt-2">
            <div className="flex gap-1.5 items-center">
              <select value={editFontFamily} onChange={e => { setEditFontFamily(e.target.value); updateAttributes({ fontFamily: e.target.value }); }} className="px-1.5 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none cursor-pointer max-w-[80px] truncate">
                <option value="">기본 글꼴</option>
                <option value="'Jua', sans-serif">주아체</option>
                <option value="'Nanum Myeongjo', serif">명조체</option>
                <option value="'Nanum Pen Script', cursive">손글씨</option>
                <option value="'Noto Sans KR', sans-serif">고딕체</option>
              </select>

              <button type="button" onClick={() => { setEditIsBold(!editIsBold); updateAttributes({ isBold: !editIsBold }); }} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-serif font-bold ${editIsBold ? 'bg-blue-600 text-white' : 'bg-[#1e1e1e] text-neutral-400 border border-neutral-700/60'} transition-colors`}>B</button>
              <button type="button" onClick={() => { setEditIsItalic(!editIsItalic); updateAttributes({ isItalic: !editIsItalic }); }} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-serif italic ${editIsItalic ? 'bg-blue-600 text-white' : 'bg-[#1e1e1e] text-neutral-400 border border-neutral-700/60'} transition-colors`}>I</button>
              
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-neutral-500 scale-90">크기</span>
                <input type="number" value={editTextSize} onChange={e => { setEditTextSize(e.target.value); updateAttributes({ textSize: e.target.value }); }} className="w-8 px-0.5 py-0.5 text-[10px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none" min="8" max="72" />
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white transition-colors whitespace-nowrap">닫기</button>
              <button type="button" onClick={handleSave} className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm whitespace-nowrap">적용</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  )
}

export const ButtonLink = Node.create({
  name: 'buttonLink',
  group: 'block',
  inline: false,
  selectable: true,
  atom: true,
  priority: 1000,

  addNodeView() {
    return ReactNodeViewRenderer(ButtonLinkNodeView)
  },

  addAttributes() {
    return {
      href: { default: null, parseHTML: element => element.getAttribute('href') },
      text: { default: 'Button', parseHTML: element => element.getAttribute('data-text') || element.textContent || 'Button' },
      bgColor: { default: '#171717', parseHTML: element => element.getAttribute('data-bg-color') || element.style?.backgroundColor || '#171717' },
      textColor: { default: '#ffffff', parseHTML: element => element.getAttribute('data-text-color') || '#ffffff' },
      buttonWidth: { default: '', parseHTML: element => element.getAttribute('data-button-width') || '' },
      buttonHeight: { default: '', parseHTML: element => element.getAttribute('data-button-height') || '' },
      textSize: { default: '14', parseHTML: element => element.getAttribute('data-text-size') || '14' },
      fontFamily: { default: '', parseHTML: element => element.getAttribute('data-font-family') || '' },
      isBold: { default: false, parseHTML: element => element.getAttribute('data-is-bold') === 'true' },
      isItalic: { default: false, parseHTML: element => element.getAttribute('data-is-italic') === 'true' },
      buttonStyle: { default: 'default', parseHTML: element => element.getAttribute('data-style') || 'default' },
      align: { default: 'center', parseHTML: element => element.getAttribute('data-align') || 'center' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-button-link]',
      },
      {
        tag: 'a[data-button-link]',
      }
    ]
  },

  renderHTML({ node }) {
    const { href, text, bgColor, textColor, buttonWidth, buttonHeight, textSize, fontFamily, isBold, isItalic, buttonStyle, align } = node.attrs;

    const baseDataAttrs = {
      'data-button-link': '',
      'data-style': buttonStyle,
      'data-bg-color': bgColor,
      'data-text-color': textColor,
      'data-button-width': buttonWidth,
      'data-button-height': buttonHeight,
      'data-text-size': textSize,
      'data-font-family': fontFamily,
      'data-is-bold': isBold ? 'true' : 'false',
      'data-is-italic': isItalic ? 'true' : 'false',
      'data-text': text,
      'data-align': align || 'center'
    };

    const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';

    // We output a simple fallback for the HTML payload, which HTMLRenderer replaces anyway
    return ['div', mergeAttributes(baseDataAttrs, { class: `my-4 block ${alignClass}` }),
      ['a', { href: href, target: '_blank', class: "inline-block !text-white px-8 py-3.5 rounded-full font-bold text-sm" }, text]
    ]
  },

  addCommands() {
    return {
      insertButtonLink: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})

// AnimatedText Mark removed


// --- Custom AnimatedTextGroup Extension ---
const AnimatedTextGroupNodeView = ({ node, updateAttributes, selected, deleteNode, editor, getPos }: any) => {
  const { texts, animationType, textSize, isBold, isItalic, fontFamily, align } = node.attrs;
  const parsedTexts = Array.isArray(texts) ? texts : (typeof texts === 'string' ? JSON.parse(texts || '[""]') : [""]);

  const [isEditing, setIsEditing] = useState(false);
  const [editTexts, setEditTexts] = useState<string[]>(parsedTexts);
  const [editSize, setEditSize] = useState(textSize || 'text-xl');
  const [editBold, setEditBold] = useState(isBold ?? true);
  const [editItalic, setEditItalic] = useState(isItalic ?? false);
  const [editFont, setEditFont] = useState(fontFamily || 'inherit');
  const [editAlign, setEditAlign] = useState(align || 'center');
  const [editAnimationType, setEditAnimationType] = useState(animationType || 'rotating');

  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 스크롤 시 자동 닫기 훅
  useEffect(() => {
    if (!isEditing) return;
    const handleScroll = () => {
      setIsEditing(false);
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isEditing]);

  // 바깥 클릭(Click Outside) 및 에디터 타이핑/상호작용 시 자동 닫기 콤보 훅
  useEffect(() => {
    if (!isEditing || !editor) return;

    const handleClickOutside = (e: MouseEvent) => {
      const popupEl = document.querySelector('[data-animated-popup="true"]');
      if (popupEl && popupEl.contains(e.target as globalThis.Node)) {
        return;
      }
      // 수정 버튼 클릭 시 닫히는 오작동 방지 (버튼 클릭은 handleEdit가 우선함)
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="edit-animated-text"]')) {
        return;
      }
      setIsEditing(false);
    };

    const handleEditorInteraction = () => {
      setIsEditing(false);
    };

    editor.on('update', handleEditorInteraction);
    editor.on('selectionUpdate', handleEditorInteraction);
    document.addEventListener('mousedown', handleClickOutside, { capture: true });

    return () => {
      editor.off('update', handleEditorInteraction);
      editor.off('selectionUpdate', handleEditorInteraction);
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
    };
  }, [isEditing, editor]);

  const handleEdit = (e: any) => {
    e.stopPropagation();
    if (typeof getPos === 'function' && editor) {
      const pos = getPos();
      if (typeof pos === 'number') {
        editor.chain().focus().setNodeSelection(pos).run();
      }
    }
    setEditTexts(parsedTexts);
    setEditSize(textSize || 'text-xl');
    setEditBold(isBold ?? true);
    setEditItalic(isItalic ?? false);
    setEditFont(fontFamily || 'inherit');
    setEditAlign(align || 'center');
    setEditAnimationType(animationType || 'rotating');

    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    });
    setIsEditing(true);
  }

  const handleSave = () => {
    const newTexts = editTexts.map(s => s.trim()).filter(s => s);
    if (newTexts.length > 0) {
      updateAttributes({ 
        texts: JSON.stringify(newTexts), 
        animationType: editAnimationType,
        textSize: editSize, 
        isBold: editBold, 
        isItalic: editItalic, 
        fontFamily: editFont, 
        align: editAlign 
      });
    }
    setIsEditing(false);
  }

  const appliedClass = `${isBold !== false ? 'font-bold' : ''} ${isItalic ? 'italic' : ''} whitespace-pre-wrap break-words max-w-full`;

  // 변환 로직: 기존 Tailwind 클래스가 남아있을 경우 rem 단위로 변환
  const actualFontSize = editSize.includes('rem') || editSize.includes('px') ? editSize : (
    editSize === 'text-sm' ? '0.875rem' :
      editSize === 'text-base' ? '1rem' :
        editSize === 'text-xl' ? '1.25rem' :
          editSize === 'text-2xl' ? '1.5rem' :
            editSize === 'text-4xl' ? '2.25rem' : '1.25rem'
  );

  const appliedStyle = {
    userSelect: 'none',
    fontFamily: fontFamily !== 'inherit' ? fontFamily : undefined,
    fontSize: actualFontSize
  } as any;

  return (
    <NodeViewWrapper 
      className={`my-4 py-8 px-4 border rounded-xl shadow-sm block relative group transition-colors ${
        align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
      } ${
        isEditing 
          ? 'border-blue-500 bg-blue-50/20 z-30 shadow-md' 
          : selected 
            ? 'border-blue-400 bg-blue-50/10 z-20' 
            : 'border-neutral-200 bg-neutral-50 z-10'
      }`} 
      data-animated-group={animationType} 
      style={appliedStyle}
    >
      {/* Drag Handle */}
      <Tooltip text="드래그해서 위아래로 이동" position="left">
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-800"
          data-drag-handle
          contentEditable={false}
        >
          <GripVertical size={18} />
        </div>
      </Tooltip>

      {isEditing && mounted && typeof document !== 'undefined' && coords && createPortal(
        <div
          data-animated-popup="true"
          className="fixed bg-[#252525] border border-neutral-700/60 rounded-xl shadow-2xl p-4 w-max min-w-[340px] flex flex-col gap-3 z-[99999] cursor-default text-left origin-top animate-in fade-in zoom-in-95 duration-150 font-sans text-neutral-200"
          style={{
            top: `${coords.top - window.scrollY + coords.height + 8}px`,
            left: `${coords.left - window.scrollX + coords.width / 2}px`,
            transform: 'translateX(-50%)',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          onKeyUp={e => e.stopPropagation()}
          onKeyPress={e => e.stopPropagation()}
          data-lenis-prevent="true"
          contentEditable={false}
        >
          <div className="text-xs font-bold text-neutral-300 flex items-center justify-between gap-4">
            <span>텍스트 내용 수정</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-neutral-500 font-bold scale-90">효과:</span>
              <select
                value={editAnimationType}
                onChange={e => { 
                  setEditAnimationType(e.target.value); 
                  updateAttributes({ animationType: e.target.value }); 
                }}
                className="px-1 py-0.5 text-[10px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none cursor-pointer"
              >
                <option value="rotating">회전 (Rotating)</option>
                <option value="morphing">변형 (Morphing)</option>
                <option value="typing">타이핑 (Typing)</option>
                <option value="splitting">글자쪼개기 (Splitting)</option>
                <option value="sliding">슬라이딩 (Sliding)</option>
                <option value="shimmering">반짝임 (Shimmering)</option>
                <option value="rolling">롤링 (Rolling)</option>
                <option value="highlight">강조 (Highlight)</option>
                <option value="gradient">그라데이션 (Gradient)</option>
              </select>
            </div>
          </div>
          {editAnimationType === 'rotating' || editAnimationType === 'morphing' ? (
            <textarea
              value={editTexts.join('\n')}
              onChange={(e) => setEditTexts(e.target.value.split('\n'))}
              className="w-full h-24 p-2 text-xs bg-[#1e1e1e] border border-neutral-700/60 rounded text-neutral-200 focus:outline-none focus:border-neutral-500 resize-none font-sans"
              placeholder="여러 줄 입력..."
            />
          ) : (
            <input
              value={editTexts[0] || ''}
              onChange={(e) => setEditTexts([e.target.value])}
              className="w-full p-2 text-xs bg-[#1e1e1e] border border-neutral-700/60 rounded text-neutral-200 focus:outline-none focus:border-neutral-500"
              placeholder="텍스트 입력"
            />
          )}
          <div className="flex justify-between items-center mt-1 gap-2">
            <div className="flex gap-1.5">
              <select
                value={editSize}
                onChange={e => { setEditSize(e.target.value); updateAttributes({ textSize: e.target.value }); }}
                className="px-1.5 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none cursor-pointer"
              >
                <option value="0.75rem">12</option>
                <option value="0.875rem">14</option>
                <option value="1rem">16</option>
                <option value="1.125rem">18</option>
                <option value="1.25rem">20</option>
                <option value="1.5rem">24</option>
                <option value="1.875rem">30</option>
                <option value="2.25rem">36</option>
                <option value="3rem">48</option>
                <option value="4rem">64</option>
                <option value="5rem">80</option>
                <option value="6rem">96</option>
              </select>
              <select
                value={editFont}
                onChange={e => { setEditFont(e.target.value); updateAttributes({ fontFamily: e.target.value }); }}
                className="px-1.5 py-1 text-[11px] font-bold border border-neutral-700/60 bg-[#1e1e1e] text-neutral-300 rounded outline-none cursor-pointer max-w-[90px] truncate"
              >
                <option value="inherit">기본 폰트</option>
                <option value='"Noto Sans KR", sans-serif'>고딕</option>
                <option value='"Nanum Myeongjo", serif'>명조</option>
                <option value='"Nanum Pen Script", cursive'>손글씨</option>
                <option value='"Jua", sans-serif'>주아</option>
              </select>
              <button type="button" onClick={() => { setEditBold(!editBold); updateAttributes({ isBold: !editBold }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editBold ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><Bold size={12} /></button>
              <button type="button" onClick={() => { setEditItalic(!editItalic); updateAttributes({ isItalic: !editItalic }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editItalic ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><Italic size={12} /></button>
              <div className="w-[1px] h-4 bg-neutral-600 mx-1 self-center" />
              <button type="button" onClick={() => { setEditAlign('left'); updateAttributes({ align: 'left' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'left' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignLeft size={12} /></button>
              <button type="button" onClick={() => { setEditAlign('center'); updateAttributes({ align: 'center' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'center' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignCenter size={12} /></button>
              <button type="button" onClick={() => { setEditAlign('right'); updateAttributes({ align: 'right' }); }} className={`p-1 rounded flex items-center justify-center transition-colors ${editAlign === 'right' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1e1e1e] text-neutral-400 hover:text-white border-neutral-700/60'} border`}><AlignRight size={12} /></button>
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={deleteNode} className="px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors whitespace-nowrap">삭제</button>
              <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white transition-colors whitespace-nowrap">취소</button>
              <button type="button" onClick={handleSave} className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm whitespace-nowrap">적용</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <button data-action="edit-animated-text" onClick={handleEdit} className="absolute top-2 right-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-600 text-xs px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
        텍스트 수정
      </button>

      {animationType === 'rotating' && (
        <span className={`${appliedClass} inline-flex align-bottom relative bg-white px-4 py-1 rounded shadow-sm`}>
          <TextRotate texts={parsedTexts} className={`w-full ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'} min-w-[120px]`} />
        </span>
      )}

      {animationType === 'morphing' && (
        <span className={`${appliedClass} relative inline-block bg-white px-4 py-1 rounded shadow-sm overflow-hidden min-w-[120px]`}>
          <TextMorph texts={parsedTexts} className={`w-full ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'}`} />
        </span>
      )}

      {animationType === 'typing' && <span className={`${appliedClass}`}><TypingText text={parsedTexts[0]} /></span>}
      {animationType === 'splitting' && <span className={`${appliedClass}`}><SplittingText text={parsedTexts[0]} /></span>}
      {animationType === 'sliding' && <span className={`${appliedClass}`}><SlidingText text={parsedTexts[0]} /></span>}
      {animationType === 'shimmering' && <span className={`${appliedClass}`}><ShimmeringText text={parsedTexts[0]} /></span>}
      {animationType === 'rolling' && <span className={`${appliedClass}`}><RollingText text={parsedTexts[0]} /></span>}
      {animationType === 'highlight' && <span className={`${appliedClass}`}><HighlightText text={parsedTexts[0]} /></span>}
      {animationType === 'gradient' && <span className={`${appliedClass}`}><GradientText text={parsedTexts[0]} /></span>}
    </NodeViewWrapper>
  )
}

export const AnimatedTextGroup = Node.create({
  name: 'animatedTextGroup',
  group: 'block',
  atom: true,
  draggable: true,

  addNodeView() {
    return ReactNodeViewRenderer(AnimatedTextGroupNodeView)
  },

  addAttributes() {
    return {
      texts: {
        default: '["Hello", "World"]',
        parseHTML: element => element.getAttribute('data-texts') || '["Hello", "World"]'
      },
      animationType: {
        default: 'rotating',
        parseHTML: element => element.getAttribute('data-animated-group') || 'rotating'
      },
      textSize: {
        default: 'text-xl',
        parseHTML: element => element.getAttribute('data-text-size') || 'text-xl'
      },
      isBold: {
        default: true,
        parseHTML: element => element.getAttribute('data-is-bold') === 'true'
      },
      isItalic: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-italic') === 'true'
      },
      fontFamily: {
        default: 'inherit',
        parseHTML: element => element.getAttribute('data-font-family') || 'inherit'
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center'
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-animated-group]'
      }
    ]
  },

  renderHTML({ node }) {
    const { texts, animationType, textSize, isBold, isItalic, fontFamily, align } = node.attrs;
    const parsedTexts = Array.isArray(texts) ? texts : (typeof texts === 'string' ? JSON.parse(texts || '[""]') : [""]);
    const baseAttrs = {
      'data-animated-group': animationType,
      'data-texts': JSON.stringify(parsedTexts),
      'data-text-size': textSize || '1.25rem',
      'data-is-bold': isBold ?? true,
      'data-is-italic': isItalic ?? false,
      'data-font-family': fontFamily || 'inherit',
      'data-align': align || 'center'
    };
    const appliedClass = `${isBold !== false ? 'font-bold' : ''} ${isItalic ? 'italic' : ''} whitespace-pre-wrap break-words max-w-full`;

    const actualFontSize = textSize.includes('rem') || textSize.includes('px') ? textSize : (
      textSize === 'text-sm' ? '0.875rem' :
        textSize === 'text-base' ? '1rem' :
          textSize === 'text-xl' ? '1.25rem' :
            textSize === 'text-2xl' ? '1.5rem' :
              textSize === 'text-4xl' ? '2.25rem' : '1.25rem'
    );

    let styleStr = '';
    if (fontFamily !== 'inherit') styleStr += `font-family: ${fontFamily}; `;
    styleStr += `font-size: ${actualFontSize};`;
    const appliedStyle = styleStr;

    if (animationType === 'rotating') {
      const items = parsedTexts.map((text: string) => ['div', { class: 'h-[1.5em] flex items-center justify-center whitespace-nowrap' }, text]);
      items.push(['div', { class: 'h-[1.5em] flex items-center justify-center whitespace-nowrap' }, parsedTexts[0]]); // loop

      return ['div', mergeAttributes(baseAttrs, { class: `my-4 block ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'}` }),
        ['span', { class: `${appliedClass} inline-flex flex-col h-[1.5em] overflow-hidden align-bottom relative px-4 py-1 rounded shadow-sm`, style: appliedStyle },
          ['div', { class: `flex flex-col animate-[slideUpGroup_10s_linear_infinite]` }, ...items]
        ]
      ]
    }

    if (animationType === 'morphing') {
      const items = parsedTexts.map((text: string, i: number) => {
        return ['span', { class: 'absolute inset-0 flex items-center justify-center animate-[fadeLoop_10s_linear_infinite]', style: `animation-delay: ${(i / parsedTexts.length) * 10}s; opacity: 0;` }, text]
      });
      return ['div', mergeAttributes(baseAttrs, { class: `my-4 block ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'}` }),
        ['span', { class: `${appliedClass} relative inline-block h-[1.5em] min-w-[200px] px-4 py-1 rounded shadow-sm overflow-hidden`, style: appliedStyle }, ...items]
      ]
    }

    return ['div', mergeAttributes(baseAttrs, { class: `${appliedClass} inline-block px-1`, style: appliedStyle }), parsedTexts[0] || ''];
  },

  addCommands() {
    return {
      insertAnimatedTextGroup: (options: any) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    } as any
  },
})

// --- Custom FAQ Block Extension ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    faqBlock: {
      insertFaqBlock: (options: { question: string, answer: string }) => ReturnType
    }
  }
}

const FaqBlockNodeView = (props: NodeViewProps) => {
  const { node, updateAttributes, selected, deleteNode } = props
  const { 
    question, 
    answer, 
    qFont, 
    qSize, 
    qColor, 
    qBold, 
    qItalic, 
    aFont, 
    aSize, 
    aColor, 
    aBold, 
    aItalic,
    borderStyle,
    hoverBg
  } = node.attrs

  const cleanQuestion = (question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');

  const [isEditing, setIsEditing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const [localQuestion, setLocalQuestion] = useState(cleanQuestion || '')
  const [localAnswer, setLocalAnswer] = useState(answer || '')

  // 스타일 수정을 위한 로컬 상태들
  const [localQFont, setLocalQFont] = useState(qFont || 'inherit')
  const [localQSize, setLocalQSize] = useState(qSize || '15px')
  const [localQColor, setLocalQColor] = useState(qColor || '')
  const [localQBold, setLocalQBold] = useState(qBold ?? true)
  const [localQItalic, setLocalQItalic] = useState(qItalic ?? false)

  const [localAFont, setLocalAFont] = useState(aFont || 'inherit')
  const [localASize, setLocalASize] = useState(aSize || '14px')
  const [localAColor, setLocalAColor] = useState(aColor || '')
  const [localABold, setLocalABold] = useState(aBold ?? false)
  const [localAItalic, setLocalAItalic] = useState(aItalic ?? false)

  const [localBorderStyle, setLocalBorderStyle] = useState(borderStyle || 'minimal')
  const [localHoverBg, setLocalHoverBg] = useState(hoverBg || 'tint')

  const [isOpen, setIsOpen] = useState(false) // 에디터 내부 미리보기용 아코디언 오픈 상태

  // node.attrs 가 업데이트되면 로컬 폼 상태도 100% 실시간 자동 동기화 (유실/초기화 원천 봉쇄)
  useEffect(() => {
    const currentClean = (node.attrs.question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');
    setLocalQuestion(currentClean || '')
    setLocalAnswer(node.attrs.answer || '')
    setLocalQFont(node.attrs.qFont || 'inherit')
    setLocalQSize(node.attrs.qSize || '15px')
    setLocalQColor(node.attrs.qColor || '')
    setLocalQBold(node.attrs.qBold ?? true)
    setLocalQItalic(node.attrs.qItalic ?? false)
    setLocalAFont(node.attrs.aFont || 'inherit')
    setLocalASize(node.attrs.aSize || '14px')
    setLocalAColor(node.attrs.aColor || '')
    setLocalABold(node.attrs.aBold ?? false)
    setLocalAItalic(node.attrs.aItalic ?? false)
    setLocalBorderStyle(node.attrs.borderStyle || 'minimal')
    setLocalHoverBg(node.attrs.hoverBg || 'tint')
  }, [node.attrs])

  const handleEdit = (e: any) => {
    e.stopPropagation()
    const currentClean = (node.attrs.question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');
    setLocalQuestion(currentClean || '')
    setLocalAnswer(node.attrs.answer || '')
    setLocalQFont(node.attrs.qFont || 'inherit')
    setLocalQSize(node.attrs.qSize || '15px')
    setLocalQColor(node.attrs.qColor || '')
    setLocalQBold(node.attrs.qBold ?? true)
    setLocalQItalic(node.attrs.qItalic ?? false)
    setLocalAFont(node.attrs.aFont || 'inherit')
    setLocalASize(node.attrs.aSize || '14px')
    setLocalAColor(node.attrs.aColor || '')
    setLocalABold(node.attrs.aBold ?? false)
    setLocalAItalic(node.attrs.aItalic ?? false)
    setLocalBorderStyle(node.attrs.borderStyle || 'minimal')
    setLocalHoverBg(node.attrs.hoverBg || 'tint')
    setIsEditing(true)
  }

  const handleSave = () => {
    const finalizedQuestion = localQuestion.replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');
    updateAttributes({ 
      question: finalizedQuestion, 
      answer: localAnswer,
      qFont: localQFont,
      qSize: localQSize,
      qColor: localQColor,
      qBold: localQBold,
      qItalic: localQItalic,
      aFont: localAFont,
      aSize: localASize,
      aColor: localAColor,
      aBold: localABold,
      aItalic: localAItalic,
      borderStyle: localBorderStyle,
      hoverBg: localHoverBg
    })
    setIsEditing(false)
  }

  // 테마별/보더 스타일별 래퍼 클래스 및 장식적 요소 빌드
  let wrapperClass = "my-3 transition-all duration-300 relative group/faqwrapper select-none overflow-hidden "
  if (selected) {
    wrapperClass += "border border-blue-500/60 bg-blue-50/5 dark:bg-blue-950/5 rounded-2xl "
  }

  let accordionBoxClass = "transition-all duration-300 relative overflow-hidden "
  let decorationLeftBar = null
  let listDotIndicator = null

  if (localBorderStyle === 'glass') {
    // 1. 피그마 글래스모피즘: 화이트 바탕에서도 완벽히 입체적으로 구별되는 영롱한 Glass Card
    accordionBoxClass += "bg-gradient-to-br from-white/95 to-white/40 dark:from-neutral-900/95 dark:to-neutral-900/40 backdrop-blur-md border border-white/80 dark:border-neutral-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] rounded-2xl px-6 py-5 "
  } else if (localBorderStyle === 'solid') {
    // 2. 모던 솔리드 블록: 좌측 시그니처 굵은 블루 바가 박혀 확실한 존재감을 드러내는 위젯 형태
    accordionBoxClass += "border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl pl-6 pr-5 py-4.5 "
    decorationLeftBar = (
      <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-blue-600 dark:bg-blue-500" />
    )
  } else {
    // 3. Stripe Minimal: 극도로 얇고 깔끔한 하단선에 깜찍한 블루 도트 리스트 지시자가 달린 명품형
    accordionBoxClass += "border-b border-neutral-200/80 dark:border-neutral-800/60 py-4.5 "
    listDotIndicator = (
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mr-2.5 shrink-0 transition-transform duration-300 group-hover/faqwrapper:scale-130" />
    )
  }

  if (localHoverBg === 'tint' && localBorderStyle !== 'glass') {
    accordionBoxClass += "hover:bg-blue-50/20 dark:hover:bg-blue-950/5 rounded-lg px-2.5 -mx-2.5 "
  }

  const questionStyle: React.CSSProperties = {
    fontFamily: localQFont !== 'inherit' ? localQFont : undefined,
    fontSize: localQSize,
    color: localQColor || undefined,
    fontWeight: localQBold ? 'bold' : 'normal',
    fontStyle: localQItalic ? 'italic' : 'normal',
  }

  const answerStyle: React.CSSProperties = {
    fontFamily: localAFont !== 'inherit' ? localAFont : undefined,
    fontSize: localASize,
    color: localAColor || undefined,
    fontWeight: localABold ? 'bold' : 'normal',
    fontStyle: localAItalic ? 'italic' : 'normal',
  }

  return (
    <NodeViewWrapper className={wrapperClass}>
      <div className={accordionBoxClass}>
        {decorationLeftBar}
        {/* 아코디언 미리보기 헤더 */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between cursor-pointer text-neutral-900 dark:text-neutral-100 pr-16 gap-6 hover:opacity-85 transition-opacity"
        >
          <div className="flex items-center">
            {listDotIndicator}
            <span style={questionStyle} className="tracking-tight leading-relaxed font-semibold">
              {cleanQuestion || '질문을 입력하세요'}
            </span>
          </div>
          <ChevronDown 
            size={16} 
            strokeWidth={2.5}
            className={`text-neutral-450 dark:text-neutral-550 transition-all duration-300 shrink-0 ${
              isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400 scale-105' : ''
            }`}
          />
        </div>

        {/* 아코디언 미리보기 본문 */}
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
              <div style={answerStyle} className="mt-3 whitespace-pre-wrap leading-relaxed pr-16">
                {node.attrs.answer || '답변을 입력하세요'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 에디팅 / 삭제 툴바 버튼 */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/faqwrapper:opacity-100 transition-all duration-300 z-10 scale-95 group-hover/faqwrapper:scale-100">
        <button onClick={handleEdit} className="bg-white/90 backdrop-blur border border-neutral-300/80 hover:bg-neutral-100 text-neutral-700 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap transition-colors">
          수정
        </button>
        <button onClick={deleteNode} className="bg-red-50/90 backdrop-blur border border-red-200/80 hover:bg-red-100 text-red-600 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap transition-colors">
          삭제
        </button>
      </div>

      {/* FAQ 스타일 & 텍스트 수정 폼 모달 (Figma 슬레이트 다크 미니멀리스트 팝업) */}
      {isEditing && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          onKeyUp={e => e.stopPropagation()}
          onKeyPress={e => e.stopPropagation()}
          data-lenis-prevent="true"
          contentEditable={false}
        >
          <div className="w-full max-w-md bg-[#181818] border border-neutral-800 rounded-xl shadow-2xl p-5 flex flex-col gap-4 text-left animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto no-scrollbar font-sans text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest font-mono">
                  Configure Accordion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* 1. 아코디언 기본 구조 텍스트 입력 */}
            <div className="flex flex-col gap-4 bg-[#181818]">
              <div className="flex flex-col gap-1">
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Accordion Question (Title)
                </label>
                <input
                  value={localQuestion}
                  onChange={e => setLocalQuestion(e.target.value)}
                  placeholder="Enter question text..."
                  className="w-full px-3 py-2.5 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 transition-colors text-neutral-200 placeholder-neutral-600 font-sans font-medium"
                />
              </div>

              {/* 질문 스타일 툴바 */}
              <div className="bg-[#181818] border border-neutral-800 p-2.5 rounded-lg flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-neutral-300 font-mono font-black uppercase mr-1">Q Style:</span>
                
                {/* 폰트 셀렉트 */}
                <select
                  value={localQFont}
                  onChange={e => setLocalQFont(e.target.value)}
                  className="px-2 py-1 text-[10px] font-bold border border-neutral-800 bg-[#222] text-neutral-300 rounded-md outline-none cursor-pointer focus:border-neutral-600"
                >
                  <option value="inherit">기본 폰트</option>
                  <option value='"Noto Sans KR", sans-serif'>고딕</option>
                  <option value='"Nanum Myeongjo", serif'>명조</option>
                  <option value='"Nanum Pen Script", cursive'>손글씨</option>
                  <option value='"Jua", sans-serif'>주아</option>
                </select>

                {/* 사이즈 셀렉트 & 자유형 기입 인풋 */}
                <div className="flex items-center gap-1 bg-[#222] border border-neutral-800 rounded-md px-1.5 py-0.5 h-7">
                  <select
                    value={['10px','12px','13px','14px','15px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px'].includes(localQSize) ? localQSize : ''}
                    onChange={e => setLocalQSize(e.target.value || localQSize)}
                    className="text-[10px] font-bold bg-transparent text-neutral-300 outline-none cursor-pointer"
                  >
                    <option value="">수동</option>
                    <option value="10px">10px</option>
                    <option value="12px">12px</option>
                    <option value="13px">13px</option>
                    <option value="14px">14px</option>
                    <option value="15px">15px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                    <option value="32px">32px</option>
                    <option value="36px">36px</option>
                    <option value="40px">40px</option>
                    <option value="48px">48px</option>
                    <option value="56px">56px</option>
                    <option value="64px">64px</option>
                    <option value="72px">72px</option>
                  </select>
                  <input 
                    type="text" 
                    value={localQSize} 
                    onChange={e => setLocalQSize(e.target.value)} 
                    placeholder="Size"
                    className="w-10 text-[10px] text-center font-bold bg-[#181818] text-neutral-200 border border-neutral-800 rounded outline-none py-px focus:border-neutral-600"
                  />
                </div>

                {/* 볼드/이탤릭 토글 */}
                <button 
                  type="button" 
                  onClick={() => setLocalQBold(!localQBold)} 
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer border ${
                    localQBold ? 'bg-neutral-200 text-neutral-900 border-neutral-100 font-extrabold' : 'bg-[#222] text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  B
                </button>
                <button 
                  type="button" 
                  onClick={() => setLocalQItalic(!localQItalic)} 
                  className={`w-7 h-7 rounded-md flex items-center justify-center italic text-[10px] transition-colors cursor-pointer border ${
                    localQItalic ? 'bg-neutral-200 text-neutral-900 border-neutral-100 font-extrabold' : 'bg-[#222] text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  I
                </button>

                {/* 색상 피커 */}
                <div className="flex items-center gap-1.5 border border-neutral-800 bg-[#222] rounded-md px-1.5 shrink-0 h-7">
                  <span className="text-[8px] text-neutral-400 font-black uppercase">Color</span>
                  <input 
                    type="color" 
                    value={localQColor || '#ffffff'} 
                    onChange={e => setLocalQColor(e.target.value)} 
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Accordion Answer (Content)
                </label>
                <textarea
                  value={localAnswer}
                  onChange={e => setLocalAnswer(e.target.value)}
                  placeholder="Enter answer content..."
                  className="w-full h-24 px-3 py-2.5 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 transition-colors text-neutral-200 placeholder-neutral-600 font-sans resize-none leading-relaxed font-medium"
                />
              </div>

              {/* 답변 스타일 툴바 */}
              <div className="bg-[#181818] border border-neutral-800 p-2.5 rounded-lg flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-neutral-300 font-mono font-black uppercase mr-1">A Style:</span>
                
                {/* 폰트 셀렉트 */}
                <select
                  value={localAFont}
                  onChange={e => setLocalAFont(e.target.value)}
                  className="px-2 py-1 text-[10px] font-bold border border-neutral-800 bg-[#222] text-neutral-300 rounded-md outline-none cursor-pointer focus:border-neutral-600"
                >
                  <option value="inherit">기본 폰트</option>
                  <option value='"Noto Sans KR", sans-serif'>고딕</option>
                  <option value='"Nanum Myeongjo", serif'>명조</option>
                  <option value='"Nanum Pen Script", cursive'>손글씨</option>
                  <option value='"Jua", sans-serif'>주아</option>
                </select>

                {/* 사이즈 셀렉트 & 자유형 기입 인풋 */}
                <div className="flex items-center gap-1 bg-[#222] border border-neutral-800 rounded-md px-1.5 py-0.5 h-7">
                  <select
                    value={['10px','12px','13px','14px','15px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px'].includes(localASize) ? localASize : ''}
                    onChange={e => setLocalASize(e.target.value || localASize)}
                    className="text-[10px] font-bold bg-transparent text-neutral-300 outline-none cursor-pointer"
                  >
                    <option value="">수동</option>
                    <option value="10px">10px</option>
                    <option value="12px">12px</option>
                    <option value="13px">13px</option>
                    <option value="14px">14px</option>
                    <option value="15px">15px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                    <option value="32px">32px</option>
                    <option value="36px">36px</option>
                    <option value="40px">40px</option>
                    <option value="48px">48px</option>
                    <option value="56px">56px</option>
                    <option value="64px">64px</option>
                    <option value="72px">72px</option>
                  </select>
                  <input 
                    type="text" 
                    value={localASize} 
                    onChange={e => setLocalASize(e.target.value)} 
                    placeholder="Size"
                    className="w-10 text-[10px] text-center font-bold bg-[#181818] text-neutral-200 border border-neutral-800 rounded outline-none py-px focus:border-neutral-600"
                  />
                </div>

                {/* 볼드/이탤릭 토글 */}
                <button 
                  type="button" 
                  onClick={() => setLocalABold(!localABold)} 
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] transition-colors cursor-pointer border ${
                    localABold ? 'bg-neutral-200 text-neutral-900 border-neutral-100 font-extrabold' : 'bg-[#222] text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  B
                </button>
                <button 
                  type="button" 
                  onClick={() => setLocalAItalic(!localAItalic)} 
                  className={`w-7 h-7 rounded-md flex items-center justify-center italic text-[10px] transition-colors cursor-pointer border ${
                    localAItalic ? 'bg-neutral-200 text-neutral-900 border-neutral-100 font-extrabold' : 'bg-[#222] text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  I
                </button>

                {/* 색상 피커 */}
                <div className="flex items-center gap-1.5 border border-neutral-800 bg-[#222] rounded-md px-1.5 shrink-0 h-7">
                  <span className="text-[8px] text-neutral-400 font-black uppercase">Color</span>
                  <input 
                    type="color" 
                    value={localAColor || '#a3a3a3'} 
                    onChange={e => setLocalAColor(e.target.value)} 
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0" 
                  />
                </div>
              </div>

              {/* 3. 아코디언 테두리 및 효과 레이아웃 테마 */}
              <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-neutral-855 bg-[#181818]">
                <div className="flex flex-col gap-1">
                  <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                    Border Theme
                  </label>
                  <select
                    value={localBorderStyle}
                    onChange={e => setLocalBorderStyle(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-neutral-800 bg-[#222] text-neutral-200 rounded-lg outline-none cursor-pointer focus:border-neutral-600 font-sans font-bold"
                  >
                    <option value="minimal">Stripe 하단선형 (Minimal)</option>
                    <option value="glass">갤러리 글래스모피즘 (Glass Card)</option>
                    <option value="solid">모던 다크 보더 블록형 (Solid Block)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                    Hover Interaction
                  </label>
                  <select
                    value={localHoverBg}
                    onChange={e => setLocalHoverBg(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-neutral-800 bg-[#222] text-neutral-200 rounded-lg outline-none cursor-pointer focus:border-neutral-600 font-sans font-bold"
                  >
                    <option value="tint">마그네틱 틴트 (Glow Highlight)</option>
                    <option value="none">사용 안 함 (No Background)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 하단 제어 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-850 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-[10px] font-mono font-bold text-neutral-400 hover:text-neutral-250 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 text-[10px] font-mono font-bold bg-neutral-200 hover:bg-white text-neutral-900 rounded-lg transition-colors uppercase tracking-widest"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  )
}

export const FaqBlock = Node.create({
  name: 'faqBlock',
  group: 'block',
  inline: false,
  selectable: true,
  atom: true,

  addNodeView() {
    return ReactNodeViewRenderer(FaqBlockNodeView)
  },

  addAttributes() {
    return {
      question: { default: '질문이 들어갑니다.' },
      answer: { default: '여기에 상세 답변 텍스트를 입력해주세요.' },
      qFont: { default: 'inherit' },
      qSize: { default: '15px' },
      qColor: { default: '' },
      qBold: { default: true },
      qItalic: { default: false },
      aFont: { default: 'inherit' },
      aSize: { default: '14px' },
      aColor: { default: '' },
      aBold: { default: false },
      aItalic: { default: false },
      borderStyle: { default: 'minimal' },
      hoverBg: { default: 'tint' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="faq-block"]',
        getAttrs: dom => {
          if (!(dom instanceof HTMLElement)) return {}
          return {
            question: dom.getAttribute('data-question') || '질문이 들어갑니다.',
            answer: dom.getAttribute('data-answer') || '여기에 상세 답변 텍스트를 입력해주세요.',
            qFont: dom.getAttribute('data-q-font') || 'inherit',
            qSize: dom.getAttribute('data-q-size') || '15px',
            qColor: dom.getAttribute('data-q-color') || '',
            qBold: dom.getAttribute('data-q-bold') === 'false' ? false : true,
            qItalic: dom.getAttribute('data-q-italic') === 'true',
            aFont: dom.getAttribute('data-a-font') || 'inherit',
            aSize: dom.getAttribute('data-a-size') || '14px',
            aColor: dom.getAttribute('data-a-color') || '',
            aBold: dom.getAttribute('data-a-bold') === 'true',
            aItalic: dom.getAttribute('data-a-italic') === 'true',
            borderStyle: dom.getAttribute('data-border-style') || 'minimal',
            hoverBg: dom.getAttribute('data-hover-bg') || 'tint'
          }
        }
      }
    ]
  },

  renderHTML({ node }) {
    const { 
      question, 
      answer,
      qFont,
      qSize,
      qColor,
      qBold,
      qItalic,
      aFont,
      aSize,
      aColor,
      aBold,
      aItalic,
      borderStyle,
      hoverBg
    } = node.attrs
    const cleanQuestion = (question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');
    
    // 검은 점(●) 방지 대격변: nested div를 제거하고 오직 attributes 형태로 완벽하게 단일 self-closing style 태그로 보존!
    return ['div', {
      'data-type': 'faq-block',
      'data-question': cleanQuestion,
      'data-answer': answer,
      'data-q-font': qFont || 'inherit',
      'data-q-size': qSize || '15px',
      'data-q-color': qColor || '',
      'data-q-bold': qBold ? 'true' : 'false',
      'data-q-italic': qItalic ? 'true' : 'false',
      'data-a-font': aFont || 'inherit',
      'data-a-size': aSize || '14px',
      'data-a-color': aColor || '',
      'data-a-bold': aBold ? 'true' : 'false',
      'data-a-italic': aItalic ? 'true' : 'false',
      'data-border-style': borderStyle || 'minimal',
      'data-hover-bg': hoverBg || 'tint',
      class: 'faq-block-container'
    }]
  },

  addCommands() {
    return {
      insertFaqBlock: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options
        })
      }
    }
  }
})

// --- Component ---

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const FONTS = [
  { label: '기본 폰트', value: 'inherit' },
  { label: '고딕 (Noto Sans)', value: '"Noto Sans KR", sans-serif' },
  { label: '명조 (Myeongjo)', value: '"Nanum Myeongjo", serif' },
  { label: '손글씨 (Pen Script)', value: '"Nanum Pen Script", cursive' },
  { label: '주아 (Jua)', value: '"Jua", sans-serif' },
]

const SIZES = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px (기본)', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '32px', value: '32px' },
  { label: '48px', value: '48px' },
]

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [promptState, setPromptState] = useState<{ type: 'link' | 'imageLink', url: string, text: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 타이핑 감지 상태 및 복구 타이머
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInternalUpdate = useRef(false)

  // 7초간 아무 인터랙션이 없으면 툴바가 자동으로 꺼지는 스마트 절전 상태 탑재
  const [showToolbar, setShowToolbar] = useState(true)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 7초 미반응 타이머 리셋 헬퍼 함수
  const resetIdleTimer = () => {
    setShowToolbar(true)
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
    idleTimeoutRef.current = setTimeout(() => {
      setShowToolbar(false)
    }, 7000) // 정확히 7초(7000ms) 동안 반응이 없으면 툴바 꺼짐
  }

  // 컴포넌트 마운트/언마운트 시 라이프사이클 관리
  useEffect(() => {
    resetIdleTimer()
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  const [lasso, setLasso] = useState<{ active: boolean; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '내용을 입력하세요...',
      }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      CustomImage,
      ButtonLink,
      AnimatedTextGroup,
      ColumnBlock,
      Column,
      FaqBlock,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Use setTimeout to decouple the state update from Tiptap's synchronous transaction loop,
      // preventing React from throwing flushSync errors when NodeViews are dragged and dropped.
      setTimeout(() => {
        isInternalUpdate.current = true;
        setIsTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        
        // 사용자가 연속 입력을 하다가 손을 떼는(타이핑이 멈추는) 즉시 켜지도록 디바운스 시간을 150ms로 대폭 압축!
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false)
        }, 150)

        // 타이핑 동작이 감지되었으므로 7초 타이머 리셋
        resetIdleTimer()

        onChange(editor.getHTML())

        // Reset flag after React state has had time to propagate back
        setTimeout(() => {
          isInternalUpdate.current = false;
        }, 100);
      }, 0)
    },
    onSelectionUpdate: () => {
      // 마우스나 키보드 이동으로 선택 영역이나 커서가 변경되면 7초 타이머 리셋
      resetIdleTimer()
    },
    onFocus: () => {
      // 에디터가 다시 포커스를 얻으면 7초 타이머 시동
      resetIdleTimer()
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none min-h-[60px] max-w-none text-neutral-900',
      },
    },
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && !isInternalUpdate.current && content !== editor.getHTML()) {
      // setTimeout을 사용하여 React lifecycle 내부에서의 동기적인 렌더링 충돌(flushSync) 방지
      setTimeout(() => {
        if (!editor.isDestroyed && !isInternalUpdate.current && content !== editor.getHTML()) {
          editor.commands.setContent(content)
        }
      }, 0)
    }
  }, [content, editor])

  useEffect(() => {
    if (!lasso?.active) return;

    const handleMouseMove = (e: MouseEvent) => {
      setLasso(prev => {
        if (!prev) return null;

        if (editor) {
          const lassoRect = {
            left: Math.min(prev.startX, e.clientX),
            right: Math.max(prev.startX, e.clientX),
            top: Math.min(prev.startY, e.clientY),
            bottom: Math.max(prev.startY, e.clientY)
          };
          const domNodes = Array.from(editor.view.dom.children) as Element[];
          for (const node of domNodes) {
            const rect = node.getBoundingClientRect();
            if (
              rect.left < lassoRect.right &&
              rect.right > lassoRect.left &&
              rect.top < lassoRect.bottom &&
              rect.bottom > lassoRect.top
            ) {
              node.classList.add('bg-blue-500/20', 'rounded', 'transition-colors', 'duration-75');
            } else {
              node.classList.remove('bg-blue-500/20', 'rounded', 'transition-colors', 'duration-75');
            }
          }
        }

        return { ...prev, currentX: e.clientX, currentY: e.clientY };
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (lasso && editor) {
        const lassoRect = {
          left: Math.min(lasso.startX, e.clientX),
          right: Math.max(lasso.startX, e.clientX),
          top: Math.min(lasso.startY, e.clientY),
          bottom: Math.max(lasso.startY, e.clientY)
        };

        const domNodes = Array.from(editor.view.dom.children) as Element[];
        let firstIntersected: Element | null = null;
        let lastIntersected: Element | null = null;

        for (const node of domNodes) {
          const rect = node.getBoundingClientRect();
          if (
            rect.left < lassoRect.right &&
            rect.right > lassoRect.left &&
            rect.top < lassoRect.bottom &&
            rect.bottom > lassoRect.top
          ) {
            if (!firstIntersected) firstIntersected = node;
            lastIntersected = node;
          }
          // Clean up live highlight classes on mouse up
          node.classList.remove('bg-blue-500/20', 'rounded', 'transition-colors', 'duration-75');
        }

        if (firstIntersected && lastIntersected) {
          try {
            const fromPos = editor.view.posAtDOM(firstIntersected, 0);
            const toPos = editor.view.posAtDOM(lastIntersected, lastIntersected.childNodes.length);
            editor.commands.setTextSelection({ from: fromPos, to: toPos });
            editor.view.focus();
          } catch (err) {
            console.error('Lasso selection error:', err);
          }
        }
      }
      setLasso(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [lasso?.active, lasso?.startX, lasso?.startY, editor]);

  const handleLassoMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Ignore if clicking on a drag handle
    if (target.closest('[data-drag-handle]')) return;

    const editorRect = editorContainerRef.current?.getBoundingClientRect();

    // Lasso if clicking on left/right margins (60px) or main container background
    const isMargin = editorRect && (e.clientX < editorRect.left + 60 || e.clientX > editorRect.right - 60);

    if (isMargin || target === editorContainerRef.current) {
      setLasso({
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY
      });
    }
  };

  const setLink = useCallback(() => {
    if (!editor) return
    if (editor.state.selection.empty) {
      alert('링크를 적용할 텍스트를 먼저 드래그(선택)해주세요!')
      return
    }
    const previousUrl = editor.getAttributes('link').href || ''
    setPromptState({ type: 'link', url: previousUrl, text: '' })
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    fileInputRef.current?.click()
  }, [editor])

  const addButtonLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertButtonLink({ href: 'https://', text: '버튼', bgColor: '#171717', buttonStyle: 'default', align: 'center' }).run()
  }, [editor])

  const handlePromptSubmit = () => {
    if (!editor || !promptState) return
    const { type, url } = promptState

    if (type === 'link') {
      if (!url) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
      } else {
        const validUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
        editor.chain().focus().extendMarkRange('link').setLink({ href: validUrl }).run()
      }
    } else if (type === 'imageLink') {
      if (!url) {
        editor.chain().focus().updateImageAttrs({ href: undefined }).run()
      } else {
        const validUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
        editor.chain().focus().updateImageAttrs({ href: validUrl }).run()
      }
    }
    setPromptState(null)
  }

  const handlePromptCancel = () => {
    setPromptState(null)
    editor?.chain().focus().run()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !editor) return
    const file = e.target.files[0]

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const url = await uploadFileAction(formData)

      editor.chain().focus().setImage({ src: url }).run()
    } catch (error) {
      console.error('Image upload failed:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
      // Reset input value to allow uploading the same file again
      e.target.value = ''
    }
  }

  if (!editor) return null

  const ToolbarButton = ({ onClick, isActive, children, title }: any) => (
    <Tooltip text={title} position="top">
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={onClick}
        type="button"
        className={`p-1.5 sm:p-2 rounded hover:bg-neutral-800 transition-colors flex items-center justify-center ${isActive ? 'bg-neutral-800 text-blue-400' : 'text-neutral-400 hover:text-white'
          }`}
      >
        {children}
      </button>
    </Tooltip>
  )

  return (
    <div
      className="w-full flex flex-col group relative"
      ref={editorContainerRef}
      onMouseDown={handleLassoMouseDown}
      onMouseMove={resetIdleTimer}
    >

      {/* Lasso Selection Box */}
      {lasso && lasso.active && (
        <div
          className="fixed bg-blue-500/20 border border-blue-500/50 pointer-events-none z-50 rounded-[2px]"
          style={{
            left: Math.min(lasso.startX, lasso.currentX),
            top: Math.min(lasso.startY, lasso.currentY),
            width: Math.abs(lasso.currentX - lasso.startX),
            height: Math.abs(lasso.currentY - lasso.startY),
          }}
        />
      )}

      {/* Floating Menu */}
      <FloatingMenu
        editor={editor}
        updateDelay={250}

        shouldShow={({ state, editor }) => {
          if (!editor || !editor.isFocused || editor.view.dragging) return false
          const { $from, empty } = state.selection
          if (!empty) return false
          
          // React rendering 루프 충돌 방지를 위해 일반 paragraph이면서 완전 비어있는 줄일 때만 띄우도록 필터링
          const isParagraph = $from.parent.type.name === 'paragraph'
          const isLineEmpty = $from.parent.textContent.length === 0
          return isParagraph && isLineEmpty
        }}
      >
        <div
          className="flex bg-[#252525] border border-neutral-700/60 rounded-lg shadow-xl overflow-hidden p-1 transition-all duration-200 transform ease-out -translate-y-6 animate-in fade-in zoom-in-95"
        >
          <ToolbarButton onClick={addImage} title="이미지 삽입">
            {isUploading ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={18} />}
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="H1 제목"><Heading1 size={18} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="H2 제목"><Heading2 size={18} /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().insertFaqBlock({ question: '여기에 질문을 작성하세요', answer: '여기에 상세한 답변을 기재해 주세요.' }).run()}
            title="아코디언 (FAQ) 상자 추가"
          >
            <span className="flex items-center gap-1 text-[11px] font-bold text-neutral-300 hover:text-white px-1">
              아코디언
            </span>
          </ToolbarButton>
          <div className="w-[1px] h-4 bg-neutral-600 mx-1 self-center" />
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('50-50').run()} title="50:50 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />5:5</div></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('30-70').run()} title="30:70 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />3:7</div></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('40-60').run()} title="40:60 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />4:6</div></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('60-40').run()} title="60:40 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />6:4</div></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('70-30').run()} title="70:30 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />7:3</div></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertColumns('33-33-33').run()} title="3단 분할 상자"><div className="flex items-center gap-1 text-[10px] font-bold"><Columns2 size={14} />3:3:3</div></ToolbarButton>
        </div>
      </FloatingMenu>

      {/* Text Bubble Menu */}
      <BubbleMenu
        pluginKey="textBubbleMenu"
        editor={editor}
        updateDelay={250}

        shouldShow={({ state, editor }) => {
          if (editor.view.dragging) return false;
          let hasImage = false;
          if (editor.isActive('image') || editor.isActive('customImage')) hasImage = true;
          else if ('node' in state.selection && (state.selection as any).node) {
            hasImage = (state.selection as any).node.type.name === 'image' || (state.selection as any).node.type.name === 'customImage';
          } else if (!state.selection.empty) {
            state.selection.content().content.descendants((node) => {
              if (node.type.name === 'image' || node.type.name === 'customImage') hasImage = true;
            });
          }
          if (hasImage) return false;
          
          // 사용자가 에디터 상에서 글을 활발하게 타이핑(입력)하는 중일 때는 툴바가 타이핑 시야를 방해하지 않도록 즉각 소멸
          if (isTyping) return false;
          
          // 에디터에 포커스가 유지되어 있고 타이핑을 멈춘 상태(혹은 커서 멈춘 대기선)이거나 드래그 영역 조작 시에만 텍스트 옵션 버블탭 노출
          return editor.isFocused;
        }}
        className="z-50"
      >
        <div
          onMouseMove={resetIdleTimer}
          onMouseEnter={resetIdleTimer}
          style={{
            opacity: showToolbar ? 1 : 0,
            visibility: showToolbar ? 'visible' : 'hidden',
            pointerEvents: showToolbar ? 'auto' : 'none',
            transition: 'opacity 0.28s ease, visibility 0.28s ease, transform 0.28s ease'
          }}
          className="flex flex-col bg-[#252525] border border-neutral-700/60 rounded-xl shadow-2xl overflow-hidden min-w-[280px] transition-all duration-200 transform ease-out animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center gap-0.5 p-1 border-b border-neutral-700/60">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게"><Bold size={15} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임"><Italic size={15} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={15} /></ToolbarButton>
            <div className="w-[1px] h-4 bg-neutral-600 mx-1" />
            <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="일반 링크 삽입"><LinkIcon size={15} /></ToolbarButton>
            <ToolbarButton onClick={addButtonLink} isActive={false} title="버튼 스타일 링크"><MousePointerSquareDashed size={15} /></ToolbarButton>
          </div>

          <div className="flex flex-col py-1">
            <div className="flex items-center justify-between px-3 py-1.5 hover:bg-[#333] transition-colors w-full cursor-pointer">
              <div className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="text-neutral-400 text-[15px]">✨</span>
                <span>텍스트 효과</span>
              </div>
              <select
                onChange={e => {
                  if (e.target.value === '') return
                  const val = e.target.value;

                  const { from, to } = editor.state.selection;
                  const selectedText = editor.state.doc.textBetween(from, to, ' ') || '기본 텍스트';

                  if (val === 'rotating' || val === 'morphing') {
                    const defaultTexts = [selectedText, "반갑습니다", "환영합니다"];
                    editor.chain().focus().insertAnimatedTextGroup({ animationType: val, texts: JSON.stringify(defaultTexts) }).run()
                  } else {
                    editor.chain().focus().insertAnimatedTextGroup({ animationType: val, texts: JSON.stringify([selectedText]) }).run()
                  }
                  e.target.value = ''
                }}
                className="bg-transparent text-xs text-neutral-400 outline-none cursor-pointer text-right max-w-[100px]"
              >
                <option value="">적용하기...</option>
                <option value="typing">Typing Text</option>
                <option value="splitting">Splitting Text</option>
                <option value="sliding">Sliding Text</option>
                <option value="shimmering">Shimmering Text</option>
                <option value="rolling">Rolling Text</option>
                <option value="rotating">Rotating Text</option>
                <option value="highlight">Highlight Text</option>
                <option value="morphing">Morphing Text</option>
                <option value="gradient">Gradient Text</option>
              </select>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 hover:bg-[#333] transition-colors w-full cursor-pointer">
              <div className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="text-neutral-400 font-serif font-bold text-[15px]">A</span>
                <span>서체 및 크기</span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  onChange={e => {
                    if (e.target.value === 'inherit') editor.chain().focus().unsetFontFamily().run()
                    else editor.chain().focus().setFontFamily(e.target.value).run()
                  }}
                  className="bg-transparent text-xs text-neutral-400 outline-none cursor-pointer max-w-[80px]"
                  value={editor.getAttributes('textStyle').fontFamily || 'inherit'}
                >
                  {FONTS.map(f => <option key={f.value} value={f.value} className="bg-neutral-800">{f.label}</option>)}
                </select>
                <select
                  onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}
                  className="bg-transparent text-xs text-neutral-400 outline-none cursor-pointer max-w-[60px]"
                  value={editor.getAttributes('textStyle').fontSize || '16px'}
                >
                  {SIZES.map(s => <option key={s.value} value={s.value} className="bg-neutral-800">{s.label}</option>)}
                </select>
              </div>
            </div>

            <div
              onClick={() => {
                const { from, to } = editor.state.selection;
                let selectedText = editor.state.doc.textBetween(from, to, ' ').trim() || '여기에 질문을 입력하세요';
                // Q. 혹은 Q 접두사 완전히 제거
                selectedText = selectedText.replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');
                editor.chain().focus().insertFaqBlock({ question: selectedText, answer: '여기에 상세 답변을 작성해주세요.' }).run();
              }}
              className="flex items-center justify-between px-3 py-2 hover:bg-[#333] transition-colors w-full cursor-pointer border-t border-neutral-700/40"
            >
              <div className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="font-semibold text-neutral-300">아코디언 (FAQ) 추가</span>
              </div>
              <span className="text-[10px] text-blue-400 font-extrabold uppercase bg-blue-500/10 px-1.5 py-0.5 rounded">생성</span>
            </div>
          </div>
        </div>
      </BubbleMenu>

      {/* Image Bubble Menu */}
      <BubbleMenu
        pluginKey="imageBubbleMenu"
        editor={editor}
        updateDelay={100}

        shouldShow={({ state, editor }) => {
          if (editor.view.dragging) return false;
          let hasImage = false;
          if (editor.isActive('image') || editor.isActive('customImage')) hasImage = true;
          else if ('node' in state.selection && (state.selection as any).node) {
            hasImage = (state.selection as any).node.type.name === 'image' || (state.selection as any).node.type.name === 'customImage';
          }
          return hasImage;
        }}
        className="z-50"
      >
        <div
          className="flex flex-col gap-1 p-1.5 px-2 bg-[#2d2d2d] rounded-xl shadow-xl overflow-hidden text-white border border-neutral-700/60 w-max transition-all duration-200 transform ease-out animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center gap-1 w-full justify-between">
            <ToolbarButton onClick={() => editor.chain().focus().setImageAlign('left').run()} isActive={editor.getAttributes('customImage').align === 'left'} title="이미지 왼쪽으로 (텍스트 감싸기)">
              <span className="text-[11px] font-bold text-neutral-300 px-1">좌측배치</span>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setImageAlign('center').run()} isActive={editor.getAttributes('customImage').align === 'center' || !editor.getAttributes('customImage').align} title="이미지 가운데로">
              <span className="text-[11px] font-bold text-neutral-300 px-1">가운데</span>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setImageAlign('right').run()} isActive={editor.getAttributes('customImage').align === 'right'} title="이미지 오른쪽으로 (텍스트 감싸기)">
              <span className="text-[11px] font-bold text-neutral-300 px-1">우측배치</span>
            </ToolbarButton>
            <div className="w-[1px] h-4 bg-neutral-600 mx-1" />
            <ImageSizeInputs editor={editor} />
            <div className="w-[1px] h-4 bg-neutral-600 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().deleteSelection().run()} isActive={false} title="이미지 삭제">
              <span className="text-[11px] font-bold text-red-400 px-1">삭제</span>
            </ToolbarButton>
          </div>
          <ImageLinkInput editor={editor} />
        </div>
      </BubbleMenu>

      {/* Inline Prompt UI */}
      <AnimatePresence>
        {promptState && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row gap-2 items-center w-full shadow-inner relative z-20"
          >
            <div className="text-xs font-bold text-neutral-600 shrink-0 min-w-[70px]">
              🔗 링크 추가
            </div>

            <div className="flex-1 w-full flex flex-col sm:flex-row gap-2 items-center">
              <input
                type="text"
                placeholder="이동할 URL (https://...)"
                value={promptState.url}
                onChange={e => setPromptState({ ...promptState, url: e.target.value })}
                className="px-3 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-blue-500 flex-1 w-full"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handlePromptSubmit() }}
              />

              <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                <button onClick={handlePromptCancel} className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 bg-white border border-neutral-200 rounded">취소</button>
                <button onClick={handlePromptSubmit} className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">적용</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiptap content area */}
      <div className="p-4 sm:p-6 bg-white min-h-[150px] cursor-text" onClick={() => { if (!promptState) editor.commands.focus() }}>
        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" ref={fileInputRef} />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
