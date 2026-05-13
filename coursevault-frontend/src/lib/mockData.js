export const COURSES_DATA = [
  { id: 1, title: "Class 10 Math Masterclass", category: "Mathematics", tagColor: "bg-[#87CEFA]", imageBg: "bg-[#F4F4F4]", price: 499, educator: "CK Chander", progress: 0 },
  { id: 2, title: "HP Board Science Complete", category: "Science", tagColor: "bg-[#A7E2D1]", imageBg: "bg-[#A7E2D1]", price: 0, educator: "CK Chander", progress: 45 },
  { id: 3, title: "English Grammar Essentials", category: "Languages", tagColor: "bg-[#F9E076]", imageBg: "bg-[#7AA5E6]", price: 299, educator: "Admin", progress: 100 },
  { id: 4, title: "Class 12 Physics Deep Dive", category: "Physics", tagColor: "bg-[#87CEFA]", imageBg: "bg-[#E63946]", price: 999, educator: "CK Chander", progress: 0 },
  { id: 5, title: "History & Civics Crash Course", category: "Social Studies", tagColor: "bg-[#F9E076]", imageBg: "bg-[#A084E8]", price: 199, educator: "Admin", progress: 0 },
  { id: 6, title: "Board Exam Prep Strategy", category: "Strategy", tagColor: "bg-[#A7E2D1]", imageBg: "bg-[#8A2BE2]", price: 0, educator: "CK Chander", progress: 10 },
];

export const MODULES_DATA = [
  { id: 101, title: "Introduction & Basics", contents: [
    { id: 1, title: "Welcome to the Course", type: "video", duration: "05:30", preview: true },
    { id: 2, title: "Syllabus Overview", type: "pdf", size: "2.4 MB", preview: true }
  ]},
  { id: 102, title: "Core Concepts", contents: [
    { id: 3, title: "Understanding the Fundamentals", type: "video", duration: "45:20", preview: false },
    { id: 4, title: "Practice Problems Set 1", type: "pdf", size: "1.1 MB", preview: false }
  ]},
];