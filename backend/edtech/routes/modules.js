import express from "express";
import pool from "../config/database.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// POST /api/modules
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { course_id, title, description } = req.body;
        
        const courseCheck = await pool.query(
            `SELECT educator_id FROM courses WHERE id = $1 AND is_active = true`,
            [course_id]
        );
        
        if (courseCheck.rows.length === 0) {
            return res.status(404).json({ error: "Course not found or inactive" });
        }
        
        if (courseCheck.rows[0].educator_id !== req.user.id) {
            return res.status(403).json({ error: "Only course creator can add modules" });
        }
        
        const orderResult = await pool.query(`
            SELECT COALESCE(MAX(module_order), -1) + 1 as next_order 
            FROM modules WHERE course_id = $1
        `, [course_id]);
        const nextOrder = orderResult.rows[0]?.next_order || 0;
        
        const result = await pool.query(`
            INSERT INTO modules (course_id, title, description, module_order, content_ids, is_active)
            VALUES ($1, $2, $3, $4, $5, true) RETURNING *
        `, [course_id, title, description, nextOrder, []]);
        
        res.status(201).json({ success: true, module: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/modules/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM modules WHERE id = $1 AND is_active = true`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Module not found" });
        }
        res.json({ success: true, module: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/courses/:courseId/modules
router.get("/courses/:courseId/modules", async (req, res) => {
    try {
        const { courseId } = req.params;
        const result = await pool.query(`
            SELECT * FROM modules 
            WHERE course_id = $1 AND is_active = true
            ORDER BY module_order ASC
        `, [courseId]);
        res.json({ success: true, modules: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/modules/:id
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, module_order } = req.body;
        
        if (!req.isCourseCreator) {
            return res.status(403).json({ error: "Only course creator can update modules" });
        }
        
        const updateFields = [];
        const values = [];
        let paramCounter = 1;
        
        if (title !== undefined) {
            updateFields.push(`title = $${paramCounter++}`);
            values.push(title === "" ? null : title);
        }
        if (description !== undefined) {
            updateFields.push(`description = $${paramCounter++}`);
            values.push(description === "" ? null : description);
        }
        if (module_order !== undefined) {
            updateFields.push(`module_order = $${paramCounter++}`);
            values.push(module_order);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        
        updateFields.push(`updated_at = NOW()`);
        values.push(id);
        
        const query = `
            UPDATE modules 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        res.json({ success: true, module: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/modules/:id
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.isCourseCreator) {
            return res.status(403).json({ error: "Only course creator can delete modules" });
        }
        
        const result = await pool.query(`
            UPDATE modules 
            SET is_active = false, 
                updated_at = NOW()
            WHERE id = $1 AND is_active = true
            RETURNING id
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Module not found or already deleted" });
        }
        
        res.json({ success: true, message: "Module deactivated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/modules/:id/reactivate
router.post("/:id/reactivate", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.isCourseCreator) {
            return res.status(403).json({ error: "Only course creator can reactivate" });
        }
        
        const result = await pool.query(`
            UPDATE modules 
            SET is_active = true, 
                updated_at = NOW()
            WHERE id = $1 AND is_active = false
            RETURNING id
        `, [id]);
        
        res.json({ success: true, message: "Module reactivated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/modules/:moduleId/content
router.post("/:moduleId/content", authMiddleware, async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { content_id } = req.body;
        
        if (!req.isCourseCreator) {
            return res.status(403).json({ error: "Only course creator can add content to modules" });
        }
        
        const moduleResult = await pool.query(
            `SELECT content_ids FROM modules WHERE id = $1 AND is_active = true`,
            [moduleId]
        );
        
        if (moduleResult.rows.length === 0) {
            return res.status(404).json({ error: "Module not found or inactive" });
        }
        
        let currentIds = moduleResult.rows[0]?.content_ids || [];
        if (!currentIds.includes(content_id)) {
            currentIds.push(content_id);
            await pool.query(`UPDATE modules SET content_ids = $1, updated_at = NOW() WHERE id = $2`, [currentIds, moduleId]);
        }
        
        res.json({ success: true, message: "Content added to module" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/modules/:moduleId/content/:contentId
router.delete("/:moduleId/content/:contentId", async (req, res) => {
    try {
        const { moduleId, contentId } = req.params;
        const moduleResult = await pool.query(`SELECT content_ids FROM modules WHERE id = $1`, [moduleId]);
        if (moduleResult.rows.length === 0) {
            return res.status(404).json({ error: "Module not found" });
        }
        const currentIds = moduleResult.rows[0]?.content_ids || [];
        const newIds = currentIds.filter(id => id !== contentId);
        await pool.query(`UPDATE modules SET content_ids = $1, updated_at = NOW() WHERE id = $2`, [newIds, moduleId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;