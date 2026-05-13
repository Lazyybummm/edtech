import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Plus, Edit, Trash2, Users } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import CourseAccordion from '../components/course/CourseAccordion.jsx';
import MediaViewerModal from '../components/course/MediaViewerModal.jsx';
import CourseModal from '../components/educator/CourseModal.jsx';
import ModuleModal from '../components/educator/ModuleModal.jsx';
import ContentModal from '../components/educator/ContentModal.jsx';
import EnrollmentsModal from '../components/educator/EnrollmentsModal.jsx';
import { fetchAPI } from '../services/api.js';
import { getBgColor } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

// Utility to load Razorpay script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false); // NEW: Explicit enrollment state
  const [expandedModules, setExpandedModules] = useState([]);
  const [activeContent, setActiveContent] = useState(null);

  // Educator States
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [isEnrollmentsModalOpen, setIsEnrollmentsModalOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [contentModalTab, setContentModalTab] = useState('pdf');

  const loadCourseData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Course Data
      const data = await fetchAPI(`/courses/${id}`);
      setCourse(data.course);
      setModules(data.modules || []);
      if (data.modules?.length > 0 && expandedModules.length === 0) {
          setExpandedModules([data.modules[0].id]);
      }

      // 2. Fetch Enrollment Status
      if (user?.role !== 'educator') {
          try {
              const enrollData = await fetchAPI(`/enrollments/${id}`);
              if (enrollData.success) {
                  setIsEnrolled(true);
              }
          } catch (err) {
              // 404 means not enrolled
              setIsEnrolled(false);
          }
      } else {
          // Educators automatically get enrolled access to their own courses
          setIsEnrolled(true);
      }
    } catch (err) {
        console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadCourseData(); }, [id]);

  if (isLoading) return <div className="text-center font-bold py-20 text-gray-400">Loading...</div>;
  if (!course) return <div className="text-center font-bold py-20 text-red-500">Course not found.</div>;

  const isCreator = user?.role === 'educator' && (course.isCreator || user?.id === course.educator_id);

  // --- RAZORPAY ENROLLMENT LOGIC ---
  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
        const orderData = await fetchAPI('/payments/create-order', { 
            method: 'POST', 
            body: JSON.stringify({ courseId: course.id }) 
        });

        if (orderData.isFree) {
            alert("Success! You have been enrolled in this free course.");
            setIsEnrolled(true);
            loadCourseData(); 
            setIsEnrolling(false);
            return;
        }

        const res = await loadRazorpayScript();
        if (!res) throw new Error("Razorpay SDK failed to load. Are you online?");

        const options = {
            key: orderData.keyId,
            amount: Math.round(orderData.amount * 100),
            currency: orderData.currency,
            name: "CourseVault.",
            description: `Enrollment: ${orderData.courseTitle}`,
            order_id: orderData.orderId,
            handler: async function (response) {
                try {
                    const verifyRes = await fetchAPI('/payments/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            courseId: course.id
                        })
                    });

                    if (verifyRes.success) {
                        alert("Enrollment Successful! Welcome to the course.");
                        setIsEnrolled(true);
                        loadCourseData();
                    }
                } catch (verifyErr) {
                    alert(verifyErr.message || "Payment verification failed");
                }
            },
            prefill: {
                name: user?.name || "Student",
                email: user?.email || "student@coursevault.com",
            },
            theme: { color: "#F26B4D" }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();

    } catch(err) {
        alert(err.message || "Enrollment initialization failed");
    } finally {
        setIsEnrolling(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!window.confirm('⚠️ Are you sure? This will delete all modules and content.')) return;
    try {
        await fetchAPI(`/courses/${course.id}`, { method: 'DELETE' });
        navigate(user?.role === 'educator' ? '/dashboard' : '/explore');
    } catch (err) {
        alert(err.message || 'Delete failed');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('⚠️ Delete this module?')) return;
    try {
        await fetchAPI(`/modules/${moduleId}`, { method: 'DELETE' });
        loadCourseData();
    } catch (err) {
        alert(err.message || 'Delete failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <button onClick={() => navigate(-1)} className="mb-8 font-bold text-xs uppercase tracking-widest hover:text-[#F26B4D]">← Back</button>

      <div className="relative mb-12">
        <div className="absolute inset-0 bg-[#111] rounded-[24px] translate-x-3 translate-y-3 z-0"></div>
        <div className={`relative z-10 ${getBgColor(course.id)} border-2 border-black rounded-[24px] p-8 md:p-12 shadow-[4px_4px_0px_0px_#111]`}>
          <div className="flex justify-between items-start mb-6">
             <Badge colorClass="bg-white">{course.category || 'General'}</Badge>
             {isCreator && <Badge colorClass="bg-[#F9E076]">Creator View</Badge>}
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4">{course.title}</h1>
          <p className="text-lg font-bold text-black/70 mb-8 max-w-2xl">{course.description}</p>
          
          <div className="flex flex-wrap gap-3">
            {isCreator ? (
               <>
                 <Button variant="secondary" onClick={() => setIsCourseModalOpen(true)} className="px-6 rounded-xl border-[3px]">Edit</Button>
                 <Button variant="accent" onClick={() => {setEditingModule(null); setIsModuleModalOpen(true);}} className="px-6 rounded-xl border-[3px]">Add Module</Button>
                 <Button variant="primary" onClick={() => setIsEnrollmentsModalOpen(true)} className="px-6 rounded-xl border-[3px] bg-[#87CEFA]">Students</Button>
                 <button onClick={handleDeleteCourse} className="px-6 py-4 border-[3px] border-black rounded-xl font-bold bg-white text-red-500 hover:bg-red-50 shadow-[4px_4px_0px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#111]">
                   <Trash2 size={18} />
                 </button>
               </>
            ) : (
              <Button 
                variant="secondary" 
                onClick={isEnrolled ? () => {} : handleEnroll} 
                disabled={isEnrolling}
                className="px-10 rounded-[40px] border-[3px]"
              >
                {isEnrolling ? 'Processing...' : isEnrolled ? 'Continue Learning' : `Enroll - ₹${course.price}`}
              </Button>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black mb-8">Curriculum</h2>
      <div className="flex flex-col gap-6">
        {modules.map((module) => (
          <CourseAccordion 
            key={module.id} 
            module={module}
            isOpen={expandedModules.includes(module.id)}
            onToggle={() => setExpandedModules(prev => prev.includes(module.id) ? prev.filter(m => m !== module.id) : [...prev, module.id])}
            onContentClick={setActiveContent}
            isCreator={isCreator}
            onAddContent={(mId) => { setActiveModuleId(mId); setContentModalTab('video'); setIsContentModalOpen(true); }}
            onAddPDF={(mId) => { setActiveModuleId(mId); setContentModalTab('pdf'); setIsContentModalOpen(true); }}
            onEditModule={(mod) => { setEditingModule(mod); setIsModuleModalOpen(true); }}
            onDeleteModule={handleDeleteModule}
          />
        ))}
      </div>

      {/* --- PASSING EXPLICIT isEnrolled STATE --- */}
      <MediaViewerModal 
        content={activeContent} 
        courseId={course.id} 
        isEnrolled={isEnrolled}
        onClose={() => setActiveContent(null)} 
      />
      
      {/* Educator Modals */}
      <CourseModal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} course={course} onSave={loadCourseData} />
      <ModuleModal isOpen={isModuleModalOpen} onClose={() => setIsModuleModalOpen(false)} courseId={course.id} module={editingModule} onSave={loadCourseData} />
      <ContentModal isOpen={isContentModalOpen} onClose={() => setIsContentModalOpen(false)} moduleId={activeModuleId} onSave={loadCourseData} initialTab={contentModalTab} />
      <EnrollmentsModal isOpen={isEnrollmentsModalOpen} onClose={() => setIsEnrollmentsModalOpen(false)} courseId={course.id} courseTitle={course.title} />
    </div>
  );
}