// clear-r2.js
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
});

async function clearR2Bucket() {
    console.log(`\n🗑️ Starting to clear bucket: ${R2_BUCKET_NAME}`);
    console.log(`⚠️ This will delete ALL files in the bucket!\n`);
    
    let continuationToken = undefined;
    let totalDeleted = 0;
    
    do {
        // List objects
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
        });
        
        const listedObjects = await r2Client.send(listCommand);
        
        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            console.log(`✅ Bucket is already empty!`);
            break;
        }
        
        // Delete objects in batches
        const deletePromises = listedObjects.Contents.map(async (obj) => {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: obj.Key,
            });
            await r2Client.send(deleteCommand);
            console.log(`  🗑️ Deleted: ${obj.Key}`);
            totalDeleted++;
        });
        
        await Promise.all(deletePromises);
        
        continuationToken = listedObjects.NextContinuationToken;
        
    } while (continuationToken);
    
    console.log(`\n✅ Done! Deleted ${totalDeleted} files from bucket: ${R2_BUCKET_NAME}`);
}

clearR2Bucket().catch(console.error);