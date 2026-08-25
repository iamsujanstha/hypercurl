import React, { useState, useEffect } from 'react';

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

  // NULL
  if (val === null) {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-slate-400 json-node-null font-semibold italic break-all">
          null
          {!isLast && <span className="text-slate-400 json-node-punct font-normal not-italic">,</span>}
        </div>
      </div>
    );
  }

  const type = typeof val;

  // STRING
  if (type === 'string') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-[#34d399] json-node-string break-all">
          "{val}"
          {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
        </div>
      </div>
    );
  }

  // NUMBER
  if (type === 'number') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-[#fbbf24] json-node-number font-semibold break-all">
          {val}
          {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
        </div>
      </div>
    );
  }

  // BOOLEAN
  if (type === 'boolean') {
    return (
      <div className="flex items-center py-[2.5px] select-text font-mono text-[13px] leading-relaxed group">
        <span className="w-5 shrink-0 inline-block" />
        {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
        {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
        <div className="text-violet-400 json-node-boolean font-bold break-all">
          {val.toString()}
          {!isLast && <span className="text-slate-400 json-node-punct font-normal">,</span>}
        </div>
      </div>
    );
  }

  // ARRAY
  if (Array.isArray(val)) {
    const itemsCount = val.length;
    const itemsText = itemsCount === 1 ? '1 item' : `${itemsCount} items`;

    if (itemsCount === 0) {
      return (
        <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group">
          <span className="w-5 shrink-0 inline-block" />
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          <div className="text-slate-400 json-node-punct break-all">
            []
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
          </div>
        </div>
      );
    }

    return (
      <div className="font-mono text-[13px] leading-relaxed select-text">
        <div 
          className="flex items-center cursor-pointer select-none hover:bg-slate-800/40 rounded px-0.5 transition-colors py-[2.5px] group"
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
        >
          <span className="text-slate-400 hover:text-cyan-400 text-[10px] w-5 text-center inline-block shrink-0 transition-transform font-sans font-bold select-none">
            {collapsed ? '▶' : '▼'}
          </span>
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          {collapsed ? (
            <div className="text-slate-300 break-all flex items-center gap-2">
              <span className="text-slate-400 json-node-punct font-semibold">[...]</span>
              <span className="text-slate-400 text-[12px] italic font-sans whitespace-nowrap">{itemsText}</span>
              {!isLast && <span className="text-slate-400 json-node-punct font-normal font-mono not-italic">,</span>}
            </div>
          ) : (
            <div className="text-slate-300 break-all flex items-center gap-2">
              <span className="text-slate-300 json-node-punct font-semibold">[</span>
              <span className="text-slate-400 text-[12px] italic font-sans whitespace-nowrap">{itemsText}</span>
            </div>
          )}
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
          <div className="text-slate-300 json-node-punct py-[2px] flex items-center">
            <span className="w-5 shrink-0 inline-block text-center font-bold">]</span>
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
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
        <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group">
          <span className="w-5 shrink-0 inline-block" />
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          <div className="text-slate-400 json-node-punct break-all">
            {"{}"}
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
          </div>
        </div>
      );
    }

    return (
      <div className="font-mono text-[13px] leading-relaxed select-text">
        <div 
          className="flex items-center cursor-pointer select-none hover:bg-slate-800/40 rounded px-0.5 transition-colors py-[2.5px] group"
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
        >
          <span className="text-slate-400 hover:text-cyan-400 text-[10px] w-5 text-center inline-block shrink-0 transition-transform font-sans font-bold select-none">
            {collapsed ? '▶' : '▼'}
          </span>
          {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
          {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
          {collapsed ? (
            <div className="text-slate-300 break-all flex items-center gap-2">
              <span className="text-slate-400 json-node-punct font-semibold">{"{...}"}</span>
              <span className="text-slate-400 text-[12px] italic font-sans whitespace-nowrap">{itemsText}</span>
              {!isLast && <span className="text-slate-400 json-node-punct font-normal font-mono not-italic">,</span>}
            </div>
          ) : (
            <div className="text-slate-300 break-all flex items-center gap-2">
              <span className="text-slate-300 json-node-punct font-semibold">{"{"}</span>
              <span className="text-slate-400 text-[12px] italic font-sans whitespace-nowrap">{itemsText}</span>
            </div>
          )}
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
          <div className="text-slate-300 json-node-punct py-[2px] flex items-center">
            <span className="w-5 shrink-0 inline-block text-center font-bold">{"}"}</span>
            {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
          </div>
        )}
      </div>
    );
  }

  // FALLBACK
  return (
    <div className="flex items-center py-[2.5px] font-mono text-[13px] leading-relaxed group">
      <span className="w-5 shrink-0 inline-block" />
      {label && <span className="text-[#60a5fa] json-node-key whitespace-nowrap shrink-0">"{label}"</span>}
      {label && <span className="text-slate-400 json-node-punct mx-2 shrink-0">:</span>}
      <div className="text-slate-400 json-node-punct break-all">
        {String(val)}
        {!isLast && <span className="text-slate-400 json-node-punct">,</span>}
      </div>
    </div>
  );
}
