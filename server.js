import express from "express";
import multer from "multer";
import crypto from "crypto";
import cors from "cors";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getSignedUrlFromSdk } from "@aws-sdk/s3-request-presigner";
import mammoth from "mammoth";
import Razorpay from "razorpay";
import pg from "pg";
import "dotenv/config";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_VIDEO_DIR = path.join(__dirname, "temp_videos");

if (!fs.existsSync(TEMP_VIDEO_DIR)) {
    fs.mkdirSync(TEMP_VIDEO_DIR, { recursive: true });
}

// ============================================
// Database Connection
// ============================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://grid:strongpassword@187.127.139.208:5432/edtech",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// ============================================
// R2 Configuration
// ============================================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";


if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ACCOUNT_ID) {
    console.error("❌ Missing R2 credentials in .env file");
    process.exit(1);
}

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    maxAttempts: 3,
});

// ============================================
// Razorpay Configuration
// ============================================
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_Sk6w4yGg7PI7Ol",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "er6IT32WoapaOyzSy3HMlGrO"
});

console.log(`✅ R2 configured: bucket=${R2_BUCKET_NAME}`);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }
});


// ============================================
// AUTH MIDDLEWARE
// ============================================
// ============================================
// ENHANCED AUTH MIDDLEWARE (Auth + Context)
// ============================================
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

// ROUTE 1: REGISTER
// POST /api/auth/register
// Body: { name, email, password, role? }
// ============================================
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password, role = "student" } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "name, email and password are required" });
        }
        if (!["student", "educator"].includes(role)) {
            return res.status(400).json({ error: "role must be student or educator" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        // Check if email already exists
        const existing = await pool.query(
            `SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, role, created_at
        `, [name, email.toLowerCase(), passwordHash, role]);

        const user = result.rows[0];

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ROUTE 2: LOGIN
// POST /api/auth/login
// Body: { email, password }
// ============================================
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }

        const result = await pool.query(
            `SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ROUTE 3: GET CURRENT USER
// GET /api/auth/me
// Header: Authorization: Bearer <token>
// ============================================
app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error("Me error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ROUTE 4: LOGOUT
// POST /api/auth/logout
// Header: Authorization: Bearer <token>
// ============================================
app.post("/api/auth/logout", authMiddleware, (req, res) => {
    // JWT is stateless — logout is handled client-side by deleting the token.
    // If you want server-side invalidation later, maintain a token blacklist in Redis.
    res.json({ success: true, message: "Logged out successfully" });
});

// ============================================
// Helper Functions
// ============================================

function generateFileHash(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function getFileExtension(filename) {
    const parts = filename.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
}

function getMimeType(filename) {
    const ext = getFileExtension(filename).toLowerCase();
    const map = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
        ".txt": "text/plain",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".html": "text/html", ".css": "text/css",
        ".js": "application/javascript", ".json": "application/json",
        ".csv": "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
    };
    return map[ext] || "application/octet-stream";
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function convertDocxToHtml(buf) {
    try {
        const result = await mammoth.convertToHtml({ buffer: buf });
        return { success: true, html: result.value };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function generateSignedUrl(r2Key, expiresIn = 3600) {
    if (!r2Key) return null;
    const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key });
    return await getSignedUrlFromSdk(r2Client, command, { expiresIn });
}

// ============================================
// Database Schema Setup
// ============================================
async function setupDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            INSERT INTO users (id, email, password_hash, name, role)
            VALUES ('11111111-1111-1111-1111-111111111111', 'educator@example.com', 'hashed_password', 'Default Educator', 'educator')
            ON CONFLICT (id) DO NOTHING
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                educator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                thumbnail_url TEXT,
                price DECIMAL(10,2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                deleted_at TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS content_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(512) NOT NULL,
                description TEXT,
                content_type VARCHAR(50) NOT NULL,
                file_hash VARCHAR(64) UNIQUE,
                file_name VARCHAR(512),
                file_size_bytes BIGINT,
                mime_type VARCHAR(127),
                r2_key VARCHAR(1024),
                duration_seconds INT,
                thumbnail_url TEXT,
                status VARCHAR(50) DEFAULT 'processing',
                metadata JSONB DEFAULT '{}',
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_published BOOLEAN DEFAULT TRUE,
                preview BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                deleted_at TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS modules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                module_order INT DEFAULT 0,
                content_ids UUID[] DEFAULT '{}',
                is_published BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 is_active BOOLEAN DEFAULT TRUE,
                deleted_at TIMESTAMP
            )
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_content_items_hash ON content_items(file_hash)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_courses_educator_id ON courses(educator_id)`);

        console.log("✅ Database schema ready");
    } catch (err) {
        console.error("❌ Database setup error:", err);
    }
}

setupDatabase();

// ============================================
// COURSE ROUTES
// ============================================

app.get("/api/courses", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, u.name as educator_name
            FROM courses c
            JOIN users u ON c.educator_id = u.id
            WHERE c.is_active = true AND c.deleted_at IS NULL
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, courses: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// GET MY COURSES (Works for both students and educators)
// ============================================
app.get("/api/my-courses", authMiddleware, async (req, res) => {
  try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      let courses = [];
      
      if (userRole === 'student') {
          // STUDENT: Get courses they are enrolled in
          const result = await pool.query(`
              SELECT 
                  c.*, 
                  u.name as educator_name,
                  e.enrolled_at,
                  e.progress,
                  e.last_accessed,
                  e.status as enrollment_status
              FROM enrollments e
              JOIN courses c ON e.course_id = c.id
              JOIN users u ON c.educator_id = u.id
              WHERE e.user_id = $1 
                  AND e.status = 'active'
                  AND c.status = 'published'
                  AND c.deleted_at IS NULL
              ORDER BY e.enrolled_at DESC
          `, [userId]);
          
          courses = result.rows;
          
      } else if (userRole === 'educator') {
          // EDUCATOR: Get courses they created
          const result = await pool.query(`
              SELECT 
                  c.*, 
                  u.name as educator_name,
                  COUNT(DISTINCT e.user_id) as total_students,
                  COUNT(DISTINCT m.id) as total_modules,
                  COUNT(DISTINCT ci.id) as total_contents
              FROM courses c
              JOIN users u ON c.educator_id = u.id
              LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
              LEFT JOIN modules m ON c.id = m.course_id
              LEFT JOIN content_items ci ON ci.id = ANY(m.content_ids)
              WHERE c.educator_id = $1
                  AND c.deleted_at IS NULL
              GROUP BY c.id, u.name
              ORDER BY c.created_at DESC
          `, [userId]);
          
          courses = result.rows;
          
      } else if (userRole === 'admin') {
          // ADMIN: Get all courses (optional)
          const result = await pool.query(`
              SELECT 
                  c.*, 
                  u.name as educator_name,
                  COUNT(DISTINCT e.user_id) as total_students
              FROM courses c
              JOIN users u ON c.educator_id = u.id
              LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
              WHERE c.deleted_at IS NULL
              GROUP BY c.id, u.name
              ORDER BY c.created_at DESC
          `);
          
          courses = result.rows;
      }
      
      res.json({ 
          success: true, 
          role: userRole,
          count: courses.length,
          courses 
      });
      
  } catch (err) {
      console.error("My courses error:", err);
      res.status(500).json({ error: err.message });
  }
});




//this can be hit by anyone 
app.get("/api/courses/:id", async (req, res) => {
  try {
      const { id } = req.params;
      
      // Get course details
      const courseResult = await pool.query(`
          SELECT c.*, u.name as educator_name
          FROM courses c
          JOIN users u ON c.educator_id = u.id
          WHERE c.id = $1 AND c.status = 'published' AND c.is_active = true
      `, [id]);
      
      if (courseResult.rows.length === 0) {
          return res.status(404).json({ error: "Course not found" });
      }
      
      const course = courseResult.rows[0];
      
      // Get ALL modules and ALL content (including locked)
      // Frontend will decide what to show based on enrollment status
      const modulesResult = await pool.query(`
          SELECT * FROM modules 
          WHERE course_id = $1 
          ORDER BY module_order ASC
      `, [id]);
      
      const modules = [];
      for (const module of modulesResult.rows) {
          let contents = [];
          if (module.content_ids && module.content_ids.length > 0) {
              const contentResult = await pool.query(`
                  SELECT id, title, description, content_type, duration_seconds, 
                         thumbnail_url, preview, created_at
                  FROM content_items 
                  WHERE id = ANY($1::uuid[])
                  AND status = 'ready'
              `, [module.content_ids]);
              contents = contentResult.rows;
          }
          modules.push({ ...module, contents });
      }
      
      // Optional: Check enrollment status for UI (if user is logged in)
      let isEnrolled = false;
      let isCreator = false;
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
              const token = authHeader.split(" ")[1];
              const decoded = jwt.verify(token, JWT_SECRET);
              
              const enrollmentCheck = await pool.query(
                  `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`,
                  [decoded.id, id]
              );
              isEnrolled = enrollmentCheck.rows.length > 0;
              isCreator = course.educator_id === decoded.id;
          } catch (err) {
              // Invalid token, just treat as not enrolled
          }
      }
      
      res.json({ 
          success: true, 
          course: {
              ...course,
              isEnrolled,  // For frontend UI decisions
              isCreator    // For frontend UI decisions
          },
          modules 
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});
app.post("/api/courses", authMiddleware, async (req, res) => {
  try {
      // Check if user is educator or admin
      if (req.user.role !== 'educator' && req.user.role !== 'admin') {
          return res.status(403).json({ error: "Only educators can create courses" });
      }

      const { title, description, price, status } = req.body;
      
      // Start a transaction
      const client = await pool.connect();
      
      try {
          await client.query('BEGIN');
          
          // Insert the course with is_active = true
          const courseResult = await client.query(`
              INSERT INTO courses (educator_id, title, description, price, status, is_active)
              VALUES ($1, $2, $3, $4, $5, true) RETURNING *
          `, [req.user.id, title, description, price || 0, status || "draft"]);
          
          const course = courseResult.rows[0];
          
          // Create a default "Preview Module" automatically
          const moduleResult = await client.query(`
              INSERT INTO modules (course_id, title, description, module_order, content_ids, is_active)
              VALUES ($1, $2, $3, $4, $5, true) RETURNING *
          `, [course.id, "Preview Module", "Course preview content - get a glimpse of what you'll learn", 0, []]);
          
          await client.query('COMMIT');
          
          res.status(201).json({ 
              success: true, 
              course: course,
              previewModule: moduleResult.rows[0],
              message: "Course created with preview module"
          });
          
      } catch (err) {
          await client.query('ROLLBACK');
          throw err;
      } finally {
          client.release();
      }
      
  } catch (err) {
      console.error("Course creation error:", err);
      res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/courses/:id", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      // ✅ Use middleware flag - no DB query needed!
      if (!req.isCourseCreator) {
          return res.status(403).json({ error: "Only course creator can update courses" });
      }
      
      const { title, description, price, status } = req.body;
      
      const result = await pool.query(`
          UPDATE courses
          SET title = COALESCE($1, title),
              description = COALESCE($2, description),
              price = COALESCE($3, price),
              status = COALESCE($4, status),
              updated_at = NOW()
          WHERE id = $5
          RETURNING *
      `, [title, description, price, status, id]);
      
      res.json({ success: true, course: result.rows[0] });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Soft delete course (deactivate)
// Soft delete course (deactivate) - Works with both URL param and query param
app.delete("/api/courses/:id", authMiddleware, async (req, res) => {
  try {
      // Get courseId from either query param or URL param
      const courseId = req.query.courseId || req.params.id;
      
      if (!courseId) {
          return res.status(400).json({ error: "courseId is required" });
      }
      
      // Check if user is course creator - manually check since middleware might not have set it
      const courseCheck = await pool.query(
          `SELECT educator_id FROM courses WHERE id = $1 AND is_active = true`,
          [courseId]
      );
      
      if (courseCheck.rows.length === 0) {
          return res.status(404).json({ error: "Course not found or already deleted" });
      }
      
      if (courseCheck.rows[0].educator_id !== req.user.id) {
          return res.status(403).json({ error: "Only course creator can delete courses" });
      }
      
      // Soft delete
      await pool.query(`
          UPDATE courses 
          SET is_active = false, 
              status = 'deleted',
              updated_at = NOW()
          WHERE id = $1 AND is_active = true
      `, [courseId]);
      
      res.json({ success: true, message: "Course deactivated successfully" });
  } catch (err) {
      console.error("Delete course error:", err);
      res.status(500).json({ error: err.message });
  }
});
// Reactivate course (optional)
app.post("/api/courses/:id/reactivate", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      if (!req.isCourseCreator) {
          return res.status(403).json({ error: "Only course creator can reactivate" });
      }
      
      const result = await pool.query(`
          UPDATE courses 
          SET is_active = true, 
              status = 'draft',
              updated_at = NOW()
          WHERE id = $1 AND is_active = false
          RETURNING id
      `, [id]);
      
      if (result.rows.length === 0) {
          return res.status(404).json({ error: "Course not found or already active" });
      }
      
      res.json({ success: true, message: "Course reactivated successfully" });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


// ============================================
// MODULE ROUTES
// ============================================
app.post("/api/modules", authMiddleware, async (req, res) => {
  try {
      const { course_id, title, description } = req.body;
      
      // Check if user is course creator AND course is active
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

app.get("/api/modules/:id", async (req, res) => {
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

app.get("/api/courses/:courseId/modules", async (req, res) => {
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

app.put("/api/modules/:id", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      const { title, description, module_order } = req.body;
      
      // ✅ Use middleware flag - no DB query needed!
      if (!req.isCourseCreator) {
          return res.status(403).json({ error: "Only course creator can update modules" });
      }
      
      // Dynamic update
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
// Soft delete module
app.delete("/api/modules/:id", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      // Check if user is course creator
      if (!req.isCourseCreator) {
          return res.status(403).json({ error: "Only course creator can delete modules" });
      }
      
      // Soft delete - set is_active to false
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

// Reactivate module
app.post("/api/modules/:id/reactivate", authMiddleware, async (req, res) => {
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

app.post("/api/modules/:moduleId/content", authMiddleware, async (req, res) => {
  try {
      const { moduleId } = req.params;
      const { content_id } = req.body;
      
      // ✅ Use middleware flag - no DB query needed for auth!
      if (!req.isCourseCreator) {
          return res.status(403).json({ error: "Only course creator can add content to modules" });
      }
      
      // Check if module exists and is active
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


app.delete("/api/modules/:moduleId/content/:contentId", async (req, res) => {//deactivation
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

// ============================================
// CONTENT ROUTES (PDF & Other Files)
// ============================================
// Update PDF upload to accept preview flag
app.post("/api/content/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
      const { title, description, content_type, preview } = req.body;
      const file = req.file;
      
      // Check if user is educator
      if (req.user.role !== 'educator' && req.user.role !== 'admin') {
          return res.status(403).json({ error: "Only educators can upload content" });
      }
      
      if (!file) return res.status(400).json({ error: "No file uploaded" });
      if (!title || !content_type) return res.status(400).json({ error: "title and content_type are required" });

      const fileHash = generateFileHash(file.buffer);
      const extension = getFileExtension(file.originalname);
      const mimeType = getMimeType(file.originalname);

      const existing = await pool.query(`SELECT * FROM content_items WHERE file_hash = $1`, [fileHash]);
      if (existing.rows.length > 0) {
          return res.status(200).json({ success: true, message: "File already exists.", content: existing.rows[0], isDuplicate: true });
      }

      const hashPrefix = fileHash.slice(0, 6);
      const r2Key = `content/${hashPrefix}/${fileHash}${extension}`;
      await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, Body: file.buffer, ContentType: mimeType }));

      // ADDED: preview flag support
      const result = await pool.query(`
          INSERT INTO content_items (title, description, content_type, file_hash, file_name, file_size_bytes, mime_type, r2_key, status, preview, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready', $9, $10) RETURNING *
      `, [title, description, content_type, fileHash, file.originalname, file.size, mimeType, r2Key, preview === 'true' || preview === true, req.user.id]);

      res.status(201).json({ success: true, content: result.rows[0] });
  } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ success: false, error: err.message });
  }
});

// Update video upload to accept preview flag
app.post("/api/content/upload-video", authMiddleware, upload.single("file"), async (req, res) => {
  try {
      const { title, description, preview } = req.body;
      const file = req.file;

      // Check if user is educator
      if (req.user.role !== 'educator' && req.user.role !== 'admin') {
          return res.status(403).json({ error: "Only educators can upload videos" });
      }

      if (!file) return res.status(400).json({ error: "No file uploaded" });
      if (!title) return res.status(400).json({ error: "Title is required" });
      if (!file.mimetype.startsWith("video/")) return res.status(400).json({ error: "Only video files are allowed" });

      console.log(`\n${"=".repeat(70)}\n📤 VIDEO UPLOAD STARTED\n${"=".repeat(70)}`);
      console.log(`📹 ${file.originalname} — ${(file.size / (1024 * 1024)).toFixed(2)} MB`);

      const fileHash = generateFileHash(file.buffer);
      const extension = getFileExtension(file.originalname);

      const existing = await pool.query(`SELECT * FROM content_items WHERE file_hash = $1`, [fileHash]);
      if (existing.rows.length > 0) {
          console.log(`📎 Duplicate video detected`);
          return res.status(200).json({ success: true, message: "Video already exists.", content: existing.rows[0], isDuplicate: true });
      }

      const tempFilePath = path.join(TEMP_VIDEO_DIR, `${fileHash}${extension}`);
      fs.writeFileSync(tempFilePath, file.buffer);
      console.log(`💾 Saved temp: ${path.basename(tempFilePath)}`);

      // Probe video metadata
      let videoInfo = { width: 0, height: 0, duration: 0 };
      await new Promise((resolve) => {
          const ffprobe = spawn("ffprobe", [
              "-v", "error",
              "-select_streams", "v:0",
              "-show_entries", "stream=width,height",
              "-show_entries", "format=duration",
              "-of", "json",
              tempFilePath
          ]);
          let output = "";
          ffprobe.stdout.on("data", d => { output += d.toString(); });
          ffprobe.on("close", () => {
              try {
                  const data = JSON.parse(output);
                  if (data.streams?.[0]) {
                      videoInfo.width  = data.streams[0].width  || 0;
                      videoInfo.height = data.streams[0].height || 0;
                  }
                  if (data.format?.duration) {
                      videoInfo.duration = Math.round(parseFloat(data.format.duration));
                  }
              } catch (e) { /* ignore */ }
              resolve();
          });
      });
      console.log(`📐 ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`);

      // Choose resolutions
      const resolutions = [{ name: "480p", scale: "854:480", bitrate: "1000k" }];
      if (videoInfo.height >= 720)  resolutions.push({ name: "720p",  scale: "1280:720",  bitrate: "2500k" });
      if (videoInfo.height >= 1080) resolutions.push({ name: "1080p", scale: "1920:1080", bitrate: "4500k" });
      console.log(`🎬 Resolutions: ${resolutions.map(r => r.name).join(", ")}`);

      // ADDED: preview flag support
      const result = await pool.query(`
          INSERT INTO content_items (
              title, description, content_type,
              file_hash, file_name, file_size_bytes, mime_type,
              duration_seconds, status, preview, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
      `, [
          title,
          description || "",
          "video",
          fileHash,
          file.originalname,
          file.size,
          file.mimetype,
          videoInfo.duration,
          "processing",
          preview === 'true' || preview === true,
          req.user.id
      ]);

      const contentId = result.rows[0].id;
      console.log(`📝 DB entry created: ${contentId}`);

      // Start transcoding async
      transcodeVideo(contentId, tempFilePath, fileHash, title, resolutions, videoInfo.duration);

      res.status(202).json({
          success: true,
          message: "Video uploaded. Processing in background.",
          content: { id: contentId, title, content_type: "video", status: "processing", preview: preview === 'true' || preview === true }
      });
  } catch (err) {
      console.error("❌ Video upload error:", err);
      res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/content", async (req, res) => {
  try {
      const result = await pool.query(`SELECT * FROM content_items WHERE is_active = true ORDER BY created_at DESC`);
      res.json({ success: true, contents: result.rows });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});
app.get("/api/content/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const result = await pool.query(`SELECT * FROM content_items WHERE id = $1 AND is_active = true`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Content not found" });
      res.json({ success: true, content: result.rows[0] });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.get("/api/content/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT status, metadata FROM content_items WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Content not found" });
        res.json({ status: result.rows[0].status, metadata: result.rows[0].metadata });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/api/content/:id/pdf", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      // ✅ ADD THIS ACCESS CHECK
      if (!req.isContentCreator && !req.isEnrolled && !req.isPreviewContent) {
          return res.status(403).json({ 
              error: "Access denied. You are not enrolled in this course.",
              requiresEnrollment: true,
              courseId: req.courseId
          });
      }
      
      const result = await pool.query(`SELECT * FROM content_items WHERE id = $1`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Content not found" });
      const content = result.rows[0];
      if (content.content_type !== "pdf") return res.status(400).json({ error: "Not a PDF file" });

      const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: content.r2_key });
      const r2Response = await r2Client.send(command);
      const chunks = [];
      for await (const chunk of r2Response.Body) chunks.push(chunk);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("X-Frame-Options", "DENY");
      res.send(Buffer.concat(chunks));
  } catch (err) {
      console.error("PDF fetch error:", err);
      res.status(500).json({ error: err.message });
  }
});

app.put("/api/content/:id", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      const { title, description, preview } = req.body;
      
      // Check if user is course creator (through module association)
      const contentCheck = await pool.query(`
          SELECT ci.*, c.educator_id 
          FROM content_items ci
          JOIN modules m ON ci.id = ANY(m.content_ids)
          JOIN courses c ON m.course_id = c.id
          WHERE ci.id = $1
          LIMIT 1
      `, [id]);
      
      if (contentCheck.rows.length === 0) {
          return res.status(404).json({ error: "Content not found" });
      }
      
      if (contentCheck.rows[0].educator_id !== req.user.id) {
          return res.status(403).json({ error: "Only course creator can update content" });
      }
      
      // Dynamic update
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
      if (preview !== undefined) {
          updateFields.push(`preview = $${paramCounter++}`);
          values.push(preview);
      }
      
      if (updateFields.length === 0) {
          return res.status(400).json({ error: "No fields to update" });
      }
      
      updateFields.push(`updated_at = NOW()`);
      values.push(id);
      
      const query = `
          UPDATE content_items 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCounter}
          RETURNING *
      `;
      
      const result = await pool.query(query, values);
      res.json({ success: true, content: result.rows[0] });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Soft delete content
app.delete("/api/content/:id", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      // Check if user is course creator (through module association)
      const contentCheck = await pool.query(`
          SELECT c.educator_id 
          FROM content_items ci
          JOIN modules m ON ci.id = ANY(m.content_ids)
          JOIN courses c ON m.course_id = c.id
          WHERE ci.id = $1
          LIMIT 1
      `, [id]);
      
      if (contentCheck.rows.length === 0) {
          return res.status(404).json({ error: "Content not found" });
      }
      
      if (contentCheck.rows[0].educator_id !== req.user.id) {
          return res.status(403).json({ error: "Only course creator can delete content" });
      }
      
      // Soft delete
      await pool.query(`
          UPDATE content_items 
          SET is_active = false, 
              updated_at = NOW()
          WHERE id = $1 AND is_active = true
      `, [id]);
      
      // Also remove from modules (optional - keeps module structure clean)
      await pool.query(`
          UPDATE modules 
          SET content_ids = array_remove(content_ids, $1)
          WHERE $1 = ANY(content_ids)
      `, [id]);
      
      res.json({ success: true, message: "Content deactivated successfully" });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Route 1: Create Razorpay Order
app.post("/api/payments/create-order", authMiddleware, async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.id;
  
  const client = await pool.connect();
  
  try {
      await client.query('BEGIN');
      
      // Check if already enrolled
      const existingEnrollment = await client.query(`
          SELECT status FROM enrollments 
          WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      `, [userId, courseId]);
      
      if (existingEnrollment.rows.length > 0) {
          return res.status(400).json({ error: "Already enrolled in this course" });
      }
      
      // Get course details
      const course = await client.query(`
          SELECT price, title FROM courses WHERE id = $1
      `, [courseId]);
      
      if (course.rows.length === 0) {
          return res.status(404).json({ error: "Course not found" });
      }
      
      const courseData = course.rows[0];
      
      // Check if there's a pending payment order
      const pendingOrder = await client.query(`
          SELECT order_id FROM payment_orders 
          WHERE user_id = $1 AND course_id = $2 AND status = 'created'
          ORDER BY created_at DESC LIMIT 1
      `, [userId, courseId]);
      
      let orderId;
      
      if (pendingOrder.rows.length > 0) {
          // Reuse existing pending order
          orderId = pendingOrder.rows[0].order_id;
      } else {
          // Create new Razorpay order
          const options = {
              amount: Math.round(courseData.price * 100),
              currency: "INR",
              receipt: `receipt_${Date.now()}_${userId.slice(0, 8)}`,
              notes: {
                  courseId: courseId,
                  userId: userId,
                  courseTitle: courseData.title
              }
          };
          
          const order = await razorpayInstance.orders.create(options);
          orderId = order.id;
          
          // Store in database
          await client.query(`
              INSERT INTO payment_orders (order_id, user_id, course_id, amount, status)
              VALUES ($1, $2, $3, $4, 'created')
          `, [orderId, userId, courseId, courseData.price]);
      }
      
      // Create or update pending enrollment
      await client.query(`
          INSERT INTO enrollments (user_id, course_id, payment_status, status)
          VALUES ($1, $2, 'pending', 'pending')
          ON CONFLICT (user_id, course_id) 
          DO UPDATE SET payment_status = 'pending', status = 'pending', updated_at = NOW()
      `, [userId, courseId]);
      
      await client.query('COMMIT');
      
      res.json({
          success: true,
          orderId: orderId,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_Sk6w4yGg7PI7Ol",
          amount: courseData.price,
          currency: "INR",
          courseTitle: courseData.title
      });
      
  } catch (error) {
      await client.query('ROLLBACK');
      console.error("Create order error:", error);
      res.status(500).json({ error: error.message });
  } finally {
      client.release();
  }
});

// Route 2: Verify Payment and Enroll User
app.post("/api/payments/verify", authMiddleware, async (req, res) => {
    const { orderId, paymentId, signature, courseId } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get order details
        const orderCheck = await client.query(`
            SELECT id, user_id, course_id, amount, status 
            FROM payment_orders 
            WHERE order_id = $1
        `, [orderId]);
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        
        const order = orderCheck.rows[0];
        
        // Verify user matches
        if (order.user_id !== userId) {
            return res.status(403).json({ error: "Unauthorized: Payment belongs to different user" });
        }
        
        // Check if already completed
        if (order.status === 'completed') {
            return res.json({ success: true, alreadyEnrolled: true, message: "Already enrolled" });
        }
        
        // Verify signature
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "er6IT32WoapaOyzSy3HMlGrO")
            .update(body.toString())
            .digest("hex");
        
        if (expectedSignature !== signature) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }
        
        // Double-check with Razorpay API
        const razorpayOrder = await razorpayInstance.orders.fetch(orderId);
        if (razorpayOrder.amount_paid !== razorpayOrder.amount) {
            return res.status(400).json({ error: "Full amount not paid" });
        }
        
        // Update payment order
        await client.query(`
            UPDATE payment_orders 
            SET status = 'completed', 
                razorpay_payment_id = $1,
                razorpay_signature = $2,
                updated_at = NOW()
            WHERE order_id = $3
        `, [paymentId, signature, orderId]);
        
        // Update enrollment to active
        await client.query(`
            UPDATE enrollments 
            SET status = 'active', 
                payment_status = 'completed',
                payment_id = $1,
                amount_paid = $2,
                enrolled_at = NOW(),
                updated_at = NOW()
            WHERE user_id = $3 AND course_id = $4
        `, [paymentId, order.amount, userId, courseId]);
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: "Payment verified and enrollment successful!"
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Payment verification error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Route 3: Check Enrollment Status
app.get("/api/enrollments/status/:courseId", authMiddleware, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;
  
  try {
      const result = await pool.query(`
          SELECT status, payment_status, payment_id, enrolled_at, amount_paid
          FROM enrollments 
          WHERE user_id = $1 AND course_id = $2
      `, [userId, courseId]);
      
      if (result.rows.length === 0) {
          return res.json({ status: 'not_enrolled', enrolled: false });
      }
      
      const enrollment = result.rows[0];
      res.json({
          status: enrollment.status,
          enrolled: enrollment.status === 'active',
          paymentStatus: enrollment.payment_status,
          paymentId: enrollment.payment_id,
          enrolledAt: enrollment.enrolled_at,
          amountPaid: enrollment.amount_paid
      });
      
  } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ error: error.message });
  }
});

// Route 4: Get Payment Order Status
app.get("/api/payments/order/:orderId/status", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.id;
  
  try {
      const result = await pool.query(`
          SELECT status, razorpay_payment_id, amount, created_at
          FROM payment_orders 
          WHERE order_id = $1 AND user_id = $2
      `, [orderId, userId]);
      
      if (result.rows.length === 0) {
          return res.status(404).json({ error: "Order not found" });
      }
      
      res.json({ success: true, order: result.rows[0] });
      
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// ============================================
// VIDEO ROUTES
// ============================================

const activeJobs = new Map();

// ============================================
// TRANSCODING FUNCTION - FIXED VERSION
// ============================================
// SAVE VIDEO PROGRESS
// POST /api/video/progress
// Body: { contentId, courseId, position }
// ============================================
app.post("/api/video/progress", authMiddleware, async (req, res) => {
  try {
      const { contentId, courseId, position } = req.body;
      const userId = req.user.id;
      
      // Validate input
      if (!contentId || !courseId) {
          return res.status(400).json({ error: "contentId and courseId are required" });
      }
      
      if (position === undefined || position < 0) {
          return res.status(400).json({ error: "valid position is required" });
      }
      
      // Check if user is enrolled in the course
      const enrollmentCheck = await pool.query(
          `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'`,
          [userId, courseId]
      );
      
      if (enrollmentCheck.rows.length === 0) {
          return res.status(403).json({ error: "Not enrolled in this course" });
      }
      
      // Upsert progress (insert or update)
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

// ============================================
// GET VIDEO PROGRESS
// GET /api/video/progress/:contentId
// ============================================
app.get("/api/video/progress/:contentId", authMiddleware, async (req, res) => {
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


// ============================================
async function transcodeVideo(contentId, inputPath, fileHash, title, resolutions, duration) {
    console.log(`\n${"=".repeat(70)}\n🎬 TRANSCODING — ${contentId}\n${"=".repeat(70)}`);

    const outputDir = path.join(TEMP_VIDEO_DIR, `hls_${contentId}`);
    const hashPrefix = fileHash.slice(0, 6);
    const r2BasePath = `content/videos/${hashPrefix}/${fileHash}`;

    activeJobs.set(contentId, { title, startTime: Date.now(), resolutions: resolutions.map(r => r.name), status: "processing" });

    try {
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // ── TRANSCODE EACH RESOLUTION ──────────────────────────────────────────
        for (const { name: resName, scale, bitrate } of resolutions) {
            const qualityDir = path.join(outputDir, resName);
            if (!fs.existsSync(qualityDir)) fs.mkdirSync(qualityDir, { recursive: true });

            const segmentPattern = path.join(qualityDir, "segment_%03d.ts");
            const playlistPath = path.join(qualityDir, "index.m3u8");

            console.log(`\n🎬 Transcoding ${resName}...`);

            // Run ffmpeg synchronously
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn("ffmpeg", [
                    "-i", inputPath,
                    "-vf", `scale=${scale}`,
                    "-c:v", "libx264", "-preset", "medium",
                    "-b:v", bitrate, "-maxrate", bitrate,
                    "-bufsize", `${parseInt(bitrate) * 2}k`,
                    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
                    "-f", "hls",
                    "-hls_time", "10",
                    "-hls_list_size", "0",
                    "-hls_segment_type", "mpegts",
                    "-hls_segment_filename", segmentPattern,
                    playlistPath
                ]);

                ffmpeg.stderr.on("data", (data) => {
                    const str = data.toString();
                    const match = str.match(/frame=\s*(\d+)/);
                    if (match && parseInt(match[1]) % 500 === 0) {
                        console.log(`  🎬 ${resName}: frame ${match[1]}`);
                    }
                });

                ffmpeg.on("close", (code) => {
                    if (code === 0) {
                        console.log(`✅ ${resName} ffmpeg done`);
                        resolve();
                    } else {
                        reject(new Error(`ffmpeg exited ${code} for ${resName}`));
                    }
                });
                ffmpeg.on("error", reject);
            });

            // Upload all .ts segments
            const allFiles = fs.readdirSync(qualityDir).sort();
            const segments = allFiles.filter(f => f.endsWith(".ts"));

            for (const seg of segments) {
                const filePath = path.join(qualityDir, seg);
                await r2Client.send(new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `${r2BasePath}/${resName}/${seg}`,
                    Body: fs.readFileSync(filePath),
                    ContentType: "video/mp2t"
                }));
                console.log(`  ✓ ${resName}/${seg}`);
                fs.unlinkSync(filePath);
            }

            // Upload the playlist
            if (fs.existsSync(playlistPath)) {
                await r2Client.send(new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `${r2BasePath}/${resName}/index.m3u8`,
                    Body: fs.readFileSync(playlistPath),
                    ContentType: "application/vnd.apple.mpegurl"
                }));
                console.log(`  ✓ ${resName}/index.m3u8`);
            }
        }

        // ── BUILD & UPLOAD MASTER MANIFEST ────────────────────────────────────
        let masterManifest = "#EXTM3U\n#EXT-X-VERSION:3\n";
        for (const res of resolutions) {
            const bandwidth = res.name === "1080p" ? "5000000" : res.name === "720p" ? "2800000" : "1200000";
            const resAttr = res.scale.replace(":", "x");
            masterManifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resAttr}\n`;
            masterManifest += `${res.name}/index.m3u8\n`;
        }

        const masterR2Key = `${r2BasePath}/master.m3u8`;
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: masterR2Key,
            Body: Buffer.from(masterManifest, "utf-8"),
            ContentType: "application/vnd.apple.mpegurl"
        }));
        console.log(`✅ Master manifest uploaded to: ${masterR2Key}`);

        // ── UPDATE DATABASE - FIXED VERSION ────────────────────────────────────
        const resolutionNames = resolutions.map(r => r.name);
        
        // Use a simple JSON object instead of jsonb_build_object with casting issues
        const metadataObj = {
            resolutions: resolutionNames,
            r2_base_path: r2BasePath,
            completed_at: new Date().toISOString()
        };

        await pool.query(`
            UPDATE content_items
            SET 
                status = 'ready',
                r2_key = $1,
                duration_seconds = $2,
                metadata = $3,
                updated_at = NOW()
            WHERE id = $4::uuid
        `, [masterR2Key, duration, metadataObj, contentId]);

        const elapsed = ((Date.now() - activeJobs.get(contentId).startTime) / 1000).toFixed(1);
        console.log(`\n✅ TRANSCODING COMPLETE in ${elapsed} seconds`);
        activeJobs.delete(contentId);

        // Cleanup
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
            console.log("🧹 Temp files cleaned up");
        } catch (e) {
            console.warn("Cleanup warning:", e.message);
        }

    } catch (err) {
        console.error(`❌ Transcoding failed:`, err.message);
        activeJobs.delete(contentId);

        // Update status to failed
        await pool.query(`
            UPDATE content_items
            SET 
                status = 'failed',
                metadata = $1,
                updated_at = NOW()
            WHERE id = $2::uuid
        `, [{
            error: err.message,
            failed_at: new Date().toISOString()
        }, contentId]);

        // Cleanup on failure
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            const od = path.join(TEMP_VIDEO_DIR, `hls_${contentId}`);
            if (fs.existsSync(od)) fs.rmSync(od, { recursive: true, force: true });
        } catch (e) {
            console.warn("Cleanup warning:", e.message);
        }
    }
}

// ============================================
// STREAM ENDPOINT — returns proxy URL (never direct R2 URL)
// ============================================
// ============================================
// STREAM ENDPOINT — WITH ACCESS CONTROL
// ============================================
app.get("/api/content/:id/stream", authMiddleware, async (req, res) => {
  try {
      const { id } = req.params;
      
      // ✅ ADD THIS ACCESS CHECK
      // Only allow if: creator OR enrolled OR preview content
      if (!req.isContentCreator && !req.isEnrolled && !req.isPreviewContent) {
          return res.status(403).json({ 
              error: "Access denied. You are not enrolled in this course.",
              requiresEnrollment: true,
              courseId: req.courseId
          });
      }
      
      const result = await pool.query(`SELECT * FROM content_items WHERE id = $1`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Content not found" });

      const content = result.rows[0];
      if (content.content_type !== "video") return res.status(400).json({ error: "Not a video" });

      if (content.status !== "ready") {
          return res.status(202).json({
              status: content.status,
              message: content.status === "processing" ? "Video is still processing" : "Video processing failed"
          });
      }
      if (!content.r2_key) return res.status(404).json({ error: "Video manifest not found" });

      res.json({
          success: true,
          hlsUrl: `/api/hls/serve?videoId=${id}&path=master.m3u8`,
          duration: content.duration_seconds,
          accessType: req.isContentCreator ? 'creator' : (req.isPreviewContent ? 'preview' : 'enrolled')
      });
  } catch (err) {
      console.error("Stream endpoint error:", err);
      res.status(500).json({ error: err.message });
  }
});

// ============================================
// HLS PROXY
// ============================================
app.get("/api/hls/serve", async (req, res) => {
    try {
        const { videoId, path: hlsPathRaw } = req.query;
        if (!videoId || !hlsPathRaw) return res.status(400).send("Missing videoId or path");

        const hlsPath = hlsPathRaw;

        if (hlsPath.includes("..")) return res.status(400).send("Invalid path");

        const result = await pool.query(
            `SELECT r2_key, status FROM content_items WHERE id = $1`,
            [videoId]
        );
        if (result.rows.length === 0) return res.status(404).send("Content not found");

        const content = result.rows[0];
        if (content.status !== "ready") return res.status(202).send("Video still processing");
        if (!content.r2_key) return res.status(404).send("Manifest not found");

        const r2Base = content.r2_key.replace(/\/master\.m3u8$/, "");
        const r2Key = hlsPath === "master.m3u8" ? content.r2_key : `${r2Base}/${hlsPath}`;

        console.log(`HLS: ${videoId} → ${r2Key}`);

        let r2Response;
        try {
            r2Response = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
        } catch (err) {
            if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
                console.error(`R2 not found: ${r2Key}`);
                return res.status(404).send(`Not found: ${hlsPath}`);
            }
            throw err;
        }

        const isM3u8 = hlsPath.endsWith(".m3u8");
        const isTs = hlsPath.endsWith(".ts");

        res.setHeader("Content-Type",
            isM3u8 ? "application/vnd.apple.mpegurl"
                : isTs ? "video/mp2t"
                    : "application/octet-stream"
        );
        res.setHeader("Cache-Control", "no-cache, no-store, private");
        res.setHeader("Access-Control-Allow-Origin", "*");

        if (isTs) {
            r2Response.Body.pipe(res);
            return;
        }

        const chunks = [];
        for await (const chunk of r2Response.Body) chunks.push(chunk);
        let manifest = Buffer.concat(chunks).toString("utf-8");

        const currentDir = hlsPath.includes("/")
            ? hlsPath.substring(0, hlsPath.lastIndexOf("/") + 1)
            : "";

        const rewritten = manifest.split("\n").map(line => {
            const t = line.trim();
            if (!t || t.startsWith("#")) return line;
            if (t.startsWith("/api/") || t.startsWith("http")) return line;

            const fullPath = currentDir + t;
            return `/api/hls/serve?videoId=${videoId}&path=${encodeURIComponent(fullPath)}`;
        });

        res.send(rewritten.join("\n"));

    } catch (err) {
        console.error("HLS proxy error:", err);
        res.status(500).send("Proxy error: " + err.message);
    }
});

// ============================================
// MONITORING + HEALTH
// ============================================

app.get("/api/transcode/active", (req, res) => {
    const jobs = Array.from(activeJobs.entries()).map(([id, job]) => ({
        contentId: id, title: job.title, status: job.status,
        resolutions: job.resolutions,
        elapsedSeconds: Math.floor((Date.now() - job.startTime) / 1000)
    }));
    res.json({ success: true, activeJobs: jobs, count: jobs.length });
});

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "ok", database: "connected", r2: "configured" });
    } catch (err) {
        res.status(500).json({ status: "error", database: "disconnected", error: err.message });
    }
});

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📁 Temp:   ${TEMP_VIDEO_DIR}`);
    console.log(`☁️  R2:     ${R2_BUCKET_NAME}`);
    console.log(`${"=".repeat(70)}\n`);
});