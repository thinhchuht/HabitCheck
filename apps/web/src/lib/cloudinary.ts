import type { UploadIntentResponse } from "@/types/api";

/**
 * Upload a file directly to Cloudinary using the signed params from an upload
 * intent (contract §3). Returns the stored public_id.
 */
export async function uploadToCloudinary(
  file: File,
  intent: UploadIntentResponse,
  resourceType: "image" | "video",
): Promise<string> {
  const {
    cloudName,
    apiKey,
    uploadPreset,
    folder,
    publicId,
    timestamp,
    signature,
  } = intent.upload;

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("upload_preset", uploadPreset);
  form.append("api_key", apiKey);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const res = await fetch(url, { method: "POST", body: form });

  if (!res.ok) {
    // Cloudinary trả {"error":{"message":...,"http_code":...}} — lấy lý do cụ thể.
    let message = `Cloudinary upload thất bại (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = `Cloudinary: ${body.error.message}`;
    } catch {
      // body không phải JSON — giữ message mặc định
    }
    throw new Error(message);
  }

  const data = (await res.json()) as {
    public_id?: string;
    error?: { message?: string };
  };
  if (!data.public_id) {
    throw new Error(data.error?.message ?? "Cloudinary upload thất bại");
  }
  return data.public_id;
}
