"use server";

import { revalidatePath } from "next/cache";
import { supabase, fetchWithCache, invalidateCache } from "@/lib/supabase";
import fs from "fs";
import path from "path";

export interface CandidateDto {
  id: string;
  postId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  status: "NOMINATED" | "CLEARED" | "DISQUALIFIED";
  voteCount: number;
}

export interface PostWithCandidatesDto {
  id: string;
  electionId: string;
  title: string;
  description?: string;
  maxSelections: number;
  allowedLevels: number[];
  candidates: CandidateDto[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates-store.json");

function getInitialStore() {
  return {
    posts: [
      {
        id: "post-1",
        electionId: "elec-ui-2026",
        title: "President",
        description: "Executive President of the Association",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
      {
        id: "post-2",
        electionId: "elec-ui-2026",
        title: "Vice President",
        description: "Executive Vice President",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
      {
        id: "post-3",
        electionId: "elec-ui-2026",
        title: "General Secretary",
        description: "Chief Secretariat Administrator",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
    ],
  };
}

function readServerStore(): { posts: PostWithCandidatesDto[] } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CANDIDATES_FILE)) {
      const initial = getInitialStore();
      fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(CANDIDATES_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("readServerStore error, returning initial:", err);
    return getInitialStore();
  }
}

function writeServerStore(store: { posts: PostWithCandidatesDto[] }) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.warn("writeServerStore error:", err);
  }
}

/**
 * Fetch all posts and candidates for an election
 */
export async function getElectionPostsAndCandidatesAction(
  electionId: string
): Promise<PostWithCandidatesDto[]> {
  return fetchWithCache(`posts:${electionId}`, 15, async () => {
    try {
      const store = readServerStore();
      const targetElectionId = electionId || "elec-ui-nesa-2026";

      // 1. Attempt querying Supabase posts & candidates
      try {
        const { data: cloudPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("election_id", targetElectionId)
          .order("display_order", { ascending: true });

        // STRICT ISOLATION: if no posts exist for this exact electionId, return empty.
        // Do NOT fall back to searching all posts by institution prefix — that causes
        // cross-org bleed (NESA's posts appearing for RENARSA).
        if (!cloudPosts || cloudPosts.length === 0) {
          // Check local store for this specific election
          const matchingStorePosts = store.posts.filter(
            (p) => p.electionId === targetElectionId
          );
          return matchingStorePosts;
        }

        // 2. Query candidates SCOPED to this election's posts only
        const postIds = cloudPosts.map((p: any) => p.id);
        const { data: cloudCandidates } = await supabase
          .from("candidates")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: true });

        if (cloudPosts && cloudPosts.length > 0) {
          const cloudMerged: PostWithCandidatesDto[] = cloudPosts.map((p: any) => {
            const postCloudCands: CandidateDto[] = (cloudCandidates || [])
              .filter((c: any) => (c.post_id || c.postId) === p.id)
              .map((c: any) => ({
                id: c.id,
                postId: p.id,
                fullName: c.full_name || c.fullName,
                nickname: c.nickname || "",
                matricNo: c.matric_no || c.matricNo || "",
                photoUrl: c.photo_url || c.photoUrl || "",
                manifesto: c.manifesto || "",
                status: (c.status || "CLEARED") as "NOMINATED" | "CLEARED" | "DISQUALIFIED",
                voteCount: c.vote_count || 0,
              }));

            // Also include any candidate from local store if not yet in Supabase
            const storePost = store.posts.find((sp) => sp.id === p.id && sp.electionId === targetElectionId);
            if (storePost?.candidates) {
              const existingIds = new Set(postCloudCands.map((c) => c.id));
              for (const sc of storePost.candidates) {
                if (!existingIds.has(sc.id)) {
                  postCloudCands.push(sc);
                }
              }
            }

            return {
              id: p.id,
              electionId: p.election_id || targetElectionId,
              title: p.title,
              description: p.description || "",
              maxSelections: p.max_selections || 1,
              allowedLevels: p.allowed_levels || [],
              candidates: postCloudCands,
            };
          });

          return cloudMerged;
        }
      } catch (cloudErr) {
        console.warn("Cloud posts query exception, using local store:", cloudErr);
      }

      // Strict local store fallback: only return posts matching this specific electionId
      const matchingStorePosts = store.posts.filter(
        (p) => p.electionId === electionId
      );
      return matchingStorePosts;
    } catch (err) {
      console.warn("Error in getElectionPostsAndCandidatesAction:", err);
      return [];
    }
  });
}

/**
 * Add a new Elective Office/Post
 */
export async function createPostAction(input: {
  electionId: string;
  title: string;
  description?: string;
  maxSelections?: number;
  allowedLevels?: number[];
}) {
  const newPostId = `post-${Date.now()}`;
  const store = readServerStore();

  let targetElectionId = input.electionId || "elec-ui-nesa-2026";
  try {
    const { data: elec } = await supabase
      .from("elections")
      .select("id")
      .eq("id", targetElectionId)
      .maybeSingle();

    // Do NOT fall back to .limit(1) — that would assign the post to the wrong org's election.
    // If the exact electionId doesn't exist in Supabase yet, keep using the provided ID.
    if (!elec) {
      console.warn(`createPostAction: election "${targetElectionId}" not found in Supabase; using provided ID as-is.`);
    }
  } catch (_) {}

  const newPost: PostWithCandidatesDto = {
    id: newPostId,
    electionId: targetElectionId,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    maxSelections: input.maxSelections || 1,
    allowedLevels: input.allowedLevels || [],
    candidates: [],
  };

  store.posts.push(newPost);
  writeServerStore(store);

  try {
    const { error: postError } = await supabase.from("posts").upsert({
      id: newPostId,
      election_id: targetElectionId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      max_selections: input.maxSelections || 1,
      display_order: Date.now() % 100000,
      allowed_levels: input.allowedLevels || [],
      allowed_departments: [],
    });
    if (postError) {
      console.error("createPostAction Supabase error:", postError);
    }
  } catch (err) {
    console.error("createPostAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return {
    success: true,
    postId: newPostId,
    message: `Elective post "${input.title}" added successfully.`,
  };
}

/**
 * Add / Nominate a Candidate with Photo
 */
export async function createCandidateAction(input: {
  postId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  electionId?: string;
}) {
  const newCandId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const store = readServerStore();

  // 1. Ensure the parent post exists in Supabase posts table before inserting
  let targetElectionId = input.electionId || "elec-ui-nesa-2026";
  try {
    const { data: existingPost } = await supabase
      .from("posts")
      .select("id, election_id")
      .eq("id", input.postId)
      .maybeSingle();

    if (!existingPost) {
      // Do NOT fall back to elections.limit(1) — that would link the post to the wrong org.
      // Use the provided targetElectionId as-is.

      const foundInStore = store.posts.find((p) => p.id === input.postId);
      const postTitle =
        foundInStore?.title ||
        (input.postId === "post-1"
          ? "President"
          : input.postId === "post-2"
          ? "Vice President"
          : input.postId === "post-3"
          ? "General Secretary"
          : "Executive Office");

      await supabase.from("posts").upsert({
        id: input.postId,
        election_id: targetElectionId,
        title: postTitle,
        description: foundInStore?.description || "",
        max_selections: 1,
        display_order: 1,
        allowed_levels: [],
        allowed_departments: [],
      });
    }
  } catch (postCheckErr) {
    console.warn("Parent post check exception:", postCheckErr);
  }

  // 2. Persist candidate directly to Supabase cloud
  try {
    const { error: candError } = await supabase.from("candidates").upsert({
      id: newCandId,
      post_id: input.postId,
      full_name: input.fullName.trim(),
      nickname: input.nickname?.trim() || "",
      matric_no: input.matricNo?.trim() || "",
      photo_url: input.photoUrl?.trim() || "",
      manifesto: input.manifesto?.trim() || "",
      status: "CLEARED",
      vote_count: 0,
    });

    if (candError) {
      console.error("createCandidateAction Supabase error:", candError);
    }
  } catch (candInsertErr) {
    console.error("createCandidateAction insert exception:", candInsertErr);
  }

  // 3. Update local server store backup
  const newCand: CandidateDto = {
    id: newCandId,
    postId: input.postId,
    fullName: input.fullName.trim(),
    nickname: input.nickname?.trim() || "",
    matricNo: input.matricNo?.trim() || "",
    photoUrl: input.photoUrl?.trim() || "",
    manifesto: input.manifesto?.trim() || "",
    status: "CLEARED",
    voteCount: 0,
  };

  let foundPost = false;
  store.posts = store.posts.map((post) => {
    if (post.id === input.postId) {
      foundPost = true;
      return {
        ...post,
        candidates: [...post.candidates.filter((c) => c.id !== newCandId), newCand],
      };
    }
    return post;
  });

  if (!foundPost) {
    store.posts.push({
      id: input.postId,
      electionId: targetElectionId,
      title: "Executive Office",
      description: "",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [newCand],
    });
  }

  writeServerStore(store);

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return {
    success: true,
    candidateId: newCandId,
    message: `Candidate "${input.fullName}" successfully registered.`,
  };
}

/**
 * Update / Edit a Candidate's details
 */
export async function updateCandidateAction(input: {
  candidateId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  status?: "NOMINATED" | "CLEARED" | "DISQUALIFIED";
}) {
  const store = readServerStore();

  store.posts = store.posts.map((post) => ({
    ...post,
    candidates: post.candidates.map((c) =>
      c.id === input.candidateId
        ? {
            ...c,
            fullName: input.fullName.trim(),
            nickname: input.nickname?.trim() || "",
            matricNo: input.matricNo?.trim() || "",
            photoUrl: input.photoUrl?.trim() || "",
            manifesto: input.manifesto?.trim() || "",
            status: input.status || "CLEARED",
          }
        : c
    ),
  }));

  writeServerStore(store);

  try {
    const { error } = await supabase
      .from("candidates")
      .update({
        full_name: input.fullName.trim(),
        nickname: input.nickname?.trim() || "",
        matric_no: input.matricNo?.trim() || "",
        photo_url: input.photoUrl?.trim() || "",
        manifesto: input.manifesto?.trim() || "",
        status: input.status || "CLEARED",
      })
      .eq("id", input.candidateId);

    if (error) {
      console.error("updateCandidateAction Supabase error:", error);
    }
  } catch (err) {
    console.error("updateCandidateAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return {
    success: true,
    message: `Candidate profile updated successfully.`,
  };
}

/**
 * Delete / Disqualify a candidate
 */
export async function deleteCandidateAction(candidateId: string) {
  const store = readServerStore();

  store.posts = store.posts.map((post) => ({
    ...post,
    candidates: post.candidates.filter((c) => c.id !== candidateId),
  }));

  writeServerStore(store);

  try {
    const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
    if (error) {
      console.error("deleteCandidateAction Supabase error:", error);
    }
  } catch (err) {
    console.error("deleteCandidateAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return { success: true, message: "Candidate removed." };
}

/**
 * Delete a post
 */
export async function deletePostAction(postId: string) {
  const store = readServerStore();

  store.posts = store.posts.filter((p) => p.id !== postId);
  writeServerStore(store);

  try {
    await supabase.from("candidates").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
  } catch (err) {
    console.error("deletePostAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return { success: true, message: "Elective post removed." };
}

