import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { createHmac } from "node:crypto";

const app = express();
const PORT = 3001;
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

// ── Engine toggle ─────────────────────────────────────────────────────────────
// Options: "KLING" | "VEO"
const VIDEO_ENGINE = "KLING";

// ── Dev mode — skips real AI calls, uses local placeholder assets ─────────────
// Placeholders: public/placeholders/mock_remix.jpg  +  mock_video.mp4
const USE_DEV_MOCK = false;
const MOCK_STAGE_MS = [3000, 5000, 8000]; // per-stage: scene 3s, moment 5s, animate 8s

// ── Identity reference — loaded once at startup so it's in RAM on every request
let IDENTITY_IMAGE_B64 = null;
(async () => {
  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "images", "user.jpg"),
    );
    IDENTITY_IMAGE_B64 = buf.toString("base64");
    console.log(
      "[identity] user.jpg loaded — face consistency reference ready",
    );
  } catch {
    console.warn(
      "[identity] public/images/user.jpg not found — will use selfie only",
    );
  }
})();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));
// Serve /public as static so the mock video URL resolves via Express
app.use(express.static(path.join(process.cwd(), "public")));

// ── Shared helpers ────────────────────────────────────────────────────────────

function stripPrefix(dataUrl) {
  if (!dataUrl) return "";
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Upstream returned non-JSON response (status ${response.status})`,
    );
  }
}

// ── Asset persistence ─────────────────────────────────────────────────────────

/**
 * Saves the Gemini JPEG and the generated video to /public/generated/.
 * videoUrl may be a plain HTTPS URL (Kling) or a gs:// / files/ URI (Veo).
 * Returns { savedImagePath, savedVideoPath } as /generated/... web paths.
 */
async function persistGeneratedAssets({ apiKey, imageBase64, videoUrl }) {
  await mkdir(GENERATED_DIR, { recursive: true });

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const imageFile = `remix_${stamp}.jpg`;
  const videoFile = `remix_${stamp}.mp4`;
  const imagePath = path.join(GENERATED_DIR, imageFile);
  const videoPath = path.join(GENERATED_DIR, videoFile);

  await writeFile(imagePath, Buffer.from(stripPrefix(imageBase64), "base64"));

  const videoBuffer = await downloadVideoBuffer(apiKey, videoUrl);
  await writeFile(videoPath, videoBuffer);

  return {
    savedImagePath: `/generated/${imageFile}`,
    savedVideoPath: `/generated/${videoFile}`,
  };
}

function isGcsUri(uri) {
  return (
    typeof uri === "string" &&
    (uri.startsWith("gs://") || uri.startsWith("files/"))
  );
}

async function downloadVideoBuffer(apiKey, url) {
  const resolvedUrl = isGcsUri(url) ? toVeoDownloadUrl(url, apiKey) : url;
  // Send key both as query param (already in resolvedUrl) AND as header —
  // the Files API requires it at every stage of the handshake.
  const headers = apiKey ? { "x-goog-api-key": apiKey } : {};

  const res = await fetch(resolvedUrl, { headers, redirect: "follow" });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      console.warn(
        "Video download 403 — possible expired GCS URI or missing API key. " +
          `URL: ${resolvedUrl.slice(0, 120)} | Body: ${body.slice(0, 200)}`,
      );
    }
    throw new Error(
      `Video download failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Veo helpers ───────────────────────────────────────────────────────────────

// apiKey is appended as a query param — more reliable than x-goog-api-key header
// for GCS-backed Veo downloads (avoids cross-project 403 errors).
function toVeoDownloadUrl(uri, apiKey) {
  if (!uri) throw new Error("Missing video uri");
  const trimmed = uri.trim();

  let baseUrl;
  if (/^https?:\/\//i.test(trimmed)) {
    baseUrl = trimmed;
  } else if (trimmed.startsWith("gs://")) {
    const gsPath = trimmed.slice("gs://".length);
    const filesIndex = gsPath.indexOf("files/");
    if (filesIndex === -1) throw new Error(`Unsupported gs URI: ${trimmed}`);
    baseUrl = `https://generativelanguage.googleapis.com/v1beta/${gsPath.slice(filesIndex)}:download?alt=media`;
  } else if (trimmed.startsWith("files/")) {
    baseUrl = `https://generativelanguage.googleapis.com/v1beta/${trimmed}:download?alt=media`;
  } else {
    throw new Error(`Unsupported video URI format: ${trimmed}`);
  }

  if (apiKey) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    baseUrl = `${baseUrl}${sep}key=${apiKey}`;
  }
  return baseUrl;
}

const VEO_MODEL = "veo-3.1-lite-generate-preview";
const VEO_POLL_MS = 10_000;
const VEO_MAX_POLLS = 60; // 10 min max

async function submitVeoJob(
  apiKey,
  lastFrameBase64,
  generatedImageBase64,
  userPrompt,
) {
  const prompt =
    `${userPrompt}. One-shot handheld camera movement from start frame to target frame. ` +
    `Match the lighting and maintain photorealistic detail throughout.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`;
  const body = {
    instances: [
      {
        prompt,
        image: {
          mimeType: "image/jpeg",
          bytesBase64Encoded: stripPrefix(lastFrameBase64),
        },
        lastFrame: {
          mimeType: "image/jpeg",
          bytesBase64Encoded: stripPrefix(generatedImageBase64),
        },
      },
    ],
    parameters: { aspectRatio: "9:16", durationSeconds: 8, sampleCount: 1 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonSafely(res);
  if (!res.ok)
    throw new Error(data?.error?.message ?? `Veo submit failed ${res.status}`);
  const operationName = data?.name;
  if (!operationName) throw new Error("Veo: no operation name returned");
  return operationName;
}

async function pollVeoOperation(apiKey, operationName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
  for (let i = 0; i < VEO_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, VEO_POLL_MS));
    const res = await fetch(url);
    const data = await readJsonSafely(res);
    if (!res.ok)
      throw new Error(data?.error?.message ?? `Veo poll failed ${res.status}`);
    if (data.error)
      throw new Error(data.error.message ?? "Veo operation error");
    if (data.done) {
      const videoUri =
        data.response?.generateVideoResponse?.generatedSamples?.[0]?.video
          ?.uri ?? data.response?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) throw new Error("Veo done but no video URI");
      return videoUri;
    }
  }
  throw new Error("Veo generation timed out after 10 minutes");
}

// ── Kling helpers ─────────────────────────────────────────────────────────────

/**
 * Generates a Kling JWT (HS256) without any external package.
 * Header: { alg: "HS256", typ: "JWT" }
 * Payload: { iss: accessKey, exp: now+3600, nbf: now }
 */
function generateKlingJWT(accessKey, secretKey) {
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ iss: accessKey, exp: now + 3600, nbf: now });
  const sigInput = `${header}.${payload}`;
  const sig = createHmac("sha256", secretKey)
    .update(sigInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${sigInput}.${sig}`;
}

const KLING_BASE = "https://api-singapore.klingai.com";
const KLING_POLL_MS = 10_000;
const KLING_MAX_POLLS = 60; // 10 min max

async function submitKlingJob(
  accessKey,
  secretKey,
  lastFrameBase64,
  generatedImageBase64,
  userPrompt,
) {
  const token = generateKlingJWT(accessKey, secretKey);
  const prompt =
    `${userPrompt}. Cinematic one-shot. The video must begin exactly at the start frame ` +
    `and resolve perfectly into the target frame. No identity drift. ` +
    `The subject in the target frame is the only subject allowed. Continuous handheld dolly-in motion.`;

  const body = {
    model_name: "kling-v3",
    image: stripPrefix(lastFrameBase64), // start frame — raw base64
    image_tail: stripPrefix(generatedImageBase64), // end/target frame — raw base64
    prompt,
    duration: "5",
    mode: "pro",
    aspect_ratio: "9:16",
  };

  const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await readJsonSafely(res);
  if (!res.ok || data?.code !== 0) {
    throw new Error(data?.message ?? `Kling submit failed (${res.status})`);
  }

  const taskId = data?.data?.task_id;
  if (!taskId) throw new Error("Kling: no task_id returned");
  return taskId;
}

async function pollKlingTask(accessKey, secretKey, taskId) {
  const url = `${KLING_BASE}/v1/videos/image2video/${taskId}`;
  for (let i = 0; i < KLING_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, KLING_POLL_MS));
    const token = generateKlingJWT(accessKey, secretKey); // refresh each poll (1h expiry)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJsonSafely(res);
    if (!res.ok || data?.code !== 0) {
      throw new Error(data?.message ?? `Kling poll failed (${res.status})`);
    }

    const status = data?.data?.task_status ?? "";
    if (status === "failed") {
      throw new Error(data?.data?.task_status_msg ?? "Kling task failed");
    }
    if (status === "succeed") {
      const videoUrl = data?.data?.task_result?.videos?.[0]?.url;
      if (!videoUrl)
        throw new Error("Kling succeeded but no video URL in response");
      return videoUrl;
    }
    // status: "submitted" | "processing" — keep polling
  }
  throw new Error("Kling generation timed out after 10 minutes");
}

// ── Gemini prompt suggestions ─────────────────────────────────────────────────

app.post("/api/generate-prompts", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const { sceneImageBase64 } = req.body;

  const MODEL_NAME = "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
  const promptText = `Analyze this scene. Generate exactly 3 punchy action prompts (4–8 words each) for a person joining the video. 

1. High Energy: An intense, active interaction.
2. Chill: A relaxed, natural reaction.
3. Absurd: Total chaos or surrealism.

Rules: No "I" or "I am" at the start. Direct action only. Be specific to the visuals.
Format: Return ONLY a raw JSON array of 3 strings. No markdown.
Example: ["Chasing the dog", "Napping on the couch", "Transforming into a giant pizza"]`;

  const parts = [{ text: promptText }];
  if (sceneImageBase64) {
    parts.unshift({
      inline_data: { mime_type: "image/jpeg", data: sceneImageBase64 },
    });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 1.1, maxOutputTokens: 200 },
      }),
    });
    const data = await readJsonSafely(response);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const match = text.match(/\[[\s\S]*?\]/);
    const prompts = match ? JSON.parse(match[0]) : [];
    res.json({ prompts });
  } catch (err) {
    console.error("generate-prompts error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Gemini image generation ───────────────────────────────────────────────────

app.post("/api/generate-stitch", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const { userPhotoBase64, userPrompt, lastFrameBase64 } = req.body;

  const MODEL_NAME = "gemini-3.1-flash-image-preview";

  const hasIdentity = !!IDENTITY_IMAGE_B64;
  const promptText = hasIdentity
    ? `You are an advanced image compositor. Three images are provided in order:
       1. scene_frame — the video scene to composite the subject into.
       2. user_identity — ground-truth face reference. Priority 1: match this face exactly. Ignore its background and clothing entirely.
       3. captured_selfie — real-time capture. Use only for expression, pose, and lighting cues.
       Action: ${userPrompt}.
       Style: Photorealistic, 9:16 vertical video still. Seamlessly blend the subject into the scene, matching its lighting and camera angle.`
    : `Subject: The person in the provided selfie.
       Action: ${userPrompt}.
       Environment: Match the exact scene of the provided video frame, lighting, and camera angle.
       Style: Photorealistic, 9:16 vertical video still.`;

  const imageParts = [
    {
      inline_data: {
        mime_type: "image/jpeg",
        data: stripPrefix(lastFrameBase64),
      },
    },
    ...(hasIdentity
      ? [{ inline_data: { mime_type: "image/jpeg", data: IDENTITY_IMAGE_B64 } }]
      : []),
    {
      inline_data: {
        mime_type: "image/jpeg",
        data: stripPrefix(userPhotoBase64),
      },
    },
  ];

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: promptText }, ...imageParts] }],
  };

  // ── Dev mock — skip Gemini, return local placeholder image ──────────────────
  if (USE_DEV_MOCK) {
    await new Promise((r) => setTimeout(r, MOCK_STAGE_MS[0]));
    try {
      const imgBuf = await readFile(
        path.join(process.cwd(), "public", "placeholders", "mock_remix.jpg"),
      );
      return res.json({
        imageBase64: imgBuf.toString("base64"),
        isAnimationReady: true,
        animationType: "zoom-in-slow",
      });
    } catch {
      return res.status(500).json({
        error: "Dev mock: missing public/placeholders/mock_remix.jpg",
      });
    }
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData,
    );
    const imageBase64 = imagePart?.inlineData?.data;
    if (!imageBase64) throw new Error("Image generation failed");

    res.json({
      imageBase64,
      isAnimationReady: true,
      animationType: "zoom-in-slow",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unified video generation ──────────────────────────────────────────────────

app.post("/api/generate-video", async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const klingAK = process.env.KLING_ACCESS_KEY;
  const klingSK = process.env.KLING_SECRET_KEY;

  const { generatedImageBase64, userPrompt, lastFrameBase64 } = req.body;
  if (!generatedImageBase64 || !userPrompt || !lastFrameBase64) {
    return res.status(400).json({
      error:
        "generatedImageBase64, lastFrameBase64, and userPrompt are required",
    });
  }

  req.socket.setTimeout(0);

  // ── Dev mock — skip video engine, return local placeholder video ──────────────
  if (USE_DEV_MOCK) {
    await new Promise((r) => setTimeout(r, MOCK_STAGE_MS[2]));
    return res.json({
      videoUri: `http://localhost:${PORT}/placeholders/mock_video.mp4`,
      engineUsed: "DEV_MOCK",
      savedImagePath: "/placeholders/mock_remix.jpg",
      savedVideoPath: "/placeholders/mock_video.mp4",
    });
  }

  try {
    let videoUrl;

    switch (VIDEO_ENGINE) {
      case "KLING": {
        if (!klingAK || !klingSK) {
          throw new Error(
            "KLING_ACCESS_KEY / KLING_SECRET_KEY not set in .env",
          );
        }
        const taskId = await submitKlingJob(
          klingAK,
          klingSK,
          lastFrameBase64,
          generatedImageBase64,
          userPrompt,
        );
        videoUrl = await pollKlingTask(klingAK, klingSK, taskId);
        break;
      }
      case "VEO": {
        if (!geminiKey) throw new Error("GEMINI_API_KEY not set in .env");
        const operationName = await submitVeoJob(
          geminiKey,
          lastFrameBase64,
          generatedImageBase64,
          userPrompt,
        );
        videoUrl = await pollVeoOperation(geminiKey, operationName);
        break;
      }
      default:
        throw new Error(`Unknown VIDEO_ENGINE: "${VIDEO_ENGINE}"`);
    }

    const savedAssets = await persistGeneratedAssets({
      apiKey: geminiKey,
      imageBase64: generatedImageBase64,
      videoUrl,
    });

    res.json({ videoUri: videoUrl, engineUsed: VIDEO_ENGINE, ...savedAssets });
  } catch (err) {
    res.status(500).json({ error: err.message ?? "Video generation error" });
  }
});

// ── Video proxy (for Veo GCS URIs that need auth) ─────────────────────────────

app.get("/api/video-proxy", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const uri = String(req.query.uri ?? "");
  if (!uri)
    return res.status(400).json({ error: "uri query parameter is required" });

  try {
    const downloadUrl = toVeoDownloadUrl(uri, apiKey); // key in query string
    // Also send key as header — Files API requires it at every stage of the handshake
    const proxyHeaders = apiKey ? { "x-goog-api-key": apiKey } : {};
    const upstream = await fetch(downloadUrl, {
      headers: proxyHeaders,
      redirect: "follow",
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(upstream.status).json({
        error: `Proxy failed: ${body.slice(0, 300)}`,
      });
    }
    if (!upstream.body)
      return res.status(502).json({ error: "Empty upstream stream" });

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "video/mp4",
    );
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("Cache-Control", "no-store");

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message ?? "Video proxy failed" });
  }
});

// ── Engine config (read by frontend to stay in sync) ─────────────────────────

app.get("/api/engine-config", (_req, res) => {
  res.json({
    engine: VIDEO_ENGINE,
    aiClipDurationSecs: VIDEO_ENGINE === "KLING" ? 5 : 8,
    devMode: USE_DEV_MOCK,
    stageDurationsMs: USE_DEV_MOCK ? MOCK_STAGE_MS : [0, 0, 0],
  });
});

app.listen(PORT, () => {
  console.log(
    `Proxy server running on http://localhost:${PORT} [engine: ${VIDEO_ENGINE}]`,
  );
});
