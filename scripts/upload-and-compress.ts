/**
 * 增量上传本地菜品图片到 Supabase Storage（只处理缺图片的菜谱）
 * 上传后自动压缩为 WebP 格式
 *
 * 使用: npx tsx scripts/upload-and-compress.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMAGE_DIR = "D:\\menumind\\Download";
const BUCKET = "recipe-images";
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const TARGET_WIDTH = 800;
const WEBP_QUALITY = 80;

const MIME_MAP: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif",
};

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true, fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (error) { console.error("❌ 创建 Bucket 失败:", error.message); process.exit(1); }
    console.log("✅ Bucket 创建成功\n");
  } else {
    console.log(`📦 Bucket "${BUCKET}" 已存在\n`);
  }
}

async function run() {
  console.log("═══════════════════════════════════════");
  console.log("  📸 增量上传+压缩菜品图片");
  console.log("═══════════════════════════════════════\n");

  // 1. 读取本地图片
  const files = fs.readdirSync(IMAGE_DIR).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
  );
  console.log(`📁 本地图片: ${files.length} 张\n`);

  // 2. 查询缺少图片的菜谱
  const { data: recipesNoImage, error } = await supabase
    .from("recipes")
    .select("id, name")
    .or("image.is.null,image.eq.");

  if (error || !recipesNoImage) {
    console.error("❌ 查询失败:", error?.message);
    return;
  }

  console.log(`🔍 数据库中缺图片的菜谱: ${recipesNoImage.length} 道\n`);

  if (recipesNoImage.length === 0) {
    console.log("✅ 所有菜谱都已有图片！");
    return;
  }

  await ensureBucket();

  let uploadCount = 0;
  let skipCount = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const file of files) {
    const ext = path.extname(file);
    const dishName = path.basename(file, ext).trim();
    const filePath = path.join(IMAGE_DIR, file);

    // 只匹配缺图片的菜谱
    const targets = recipesNoImage.filter(
      (r) => r.name === dishName || r.name.includes(dishName) || dishName.includes(r.name)
    );

    if (targets.length === 0) {
      skipCount++;
      continue; // 已有图片或不匹配，静默跳过
    }

    console.log(`📤 "${dishName}" → 匹配 ${targets.length} 道: ${targets.map((r) => r.name).join(", ")}`);

    try {
      // 读取并压缩为 WebP
      const fileBuffer = fs.readFileSync(filePath);
      const compressed = await sharp(fileBuffer)
        .resize(TARGET_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const originalKB = (fileBuffer.length / 1024).toFixed(0);
      const compressedKB = (compressed.length / 1024).toFixed(0);

      // 上传压缩后的 WebP
      const storagePath = `dishes/${targets[0].id}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, compressed, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.error(`  ❌ 上传失败: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      // 更新数据库
      for (const recipe of targets) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update({ image: publicUrl })
          .eq("id", recipe.id);

        if (updateError) {
          console.error(`  ❌ 更新 "${recipe.name}" 失败: ${updateError.message}`);
        } else {
          matched.push(recipe.name);
        }
      }

      console.log(`  ✅ ${originalKB}KB → ${compressedKB}KB | ${publicUrl}`);
      uploadCount++;
    } catch (err: any) {
      console.error(`  ❌ ${err.message}`);
    }
  }

  // 汇总
  console.log("\n═══════════════════════════════════════");
  console.log("  📊 结果汇总");
  console.log("═══════════════════════════════════════");
  console.log(`  📤 新上传+压缩: ${uploadCount} 张`);
  console.log(`  📝 更新菜谱: ${matched.length} 道`);
  console.log(`  ⏭️  跳过(已有图片): ${skipCount} 张`);

  // 还剩多少缺图片
  const { count: remaining } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .or("image.is.null,image.eq.");
  const { count: total } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true });
  console.log(`\n  📸 当前有图片: ${total! - (remaining || 0)}/${total} 道菜谱`);
  if (remaining && remaining > 0) {
    console.log(`  ⚠️  仍缺图片: ${remaining} 道`);
  }
}

run();
