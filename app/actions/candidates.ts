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

      // Attempt querying Supabase in parallel to merge any cloud records
      try {
        const [postsRes, candidatesRes] = await Promise.allSettled([
          supabase
            .from("posts")
            .select("*")
            .eq("election_id", electionId)
            .order("display_order", { ascending: true }),
          supabase
            .from("candidates")
            .select("*")
            .order("created_at", { ascending: true }),
        ]);

        const cloudPosts = postsRes.status === "fulfilled" ? postsRes.value.data : null;
        const cloudCandidates = candidatesRes.status === "fulfilled" ? candidatesRes.value.data : null;

        if (cloudPosts && cloudPosts.length > 0) {
          const cloudMerged: PostWithCandidatesDto[] = cloudPosts.map((p: any) => ({
            id: p.id,
            electionId: p.election_id || electionId,
            title: p.title,
            description: p.description || "",
            maxSelections: p.max_selections || 1,
            allowedLevels: p.allowed_levels || [],
            candidates: (cloudCandidates || [])
              .filter((c: any) => (c.post_id || c.postId) === p.id)
              .map((c: any) => ({
                id: c.id,
                postId: p.id,
                fullName: c.full_name || c.fullName,
                nickname: c.nickname || "",
                matricNo: c.matric_no || c.matricNo || "",
                photoUrl: c.photo_url || c.photoUrl || "",
                manifesto: c.manifesto || "",
                status: c.status || "CLEARED",
                voteCount: c.vote_count || 0,
              })),
          }));

          if (cloudMerged.length > 0) {
            return cloudMerged;
          }
        }
      } catch (_) {}

      // Filter store posts matching this electionId, or all posts if matching
      const matchingStorePosts = store.posts.filter(
        (p) => p.electionId === electionId || !p.electionId
      );
      return matchingStorePosts.length > 0 ? matchingStorePosts : store.posts;
    } catch (err) {
      console.warn("Error in getElectionPostsAndCandidatesAction:", err);
      return getInitialStore().posts;
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

  const newPost: PostWithCandidatesDto = {
    id: newPostId,
    electionId: input.electionId || "elec-ui-2026",
    title: input.title.trim(),
    description: input.description?.trim() || "",
    maxSelections: input.maxSelections || 1,
    allowedLevels: input.allowedLevels || [],
    candidates: [],
  };

  store.posts.push(newPost);
  writeServerStore(store);

  try {
    await supabase.from("posts").upsert({
      id: newPostId,
      election_id: input.electionId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      max_selections: input.maxSelections || 1,
      allowed_levels: input.allowedLevels || [],
    });
  } catch (_) {}

  invalidateCache("posts:");
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
}) {
  const newCandId = `cand-${Date.now()}`;
  const store = readServerStore();

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
      return { ...post, candidates: [...post.candidates, newCand] };
    }
    return post;
  });

  if (!foundPost) {
    store.posts.push({
      id: input.postId,
      electionId: "elec-ui-2026",
      title: "Executive Office",
      description: "",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [newCand],
    });
  }

  writeServerStore(store);

  try {
    await supabase.from("candidates").upsert({
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
  } catch (_) {}

  invalidateCache("posts:");
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
    await supabase
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
  } catch (_) {}

  invalidateCache("posts:");
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
    await supabase.from("candidates").delete().eq("id", candidateId);
  } catch (_) {}

  invalidateCache("posts:");
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
    await supabase.from("posts").delete().eq("id", postId);
  } catch (_) {}

  invalidateCache("posts:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return { success: true, message: "Elective post removed." };
}
