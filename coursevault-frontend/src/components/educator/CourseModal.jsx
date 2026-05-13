import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import { fetchAPI } from '../../services/api';

export default function CourseModal({ isOpen, onClose, course = null, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setDescription(course.description || '');
      setPrice(course.price || 0);
      setStatus(course.status || 'draft');
    } else {
      setTitle('');
      setDescription('');
      setPrice(0);
      setStatus('draft');
    }
  }, [course, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const data = { title, description, price: parseFloat(price), status };

    try {
      if (course) {
        await fetchAPI(`/courses/${course.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await fetchAPI('/courses', { method: 'POST', body: JSON.stringify(data) });
      }
      onSave();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to save course');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#F4DFD8] border-[3px] border-black rounded-2xl flex flex-col shadow-[8px_8px_0px_0px_#111]">
        <div className="flex justify-between items-center p-4 border-b-[3px] border-black bg-white rounded-t-xl">
          <h3 className="font-bold text-xl">{course ? 'Edit Course' : 'Create Course'}</h3>
          <button onClick={onClose} className="w-8 h-8 border-[3px] border-black bg-[#F26B4D] rounded-full flex items-center justify-center font-bold hover:scale-110">
            <X size={16} strokeWidth={3} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 bg-white rounded-b-xl">
          <div>
            <label className="font-bold text-sm ml-1 mb-1 block">Course Title</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-2 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D]" />
          </div>
          <div>
            <label className="font-bold text-sm ml-1 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-2 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D]" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="font-bold text-sm ml-1 mb-1 block">Price (₹)</label>
              <input type="number" min="0" required value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-2 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D]" />
            </div>
            <div className="flex-1">
              <label className="font-bold text-sm ml-1 mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-2 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D]">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 border-[3px] border-black rounded-xl font-bold hover:bg-gray-100 transition-colors">Cancel</button>
            <Button type="submit" variant="primary" className="py-2" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}