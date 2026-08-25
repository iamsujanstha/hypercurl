import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JsonInteractiveNodeProps {
  key?: React.Key;
  label?: string;
  val: any;
  isLast?: boolean;
  depth?: number;
  defaultCollapsed?: boolean;
  forceExpandAll?: boolean | null;
}

export function JsonInteractiveNode({ 
  label, 
  val, 
  isLast = true,
  depth = 0,
  defaultCollapsed = true,
  forceExpandAll = null
}: JsonInteractiveNodeProps) {
  // If depth is 0 (the root object/array), default to OPEN (not collapsed).
  // If depth > 0 (all child objects/arrays), default to COLLAPSED.
  const [collapsed, setCollapsed] = useState(() => {
    if (depth === 0) return false;
    return defaultCollapsed;
  });

  const [copied, setCopied] = useState(false);

  // When forceExpandAll changes (e.g. user clicks Expand All / Collapse All), update state
  useEffect(() => {
    if (forceExpandAll === true) {
      setCollapsed(false);
    } else if (forceExpandAll === false) {
      if (depth > 0) {
        setCollapsed(true);
      } else {
        setCollapsed(false); // keep root open even on collapse all
      }
    }
  }, [forceExpandAll, depth]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if (typeof val === 'object' && val !== null) {
      try {
        textToCopy = JSON.stringify(val, null, 2);
      } catch {
        textToCopy = String(val);
      }
    } else if (typeof val === 'string') {
      textToCopy = val;
    } else {
      textToCopy = String(val);
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const renderCopyButton = (titleText: string) => (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "json-copy-btn opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer border select-none shrink-0 ml-2 shadow-xs",
        copied 
          ? "bg-emerald-950/90 text-emerald-300 border-emerald-700 opacity-100" 
          : "bg-[#141C2B] hover:bg-slate-800 text-slate-300 hover:text-white border-slate-750"
      )}
      title={titleText}
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
      <span className="text-[10px] font-sans font-medium">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );

  // NULL
  if (val === null) {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-slate-400 json-node-null font-normal italic break-all flex items-center">
          null
          {!isLast && <span className="text-slate-400 json-node-punct font-normal not-italic">,</span>}
        </div>
        {renderCopyButton(label ? `Copy "${label}" value` : 'Copy value')}
      </div>
    );
  }

  const type = typeof val;

  // STRING
  if (type === 'string') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-[#34d399] json-node-string font-normal break-all flex items-center">
          "{val}"
          {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
        </div>
        {renderCopyButton(label ? `Copy "${label}" value` : 'Copy string')}
      </div>
    );
  }

  // NUMBER
  if (type === 'number') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-[#fbbf24] json-node-number font-normal break-all flex items-center">
          {val}
          {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
        </div>
        {renderCopyButton(label ? `Copy "${label}" value` : 'Copy number')}
      </div>
    );
  }

  // BOOLEAN
  if (type === 'boolean') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-violet-400 json-node-boolean font-normal break-all flex items-center">
          {val.toString()}
          {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
        </div>
        {renderCopyButton(label ? `Copy "${label}" value` : 'Copy boolean')}
      </div>
    );
  }

  // ARRAY
  if (Array.isArray(val)) {
    const itemsCount = val.length;
    const itemsText = itemsCount === 1 ? '1 item' : `${itemsCount} items`;

    if (itemsCount === 0) {
      return (
        <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
          <span className="w-5 shrink-0 inline-block" />
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          <div className="text-slate-400 json-node-punct break-all flex items-center">
            []
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
          </div>
          {renderCopyButton(label ? `Copy "${label}" array` : 'Copy empty array')}
        </div>
      );
    }

    return (
      <div className="font-mono text-[13px] leading-relaxed select-text">
        <div 
          className="flex items-center cursor-pointer select-none hover:bg-slate-800/40 rounded px-1 transition-colors py-[2.5px] group json-expandable-header"
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
        >
          <span className="text-slate-400 hover:text-cyan-400 text-[10px] w-5 text-center inline-block shrink-0 transition-transform font-sans font-bold select-none json-node-arrow">
            {collapsed ? '▶' : '▼'}
          </span>
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          {collapsed ? (
            <div className="text-slate-300 break-all flex items-center gap-2 font-normal">
              <span className="text-slate-400 json-node-punct font-normal">[...]</span>
              <span className="text-slate-400 json-node-meta text-[12px] italic font-sans whitespace-nowrap font-normal">{itemsText}</span>
              {!isLast && <span className="text-slate-400 json-node-punct font-normal font-mono not-italic">,</span>}
            </div>
          ) : (
            <div className="text-slate-300 break-all flex items-center gap-2 font-normal">
              <span className="text-slate-300 json-node-punct font-normal">[</span>
              <span className="text-slate-400 json-node-meta text-[12px] italic font-sans whitespace-nowrap font-normal">{itemsText}</span>
            </div>
          )}
          {renderCopyButton(label ? `Copy "${label}" array (${itemsText})` : `Copy array (${itemsText})`)}
        </div>
        
        {!collapsed && (
          <div className="border-l border-slate-700/60 json-tree-line ml-[9.5px] pl-3.5 transition-all space-y-0 relative">
            {val.map((item, idx) => (
              <JsonInteractiveNode 
                key={idx} 
                val={item} 
                isLast={idx === itemsCount - 1} 
                depth={depth + 1}
                defaultCollapsed={defaultCollapsed}
                forceExpandAll={forceExpandAll} 
              />
            ))}
          </div>
        )}
        
        {!collapsed && (
          <div className="text-slate-300 json-node-punct py-[2px] flex items-center px-1 font-normal">
            <span className="w-5 shrink-0 inline-block text-center font-normal">]</span>
            {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
          </div>
        )}
      </div>
    );
  }

  // OBJECT
  if (type === 'object') {
    const keys = Object.keys(val);
    const itemsCount = keys.length;
    const itemsText = itemsCount === 1 ? '1 item' : `${itemsCount} items`;

    if (itemsCount === 0) {
      return (
        <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
          <span className="w-5 shrink-0 inline-block" />
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          <div className="text-slate-400 json-node-punct break-all flex items-center font-normal">
            {"{}"}
            {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
          </div>
          {renderCopyButton(label ? `Copy "${label}" object` : 'Copy empty object')}
        </div>
      );
    }

    return (
      <div className="font-mono text-[13px] leading-relaxed select-text">
        <div 
          className="flex items-center cursor-pointer select-none hover:bg-slate-800/40 rounded px-1 transition-colors py-[2.5px] group json-expandable-header"
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
        >
          <span className="text-slate-400 hover:text-cyan-400 text-[10px] w-5 text-center inline-block shrink-0 transition-transform font-sans font-bold select-none json-node-arrow">
            {collapsed ? '▶' : '▼'}
          </span>
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          {collapsed ? (
            <div className="text-slate-300 break-all flex items-center gap-2 font-normal">
              <span className="text-slate-400 json-node-punct font-normal">{"{...}"}</span>
              <span className="text-slate-400 json-node-meta text-[12px] italic font-sans whitespace-nowrap font-normal">{itemsText}</span>
              {!isLast && <span className="text-slate-400 json-node-punct font-normal font-mono not-italic">,</span>}
            </div>
          ) : (
            <div className="text-slate-300 break-all flex items-center gap-2 font-normal">
              <span className="text-slate-300 json-node-punct font-normal">{"{"}</span>
              <span className="text-slate-400 json-node-meta text-[12px] italic font-sans whitespace-nowrap font-normal">{itemsText}</span>
            </div>
          )}
          {renderCopyButton(label ? `Copy "${label}" object (${itemsText})` : `Copy object (${itemsText})`)}
        </div>
        
        {!collapsed && (
          <div className="border-l border-slate-700/60 json-tree-line ml-[9.5px] pl-3.5 transition-all space-y-0 relative">
            {keys.map((k, idx) => (
              <JsonInteractiveNode 
                key={k} 
                label={k} 
                val={val[k]} 
                isLast={idx === itemsCount - 1} 
                depth={depth + 1}
                defaultCollapsed={defaultCollapsed}
                forceExpandAll={forceExpandAll} 
              />
            ))}
          </div>
        )}
        
        {!collapsed && (
          <div className="text-slate-300 json-node-punct py-[2px] flex items-center px-1">
            <span className="w-5 shrink-0 inline-block text-center font-bold">{"}"}</span>
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
          </div>
        )}
      </div>
    );
  }

  // FALLBACK
  return (
    <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group json-node-row hover:bg-slate-800/30 rounded px-1">
      <span className="w-5 shrink-0 inline-block" />
      {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
      {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
      <div className="text-slate-400 json-node-punct break-all flex items-center">
        {String(val)}
        {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
      </div>
      {renderCopyButton(label ? `Copy "${label}" value` : 'Copy value')}
    </div>
  );
}
