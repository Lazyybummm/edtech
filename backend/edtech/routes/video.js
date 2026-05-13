import express from "express";
import pool from "../config/database.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// POST /api/video/progress
router.post("/progress", authMiddleware, async (req, res) => {
    try {
        const { contentId, courseId, position } = req.body;
        const userId = req.user.id;
        
        if (!contentId || !courseId) {
            return res.status(400).json({ error: "contentId and courseId are required" });
        }
        
        if (position === undefined || position < 0) {
            return res.status(400).json({ error: "valid position is required" });
        }
        
        const enrollmentCheck = await pool.query(
            `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'`,
            [userId, courseId]
        );
        
        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ error: "Not enrolled in this course" });
        }
        
        await pool.query(`
            INSERT INTO video_progress (user_id, content_id, course_id, position, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id, content_id) 
            DO UPDATE SET 
                position = EXCLUDED.position,
                updated_at = NOW()
        `, [userId, contentId, courseId, position]);
        
        res.json({ success: true, message: "Progress saved" });
        
    } catch (err) {
        console.error("Save progress error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/video/progress/:contentId
router.get("/progress/:contentId", authMiddleware, async (req, res) => {
    try {
        const { contentId } = req.params;
        const userId = req.user.id;
        
        const result = await pool.query(`
            SELECT position, updated_at
            FROM video_progress
            WHERE user_id = $1 AND content_id = $2
        `, [userId, contentId]);
        
        if (result.rows.length === 0) {
            return res.json({ 
                hasProgress: false, 
                position: 0 
            });
        }
        
        res.json({
            hasProgress: true,
            position: result.rows[0].position,
            lastUpdated: result.rows[0].updated_at
        });
        
    } catch (err) {
        console.error("Get progress error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;