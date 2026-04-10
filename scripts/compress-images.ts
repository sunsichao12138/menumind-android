/**
 * 压缩 Supabase Storage 中的菜品图片
 * 
 * 从 Storage 下载 → sharp 压缩为 WebP (800px宽, 质量80) → 重新上传 → 更新数据库 URL
 *
 * 使用: npx tsx scripts/compress-images.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "recipe-images";
const TARGET_WIDTH = 800;    // 目标宽度 px
const WEBP_QUALITY = 80;     // WebP 质量 (1-100)

async function run() {
  console.log("═══════════════════════════════════════");
  console.log("  🗜️  压缩菜品图片 (PNG → WebP)");
  console.log("═══════════════════════════════════════\n");

  // 1. 列出 Storage 中所有图片
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list("dishes", { limit: 200 });

  if (listError || !files) {
    console.error("❌ 列出文件失败:", listError?.message);
    return;
  }

  const imageFiles = files.filter(
    (f) => !f.name.startsWith(".") && f.name.length > 0
  );
  console.log(`📁 找到 ${imageFiles.length} 个文件\n`);

  let successCount = 0;
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const oldPath = `dishes/${file.name}`;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const newPath = `dishes/${baseName}.webp`;
    const originalSize = file.metadata?.size || 0;

    process.stdout.write(
      `[${i + 1}/${imageFiles.length}] ${file.name} (${(originalSize / 1024 / 1024).toFixed(1)}MB) → `
    );

    try {
      // 下载原图
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(oldPath);

      if (downloadError || !downloadData) {
        console.log(`❌ 下载失败: ${downloadError?.message}`);
        continue;
      }

      const buffer = Buffer.from(await downloadData.arrayBuffer());

      // 用 sharp 压缩为 WebP
      const compressed = await sharp(buffer)
        .resize(TARGET_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const compressedSize = compressed.length;
      const ratio = ((1 - compressedSize / buffer.length) * 100).toFixed(0);

      // 上传压缩后的 WebP
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(newPath, compressed, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.log(`❌ 上传失败: ${uploadError.message}`);
        continue;
      }

      // 获取新的公开 URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(newPath);

      // 更新数据库中引用旧 URL 的菜谱
      const oldUrl = supabase.storage.from(BUCKET).getPublicUrl(oldPath).data.publicUrl;
      const { data: matchedRecipes } = await supabase
        .from("recipes")
        .select("id, name")
        .eq("image", oldUrl);

      if (matchedRecipes && matchedRecipes.length > 0) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update({ image: urlData.publicUrl })
          .eq("image", oldUrl);

        if (updateError) {
          console.log(`⚠️  压缩成功但更新数据库失败`);
        }
      }

      // 如果新旧文件不同名，删除旧文件
      if (oldPath !== newPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }

      console.log(
        `${(compressedSize / 1024).toFixed(0)}KB (-${ratio}%) ✅`
      );

      totalOriginal += buffer.length;
      totalCompressed += compressedSize;
      successCount++;
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }
  }

  // 汇总
  console.log("\n═══════════════════════════════════════");
  console.log("  📊 压缩结果");
  console.log("═══════════════════════════════════════");
  console.log(`  ✅ 成功: ${successCount}/${imageFiles.length}`);
  console.log(
    `  📦 原始总大小: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB`
  );
  console.log(
    `  🗜️  压缩后总大小: ${(totalCompressed / 1024 / 1024).toFixed(1)}MB`
  );
  console.log(
    `  📉 节省: ${((1 - totalCompressed / totalOriginal) * 100).toFixed(0)}%`
  );
}

run();
