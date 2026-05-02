import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

async function authMiddleware(req, res, next) {
  try {
      console.log('\n' + '='.repeat(70));
      console.log('🔐 AUTH MIDDLEWARE - REQUEST');
      console.log('='.repeat(70));
      console.log(`📍 Path: ${req.method} ${req.path}`);
      console.log(`📦 Query Params:`, req.query);
      
      // ========== AUTHENTICATION ==========
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
          console.log('❌ No token provided');
          return res.status(401).json({ error: "Authentication required" });
      }
      
      const token = authHeader.split(" ")[1];
      let decoded;
      try {
          decoded = jwt.verify(token, JWT_SECRET);
          console.log(`✅ Token verified for user: ${decoded.email}`);
      } catch (err) {
          console.log('❌ Invalid token:', err.message);
          return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Basic user info from token
      req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name
      };
      console.log(`👤 User: ${req.user.name} (${req.user.role}) - ID: ${req.user.id}`);
      
      // ========== STRUCTURED PARAMS FROM QUERY STRING ==========
      const { courseId, contentId, moduleId } = req.query;
      
      console.log(`\n📌 Structured Parameters received:`);
      console.log(`   - courseId: ${courseId || '❌ not provided'}`);
      console.log(`   - contentId: ${contentId || '❌ not provided'}`);
      console.log(`   - moduleId: ${moduleId || '❌ not provided'}`);
      
      // ========== CHECK COURSE CREATOR STATUS ==========
      if (courseId) {
          console.log(`\n🔍 Checking course creator status for courseId: ${courseId}`);
          const courseCheck = await pool.query(
              `SELECT educator_id, title FROM courses WHERE id = $1 AND is_active = true`,
              [courseId]
          );
          if (courseCheck.rows.length > 0) {
              req.isCourseCreator = (courseCheck.rows[0].educator_id === req.user.id);
              req.courseId = courseId;
              req.courseTitle = courseCheck.rows[0].title;
              console.log(`   - Course title: ${courseCheck.rows[0].title}`);
              console.log(`   - isCourseCreator: ${req.isCourseCreator ? '✅ YES' : '❌ NO'}`);
          } else {
              console.log(`   - ❌ Course not found or inactive`);
              req.isCourseCreator = false;
          }
      }
      
      // ========== CHECK MODULE OWNERSHIP ==========
      if (moduleId) {
          console.log(`\n🔍 Checking module ownership for moduleId: ${moduleId}`);
          const moduleCheck = await pool.query(`
              SELECT m.*, c.educator_id, c.title as course_title
              FROM modules m
              JOIN courses c ON m.course_id = c.id
              WHERE m.id = $1 AND m.is_active = true
          `, [moduleId]);
          
          if (moduleCheck.rows.length > 0) {
              req.courseId = moduleCheck.rows[0].course_id;
              req.moduleId = moduleId;
              req.moduleTitle = moduleCheck.rows[0].title;
              req.isCourseCreator = (moduleCheck.rows[0].educator_id === req.user.id);
              console.log(`   - Module title: ${moduleCheck.rows[0].title}`);
              console.log(`   - Associated course: ${moduleCheck.rows[0].course_title}`);
              console.log(`   - isCourseCreator: ${req.isCourseCreator ? '✅ YES' : '❌ NO'}`);
          } else {
              console.log(`   - ❌ Module not found or inactive`);
          }
      }
      
      // ========== CHECK CONTENT ACCESS ==========
      if (contentId) {
          console.log(`\n🎬 Checking content access for contentId: ${contentId}`);
          const contentCheck = await pool.query(`
              SELECT c.*, 
                     m.course_id,
                     (SELECT educator_id FROM courses WHERE id = m.course_id) as educator_id,
                     (SELECT title FROM courses WHERE id = m.course_id) as course_title
              FROM content_items c
              JOIN modules m ON c.id = ANY(m.content_ids)
              WHERE c.id = $1 AND c.is_active = true
              LIMIT 1
          `, [contentId]);
          
          if (contentCheck.rows.length > 0) {
              const content = contentCheck.rows[0];
              req.courseId = content.course_id;
              req.courseTitle = content.course_title;
              req.contentId = contentId;
              req.contentTitle = content.title;
              req.isContentCreator = (content.educator_id === req.user.id);
              req.isPreviewContent = content.preview === true;
              req.isCourseCreator = req.isContentCreator;
              
              console.log(`   - Content title: ${content.title}`);
              console.log(`   - Content type: ${content.content_type}`);
              console.log(`   - Preview flag: ${content.preview === true ? '✅ true' : '❌ false'}`);
              console.log(`   - Content status: ${content.status}`);
              console.log(`   - Associated course: ${content.course_title}`);
              console.log(`   - isContentCreator: ${req.isContentCreator ? '✅ YES' : '❌ NO'}`);
              console.log(`   - isPreviewContent: ${req.isPreviewContent ? '✅ YES' : '❌ NO'}`);
              
              // Check enrollment if NOT creator and NOT preview
              if (!req.isContentCreator && !req.isPreviewContent) {
                  console.log(`   - Checking enrollment (non-creator, non-preview)...`);
                  const enrollmentCheck = await pool.query(
                      `SELECT id FROM enrollments 
                       WHERE user_id = $1 AND course_id = $2 AND status = 'active'`,
                      [req.user.id, content.course_id]
                  );
                  req.isEnrolled = enrollmentCheck.rows.length > 0;
                  console.log(`   - isEnrolled: ${req.isEnrolled ? '✅ YES' : '❌ NO'}`);
              } else {
                  req.isEnrolled = false;
                  if (req.isContentCreator) console.log(`   - Skipping enrollment check (user is creator)`);
                  if (req.isPreviewContent) console.log(`   - Skipping enrollment check (content is preview)`);
              }
          } else {
              console.log(`   - ❌ Content not found or inactive`);
          }
      }
      
      // ========== FINAL FLAGS SUMMARY ==========
      console.log(`\n📋 FINAL FLAGS SET FOR THIS REQUEST:`);
      console.log(`   ┌─────────────────────────────────────────────────┐`);
      console.log(`   │ req.user.id:        ${req.user.id}`);
      console.log(`   │ req.user.role:      ${req.user.role}`);
      console.log(`   │ req.user.email:     ${req.user.email}`);
      console.log(`   │ req.user.name:      ${req.user.name}`);
      console.log(`   ├─────────────────────────────────────────────────┤`);
      console.log(`   │ req.courseId:       ${req.courseId || '❌ not set'}`);
      console.log(`   │ req.courseTitle:    ${req.courseTitle || '❌ not set'}`);
      console.log(`   │ req.isCourseCreator:${req.isCourseCreator === undefined ? '❌ not set' : (req.isCourseCreator ? '✅ YES' : '❌ NO')}`);
      console.log(`   ├─────────────────────────────────────────────────┤`);
      console.log(`   │ req.contentId:      ${req.contentId || '❌ not set'}`);
      console.log(`   │ req.contentTitle:   ${req.contentTitle || '❌ not set'}`);
      console.log(`   │ req.isContentCreator:${req.isContentCreator === undefined ? '❌ not set' : (req.isContentCreator ? '✅ YES' : '❌ NO')}`);
      console.log(`   │ req.isPreviewContent:${req.isPreviewContent === undefined ? '❌ not set' : (req.isPreviewContent ? '✅ YES' : '❌ NO')}`);
      console.log(`   │ req.isEnrolled:     ${req.isEnrolled === undefined ? '❌ not set' : (req.isEnrolled ? '✅ YES' : '❌ NO')}`);
      console.log(`   └─────────────────────────────────────────────────┘`);
      
      // ========== ACCESS DECISION ==========
      if (contentId) {
          console.log(`\n🔒 ACCESS DECISION:`);
          const hasAccess = req.isContentCreator || req.isEnrolled || req.isPreviewContent;
          if (hasAccess) {
              let accessReason = '';
              if (req.isContentCreator) accessReason = 'creator';
              else if (req.isPreviewContent) accessReason = 'preview content';
              else if (req.isEnrolled) accessReason = 'enrolled user';
              console.log(`   ✅ ACCESS GRANTED (${accessReason})`);
          } else {
              console.log(`   ❌ ACCESS DENIED (not creator, not enrolled, not preview)`);
          }
      }
      
      console.log(`\n${'='.repeat(70)}\n`);
      
      next();
  } catch (err) {
      console.error("\n❌ AUTH MIDDLEWARE ERROR:", err);
      console.error("Stack trace:", err.stack);
      console.log(`${'='.repeat(70)}\n`);
      res.status(500).json({ error: "Internal server error" });
  }
}

export default authMiddleware;