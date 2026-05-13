import crypto from "crypto";

export function generateFileHash(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

export function getFileExtension(filename) {
    const parts = filename.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
}

export function getMimeType(filename) {
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

export function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function convertDocxToHtml(buf) {
    try {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ buffer: buf });
        return { success: true, html: result.value };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function generateSignedUrl(r2Client, r2Key, expiresIn = 3600) {
    if (!r2Key) return null;
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl: getSignedUrlFromSdk } = await import("@aws-sdk/s3-request-presigner");
    const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: r2Key });
    return await getSignedUrlFromSdk(r2Client, command, { expiresIn });
}