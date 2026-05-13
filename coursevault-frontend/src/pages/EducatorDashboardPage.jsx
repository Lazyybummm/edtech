import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, GraduationCap } from 'lucide-react';
import CourseCard from '../components/course/CourseCard.jsx';
import Button from '../components/ui/Button.jsx';
import CourseModal from '../components/educator/CourseModal.jsx';
import { fetchAPI } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function EducatorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  const loadMyCourses = () => {
    setIsLoading(true);
    fetchAPI('/courses')
      .then(data => {
        // Show courses created by this user
        const myCourses = (data.courses || []).filter(c => c.educator_id === user?.id || c.isCreator);
        setCourses(myCourses);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Dashboard error", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadMyCourses();
  }, []);

  const publishedCount = courses.filter(c => c.status === 'published').length;

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
                <h1 className="text-4xl font-bold tracking-tight mb-1 flex items-center gap-3">
                    <GraduationCap size={40} className="text-[#F26B4D]" /> Educator Console
                </h1>
                <p className="text-gray-600 font-bold">Manage your curriculum and track student engagement.</p>
            </div>
            <Button variant="accent" onClick={() => setIsCourseModalOpen(true)} className="py-3 px-8 text-base border-[3px]">
                <Plus size={20} className="mr-2 inline" /> Create New Course
            </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#87CEFA] border-[3px] border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_#111]">
                <div className="text-5xl font-black mb-1">{courses.length}</div>
                <div className="font-bold text-black uppercase text-sm tracking-widest">Total Courses</div>
            </div>
            <div className="bg-[#F9E076] border-[3px] border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_#111]">
                <div className="text-5xl font-black mb-1">{publishedCount}</div>
                <div className="font-bold text-black uppercase text-sm tracking-widest">Live Courses</div>
            </div>
        </div>
        
        <h2 className="text-3xl font-bold mb-8 tracking-tight">Your Courses</h2>

        {isLoading ? (
          <div className="text-center font-bold text-gray-400 py-20">Loading Dashboard...</div>
        ) : courses.length === 0 ? (
          <div className="bg-white border-[3px] border-black border-dashed rounded-3xl p-16 text-center">
              <p className="text-gray-500 font-bold text-xl mb-6">No courses found in your library.</p>
              <Button variant="primary" onClick={() => setIsCourseModalOpen(true)}>Get Started</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-16 items-start">
            {courses.map((course, index) => (
              <CourseCard 
                key={course.id} 
                course={course} 
                index={index} 
                isMyLearning={false}
                onClick={(id) => navigate(`/course/${id}`)}
              />
            ))}
          </div>
        )}

        <CourseModal 
            isOpen={isCourseModalOpen} 
            onClose={() => setIsCourseModalOpen(false)} 
            onSave={loadMyCourses} 
        />
    </div>
  );
}