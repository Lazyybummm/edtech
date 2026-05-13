import React, { useState, useEffect, useRef } from 'react';
import { X, Loader } from 'lucide-react';
import { fetchAPI } from '../../services/api.js';

export default function MediaViewerModal({ content, courseId, isEnrolled, onClose }) {
  const [loading, setLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState(null);
  const [savedPosition, setSavedPosition] = useState(0);
  const videoRef = useRef(null);

  // 1. Fetch Media Stream & Previous Progress
  useEffect(() => {
    if (!content) return;

    const initMedia = async () => {
      setLoading(true);
      try {
        if (content.content_type === 'video') {
          const streamData = await fetchAPI(`/content/${content.id}/stream`);
          
          if (streamData.hlsUrl) {
            const token = localStorage.getItem('token');
            setStreamUrl(`http://localhost:3000${streamData.hlsUrl}&token=${token}`);
          }

          // Fetch the user's last watched position
          if (courseId && isEnrolled) {
            try {
              console.log("[MediaViewer] Fetching saved progress...");
              const progressData = await fetchAPI(`/video/progress/${content.id}`);
              
              if (progressData.hasProgress) {
                console.log(`[MediaViewer] Found saved position: ${progressData.position}s`);
                setSavedPosition(parseFloat(progressData.position));
              } else {
                console.log("[MediaViewer] No previous progress found. Starting from 0s.");
              }
            } catch (err) {
              console.warn("Could not fetch video progress", err);
            }
          } else {
              // NEW: Explicitly tell you why it isn't tracking!
              console.log(`[MediaViewer] ⚠️ Skipping progress track. isEnrolled: ${isEnrolled}`);
          }
        }
      } catch (err) {
        console.error("Failed to load media info", err);
      } finally {
        setLoading(false);
      }
    };

    initMedia();
  }, [content, courseId, isEnrolled]);

  // Helper function to explicitly save progress
  const saveProgressToDB = async (trigger = "Interval") => {
    if (!content || !courseId || !isEnrolled || !videoRef.current) return;
    
    const currentPos = Math.round(videoRef.current.currentTime);
    if (currentPos <= 0) return;

    console.log(`[MediaViewer] (${trigger}) Saving position: ${currentPos}s...`);
    
    try {
      await fetchAPI('/video/progress', {
        method: 'POST',
        body: JSON.stringify({
          contentId: content.id,
          courseId: courseId,
          position: currentPos
        })
      });
      console.log(`[MediaViewer] (${trigger}) Save successful! ✅`);
    } catch (err) {
      console.error(`[MediaViewer] (${trigger}) Save failed ❌:`, err.message);
    }
  };

  // 2. Background Polling
  useEffect(() => {
    if (!content || content.content_type !== 'video' || !courseId || !isEnrolled) return;

    // Save every 5 seconds
    const intervalId = setInterval(() => {
       if (videoRef.current && !videoRef.current.paused) {
           saveProgressToDB("Interval");
       }
    }, 5000);
    
    // Save when the modal is closed ('X' is clicked)
    return () => {
      clearInterval(intervalId);
      saveProgressToDB("Modal Close");
    };
  }, [content, courseId, isEnrolled]);

  // 3. Jump to saved position when video loads
  const handleLoadedMetadata = () => {
    if (videoRef.current && savedPosition > 0) {
      console.log(`[MediaViewer] Jumping video to ${savedPosition}s`);
      videoRef.current.currentTime = savedPosition;
    }
  };

  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#FDF1E9]/90 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl bg-white border-[3px] border-black rounded-[24px] shadow-[8px_8px_0px_0px_#111] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-[3px] border-black bg-[#A7E2D1]">
          <h3 className="font-black text-xl tracking-tight uppercase line-clamp-1">{content.title}</h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 border-[3px] border-black bg-[#F26B4D] rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#111]"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#F4F4F4] relative overflow-hidden flex items-center justify-center min-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center font-bold text-gray-500 gap-3">
              <Loader className="animate-spin text-[#F26B4D]" size={40} strokeWidth={3} />
              Loading Media...
            </div>
          ) : content.content_type === 'video' ? (
            <video 
              ref={videoRef}
              controls 
              autoPlay
              className="w-full h-full max-h-[75vh] object-contain bg-black"
              onLoadedMetadata={handleLoadedMetadata}
              onPause={() => saveProgressToDB("Video Paused")} // Immediately saves when paused
            >
              <source src={streamUrl} type="application/vnd.apple.mpegurl" />
              <source src={streamUrl} type="video/mp4" />
              Your browser does not support HTML video playback.
            </video>
          ) : (
            <iframe 
              src={`http://localhost:3000/api/content/${content.id}/pdf?token=${localStorage.getItem('token')}`} 
              className="w-full h-full min-h-[75vh]"
              title={content.title}
            />
          )}
        </div>
      </div>
    </div>
  );
}