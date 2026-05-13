import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Check } from 'lucide-react';
import Button from '../ui/Button.jsx';
import { fetchAPI } from '../../services/api.js';

export default function ContentModal({ isOpen, onClose, moduleId, onSave, initialTab }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(''); // Added description
  const [preview, setPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle('');
      setDescription('');
      setPreview(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file to upload.");

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    
    // IMPORTANT: Fixes your "title and content_type are required" error
    formData.append('content_type', initialTab); 
    
    // Ensure preview is sent in a way your backend parses (boolean or string)
    formData.append('preview', preview); 

    try {
      // 1. Select the correct endpoint based on file type
      const endpoint = initialTab === 'video' ? '/content/upload-video' : '/content/upload';
      const uploadRes = await fetchAPI(endpoint, { 
        method: 'POST', 
        body: formData 
      });
      
      // 2. Link the uploaded content to the specific module
      if (uploadRes.success && uploadRes.content) {
         await fetchAPI(`/modules/${moduleId}/content`, { 
            method: 'POST', 
            body: JSON.stringify({ content_id: uploadRes.content.id }) 
         });
         onSave(); // Refresh course detail data
         onClose();
      }
    } catch (err) {
      alert(err.message || "Upload failed. Check console for details.");
      console.error("Upload Error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans">
      <div className="relative w-full max-w-lg bg-white border-[3px] border-black rounded-2xl flex flex-col shadow-[8px_8px_0px_0px_#111]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-[3px] border-black bg-[#87CEFA]">
          <h3 className="font-black text-xl uppercase tracking-tight">
            Upload {initialTab === 'video' ? 'Video Lecture' : 'PDF Material'}
          </h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 border-2 border-black bg-[#F26B4D] rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[2px_2px_0px_0px_#000]"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          
          {/* File Dropzone */}
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="border-[3px] border-dashed border-black rounded-xl p-8 flex flex-col items-center cursor-pointer bg-[#F4F4F4] hover:bg-[#F9E076]/10 transition-colors"
          >
            <UploadCloud size={40} className="mb-2 text-black" />
            <p className="font-bold text-sm text-center line-clamp-1">
              {file ? file.name : `Click to Browse ${initialTab.toUpperCase()}`}
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept={initialTab === 'pdf' ? '.pdf' : 'video/*'} 
              onChange={(e) => setFile(e.target.files[0])} 
            />
          </div>

          {/* Inputs */}
          <div className="flex flex-col gap-3">
            <input 
              required 
              placeholder="Content Title (e.g. Introduction to Calculus)" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-bold outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-all" 
            />
            
            <textarea 
              placeholder="Short Description (Optional)" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              rows={2}
              className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-bold outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-all resize-none" 
            />
          </div>

          {/* Preview Toggle */}
          <div 
            onClick={() => setPreview(!preview)} 
            className={`border-2 border-black rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all ${preview ? 'bg-[#A7E2D1]' : 'bg-gray-50'}`}
          >
            <div>
              <span className="font-black text-sm block leading-none">FREE PREVIEW?</span>
              <span className="text-[10px] font-bold text-gray-600">Students can watch this without buying.</span>
            </div>
            <div className={`w-8 h-8 border-2 border-black rounded-lg flex items-center justify-center transition-colors ${preview ? 'bg-black text-white' : 'bg-white'}`}>
              {preview && <Check size={18} strokeWidth={4}/>}
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            variant="primary" 
            disabled={isUploading}
            className="py-4 border-[3px]"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin text-2xl">⏳</span> Uploading...
              </span>
            ) : 'Confirm & Upload'}
          </Button>
        </form>
      </div>
    </div>
  );
}