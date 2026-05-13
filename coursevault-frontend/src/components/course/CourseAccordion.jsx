import React from 'react';
import { Video, FileText, Plus, Edit, Trash2, FilePlus } from 'lucide-react';
import { formatSize } from '../../utils/format';

export default function CourseAccordion({ 
  module, 
  isOpen, 
  onToggle, 
  onContentClick, 
  isCreator, 
  onAddContent, 
  onAddPDF, 
  onEditModule, 
  onDeleteModule 
}) {
  const contents = module.contents || [];

  return (
    <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#111]">
      <div 
        className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <h3 className="font-bold text-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F4DFD8] border-2 border-black flex items-center justify-center text-sm">
            {isOpen ? '-' : '+'}
          </div>
          {module.title}
        </h3>
        
        <div className="flex items-center gap-3">
          {/* Educator Controls */}
          {isCreator && (
            <div className="flex gap-2">
              <button title="Add Video" onClick={(e) => { e.stopPropagation(); onAddContent(module.id); }} className="w-8 h-8 flex items-center justify-center bg-[#87CEFA] border-2 border-black rounded-md hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#000]">
                <Video size={14} strokeWidth={3} />
              </button>
              <button title="Add PDF" onClick={(e) => { e.stopPropagation(); onAddPDF(module.id); }} className="w-8 h-8 flex items-center justify-center bg-[#A7E2D1] border-2 border-black rounded-md hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#000]">
                <FilePlus size={14} strokeWidth={3} />
              </button>
              <button title="Edit Module" onClick={(e) => { e.stopPropagation(); onEditModule(module); }} className="w-8 h-8 flex items-center justify-center bg-[#F9E076] border-2 border-black rounded-md hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#000]">
                <Edit size={14} strokeWidth={3} />
              </button>
              <button title="Delete Module" onClick={(e) => { e.stopPropagation(); onDeleteModule(module.id); }} className="w-8 h-8 flex items-center justify-center bg-red-400 border-2 border-black rounded-md hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#000]">
                <Trash2 size={14} strokeWidth={3} />
              </button>
            </div>
          )}
          <span className="font-bold text-gray-500 text-sm ml-2">{contents.length} Items</span>
        </div>
      </div>

      <div className={`module-content ${isOpen ? 'open' : ''}`}>
        <div className="module-inner">
          <div className="p-6 pt-0 border-t-2 border-black bg-gray-50">
            {contents.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 italic">No content in this module.</p>
            ) : contents.map((content) => (
              <div key={content.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b border-gray-200 last:border-0 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center ${content.content_type === 'video' ? 'bg-[#87CEFA]' : 'bg-[#F9E076]'}`}>
                    {content.content_type === 'video' ? <Video size={18} /> : <FileText size={18} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg leading-none mb-1">{content.title}</h4>
                    <p className="text-sm font-medium text-gray-500">
                      {content.content_type === 'video' ? `Video` : `PDF • ${formatSize(content.file_size_bytes)}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {content.preview && <span className="bg-[#F26B4D] text-black text-[10px] font-black px-2 py-0.5 border-2 border-black rounded uppercase">Preview</span>}
                  <button 
                    onClick={() => onContentClick(content)}
                    className="bg-white border-2 border-black rounded-lg px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_#111] hover:bg-[#A7E2D1] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                  >
                    {content.content_type === 'video' ? 'Watch' : 'Read'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}