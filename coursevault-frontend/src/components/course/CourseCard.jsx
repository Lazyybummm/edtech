import React from 'react';
import { Play, BookOpen } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { getBgColor, getTagColor } from '../../utils/format.js';

export default function CourseCard({ course, index, onClick, isMyLearning }) {
  const bgColor = getBgColor(course.id);
  const tagColor = getTagColor(course.id);

  return (
    <div 
      onClick={() => onClick(course.id)}
      className={`relative group w-full max-w-[400px] mx-auto xl:mx-0 cursor-pointer
        ${index % 3 === 0 ? 'xl:mt-12' : index % 3 === 1 ? 'xl:mt-0' : 'xl:mt-24'}`} 
    >
      <div className="absolute inset-0 bg-[#932973] border border-black rounded-xl transition-all duration-300 group-hover:-translate-x-5 group-hover:translate-y-5 z-0"></div>
      <div className="absolute inset-0 bg-[#F26B4D] border border-black rounded-xl transition-all duration-300 group-hover:-translate-x-2.5 group-hover:translate-y-2.5 z-0"></div>

      {/* Using light border border-black here as requested */}
      <div className="relative bg-white border border-black shadow-[4px_4px_0px_0px_#111] rounded-xl overflow-hidden z-10 flex flex-col h-[480px] transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
        
        <div className={`h-[200px] w-full border-b border-black ${bgColor} flex items-center justify-center relative overflow-hidden`}>
          <BookOpen size={48} className="text-black/20" />
          
          <div className="absolute top-4 right-4 bg-white border border-black rounded-full px-3 py-1 text-xs font-bold shadow-[2px_2px_0px_0px_#111]">
            {isMyLearning ? `${course.progress || 0}% Done` : course.price > 0 ? `₹${course.price}` : 'Free'}
          </div>

          <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            {course.status || 'published'}
          </div>
        </div>

        <div className="p-6 flex flex-col flex-1 relative">
          <div className="mb-4"><Badge colorClass={tagColor}>{course.category || 'General'}</Badge></div>
          <h3 className="text-2xl font-bold leading-tight mb-2 pr-4 line-clamp-2">{course.title}</h3>
          <p className="text-gray-600 font-medium text-sm mb-4">By {course.educator_name}</p>

          <div className="mt-auto flex justify-between items-end">
            <span className="font-bold text-lg underline decoration-2 underline-offset-4 group-hover:text-[#F26B4D] transition-colors">
              {isMyLearning ? 'Continue' : 'View Details'}
            </span>
            <button className="w-12 h-12 rounded-full bg-[#F26B4D] border-2 border-black flex items-center justify-center z-20 transition-transform group-hover:scale-110 shadow-[2px_2px_0px_0px_#111]">
              <Play fill="black" size={20} className="ml-1 text-black" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}