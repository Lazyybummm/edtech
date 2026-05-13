import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Microscope } from 'lucide-react';
import CourseCard from '../components/course/CourseCard';
import { fetchAPI } from '../services/api';

export default function ExplorePage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/courses')
      .then(data => {
        setCourses(data.courses || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load courses", err);
        setIsLoading(false);
      });
  }, []);

  return (
    <>
      <header className="relative pt-10 pb-20 text-center flex flex-col items-center justify-center">
        <div className="absolute top-0 left-10 text-black animate-float-icon"><Bot size={40} strokeWidth={1.5} /></div>
        <div className="absolute top-10 right-20 text-black animate-float-icon" style={{ animationDelay: '1s' }}><Microscope size={40} strokeWidth={1.5} /></div>
        
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight relative z-10 max-w-4xl">
          Educational content <br /> for curious minds.
        </h1>
      </header>

      <div className="pb-20">
        <h2 className="text-4xl font-bold tracking-tight mb-8">All Courses</h2>
        
        {isLoading ? (
          <div className="text-center text-gray-500 font-bold py-10">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="text-center text-gray-500 font-bold py-10">No courses published yet.</div>
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
      </div>
    </>
  );
}