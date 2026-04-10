/**
 * 批量上传本地菜品图片到 Supabase Storage，并更新 recipes 表
 *
 * 使用方法:
 *   npx tsx scripts/upload-local-images.ts
 *   npx tsx scripts/upload-local-images.ts --dry-run
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMAGE_DIR = "D:\\menumind\\Download";
const BUCKET_NAME = "recipe-images";
const DRY_RUN = process.argv.includes("--dry-run");

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    console.log(`📦 创建 Storage Bucket: ${BUCKET_NAME}`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (error) {
      console.error("❌ 创建 Bucket 失败:", error.message);
      process.exit(1);
    }
    console.log("✅ Bucket 创建成功\n");
  } else {
    console.log(`📦 Bucket "${BUCKET_NAME}" 已存在\n`);
  }
}

async function run() {
  console.log("═══════════════════════════════════════");
  console.log("  📸 批量上传菜品图片到 Supabase Storage");
  console.log("═══════════════════════════════════════\n");

  if (DRY_RUN) console.log("🔍 [预览模式]\n");

  // 1. 读取本地图片
  const files = fs.readdirSync(IMAGE_DIR).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
  );
  console.log(`📁 找到 ${files.length} 张图片\n`);

  // 2. 获取数据库菜谱
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, image");
  if (error || !recipes) {
    console.error("❌ 查询菜谱失败:", error?.message);
    return;
  }
  console.log(`📋 数据库共 ${recipes.length} 道菜谱\n`);

  // 3. 确保 Bucket 存在
  if (!DRY_RUN) await ensureBucket();

  let uploadCount = 0;
  let matchCount = 0;
  const unmatchedFiles: string[] = [];

  for (const file of files) {
    const ext = path.extname(file);
    const dishName = path.basename(file, ext).trim();
    const filePath = path.join(IMAGE_DIR, file);

    // 匹配菜谱
    const matched = recipes.filter(
      (r) => r.name === dishName || r.name.includes(dishName) || dishName.includes(r.name)
    );

    if (matched.length === 0) {
      console.log(`⚠️  "${dishName}" → 未匹配`);
      unmatchedFiles.push(file);
      continue;
    }

    console.log(`📤 "${dishName}" → 匹配 ${matched.length} 道: ${matched.map((r) => r.name).join(", ")}`);

    if (DRY_RUN) {
      matchCount += matched.length;
      continue;
    }

    // 用第一个匹配的菜谱 ID 作为文件名（ASCII 安全）
    const storageFileName = `${matched[0].id}${ext}`;
    const storagePath = `dishes/${storageFileName}`;
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = MIME_MAP[ext.toLowerCase()] || "image/png";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`  ❌ 上传失败: ${uploadError.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    console.log(`  ✅ 已上传 → ${publicUrl}`);
    uploadCount++;

    // 更新所有匹配菜谱
    for (const recipe of matched) {
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ image: publicUrl })
        .eq("id", recipe.id);

      if (updateError) {
        console.error(`  ❌ 更新 "${recipe.name}" 失败: ${updateError.message}`);
      } else {
        console.log(`  📝 已更新: ${recipe.name}`);
        matchCount++;
      }
    }
    console.log("");
  }

  // 汇总
  console.log("═══════════════════════════════════════");
  console.log("  📊 结果汇总");
  console.log("═══════════════════════════════════════");
  if (DRY_RUN) {
    console.log(`  📸 图片: ${files.length} 张 | 可匹配: ${matchCount} 道`);
  } else {
    console.log(`  📤 上传: ${uploadCount} 张 | 更新: ${matchCount} 道`);
  }
  if (unmatchedFiles.length > 0) {
    console.log(`  ⚠️  未匹配: ${unmatchedFiles.join(", ")}`);
  }

  const { count: noImg } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .or("image.is.null,image.eq.");
  const { count: total } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true });
  console.log(`\n  📸 有图片: ${total! - (noImg || 0)}/${total} 道菜谱`);
}

run();
