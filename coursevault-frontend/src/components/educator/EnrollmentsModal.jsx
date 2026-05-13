import React, { useState, useEffect } from 'react';
import { X, Users, Mail } from 'lucide-react';
import { fetchAPI } from '../../services/api';

export default function EnrollmentsModal({ isOpen, onClose, courseId, courseTitle }) {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !courseId) return;
    
    setIsLoading(true);
    fetchAPI(`/enrollments/course/${courseId}`)
      .then(data => {
        setStudents(data.enrollments || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load students", err);
        setIsLoading(false);
      });
  }, [isOpen, courseId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white border-[3px] border-black rounded-2xl flex flex-col shadow-[8px_8px_0px_0px_#111] max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b-[3px] border-black bg-[#A7E2D1] rounded-t-xl">
          <h3 className="font-bold text-2xl flex items-center gap-2">
            <Users /> Enrolled Students
          </h3>
          <button onClick={onClose} className="w-8 h-8 border-[3px] border-black bg-[#F26B4D] rounded-full flex items-center justify-center font-bold hover:scale-110">
            <X size={16} strokeWidth={3} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-[#F4DFD8] rounded-b-xl flex-1">
          <div className="mb-6">
             <h4 className="font-bold text-lg mb-1">{courseTitle}</h4>
             <p className="text-gray-600 font-bold">{students.length} Total Student(s)</p>
          </div>

          {isLoading ? (
            <div className="text-center py-10 font-bold text-gray-500">Loading student list...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-10 font-bold text-gray-500 bg-white border-2 border-black rounded-xl border-dashed">
              No students enrolled in this course yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student, idx) => (
                <div key={idx} className="bg-white border-2 border-black rounded-xl p-4 flex items-center justify-between shadow-[2px_2px_0px_0px_#111]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#F9E076] border-2 border-black rounded-full flex items-center justify-center font-bold">
                       {student.user_name?.charAt(0).toUpperCase() || 'S'}
                    </div>
                    <div>
                      <div className="font-bold text-lg leading-tight">{student.user_name || 'Student'}</div>
                      <div className="text-sm font-medium text-gray-500 flex items-center gap-1 mt-1">
                         <Mail size={12}/> {student.user_email || 'No email'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-bold">
                    <div className="text-xs text-gray-500 uppercase">Enrolled</div>
                    <div>{new Date(student.enrolled_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}